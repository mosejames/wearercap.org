import { createClient } from '@supabase/supabase-js';
import { VAULT } from './config.js';
const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
let token;
export function getToken() {
  if (token) return token;
  try { token = localStorage.getItem('london-vault-token'); } catch { /* memory only */ }
  if (!token) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem('london-vault-token', token); } catch { /* memory only */ }
  }
  return token;
}
export async function getOwner() {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(getToken()));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}
export function localProfile() {
  try { return JSON.parse(localStorage.getItem('london-vault-profile') || 'null'); } catch { return null; }
}
export async function saveProfile({ displayName, team }) {
  const { data, error } = await client.rpc('london_save_profile', { p_token: getToken(), p_name: displayName.trim(), p_group: team.trim() });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const profile = { displayName: row.display_name, team: row.team || '' };
  try { localStorage.setItem('london-vault-profile', JSON.stringify(profile)); } catch { /* memory only */ }
  return profile;
}
let config;
export async function storageConfig() {
  if (config) return config;
  const response = await fetch('/api/london-sign', { cache: 'no-store' });
  const result = await response.json();
  if (!response.ok || result.mode !== 'r2' || !result.publicBase) throw new Error('Photo storage is temporarily unavailable. Please try again later.');
  config = result;
  return config;
}
export function mediaUrl(photo, which = 'web') {
  if (!config || photo.storage !== 'r2') return '';
  const key = which === 'orig' ? photo.key : which === 'thumb' ? photo.thumbKey : photo.webKey;
  return `${config.publicBase}/${key}`;
}
const photoFromRow = (row) => ({
  id: row.id, eventId: row.event_id, owner: row.owner, uploaderName: row.uploader_name,
  team: row.team || '', storage: row.storage, key: row.key, webKey: row.web_key, thumbKey: row.thumb_key,
  caption: row.caption || '', inspiration: row.inspiration || '', kind: row.kind, createdAt: row.created_at, takenAt: row.taken_at,
});
export async function listEvents() {
  const { data, error } = await client.from('m3_events').select('id,slug,title').eq('vault', VAULT.id).eq('hidden', false);
  if (error) throw error;
  return data || [];
}
export async function listPhotos() {
  await storageConfig();
  const { data, error } = await client.rpc('m3_list_photos', { p_token: getToken(), p_vault: VAULT.id, p_mode: 'recent', p_limit: 5000 });
  if (error) throw error;
  const photos = (data || []).map((row) => photoFromRow(row.photo));
  const owner = await getOwner();
  const thanked = new Set();
  for (let offset = 0; offset < photos.length; offset += 200) {
    const { data: likes, error: likesError } = await client.from('m3_likes').select('photo_id').eq('owner', owner).in('photo_id', photos.slice(offset, offset + 200).map((p) => p.id));
    if (likesError) throw likesError;
    (likes || []).forEach((like) => thanked.add(like.photo_id));
  }
  return photos.map((photo) => ({ ...photo, thanked: thanked.has(photo.id) }));
}
export async function insertPhotos(rows) {
  const { error } = await client.from('m3_photos').insert(rows);
  if (error) throw error;
  return rows.map(photoFromRow);
}
export async function hidePhoto(id, pass = '') {
  const { error } = await client.rpc('m3_set_photo', { p_id: id, p_token: getToken(), p_pass: pass, p_hidden: true });
  if (error) throw error;
}
export async function checkPass(pass) {
  const { data, error } = await client.rpc('m3_pass_ok', { p_vault: VAULT.id, p_pass: pass });
  if (error) throw error;
  return data === true;
}

export async function setThanks(id, thanked) {
  const { error } = await client.rpc('london_set_thanks', { p_photo: id, p_token: getToken(), p_thanked: thanked });
  if (error) throw error;
}

export async function categorizePhoto(id, inspiration) {
  const { error } = await client.rpc('london_categorize_photo', { p_photo: id, p_token: getToken(), p_inspiration: inspiration });
  if (error) throw error;
}

export async function conversation(photoId, action = 'read', values = {}) {
 const {data,error}=await client.rpc('london_conversation',{p_photo:photoId,p_token:getToken(),p_action:action,...values});
 if(error) throw error;
 return data || {reactions:[],comments:[]};
}
