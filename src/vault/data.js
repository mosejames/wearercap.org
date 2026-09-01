// ---------------------------------------------------------------------------
// Data layer for the Amistad Vault. Every read and write to Supabase goes
// through here so the views never touch table names.
// ---------------------------------------------------------------------------
import { supabase } from '../carpool/supabaseClient.js';
import { HOUSE, SITE } from './config.js';

const url = import.meta.env.VITE_SUPABASE_URL;

/* -------------------------------------------------------------- identity */
// No accounts. The browser makes a secret token on first visit and keeps it
// in localStorage; the database only ever sees sha256(token) as `owner`.
// Presenting the token proves ownership of your own rows. Clearing site data
// makes you a new person, which is the honest trade for zero sign-in.

const TOKEN_KEY = 'ami-vault-token';
const NAME_KEY = 'ami-vault-profile';
const PASS_KEY = 'ami-vault-pass';

function randomToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function getToken() {
  let t = null;
  try { t = localStorage.getItem(TOKEN_KEY); } catch { /* private mode */ }
  if (!t) {
    t = randomToken();
    try { localStorage.setItem(TOKEN_KEY, t); } catch { /* keep in memory only */ }
  }
  return t;
}

let ownerCache = null;
export async function getOwner() {
  if (ownerCache) return ownerCache;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(getToken()));
  ownerCache = Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
  return ownerCache;
}

export function localProfile() {
  try { const raw = localStorage.getItem(NAME_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function rememberProfile(p) {
  try { localStorage.setItem(NAME_KEY, JSON.stringify(p)); } catch { /* fine */ }
}

export function localPass() { try { return localStorage.getItem(PASS_KEY) || ''; } catch { return ''; } }
export function rememberPass(p) { try { p ? localStorage.setItem(PASS_KEY, p) : localStorage.removeItem(PASS_KEY); } catch { /* fine */ } }

export async function checkPass(pass) {
  const { data, error } = await supabase.rpc('vault_pass_ok', { p_house: HOUSE.id, p_pass: pass });
  if (error) return false;
  return !!data;
}

/* --------------------------------------------------------------- profile */

export async function fetchProfile() {
  const owner = await getOwner();
  const { data, error } = await supabase
    .from('vault_people').select('owner, display_name, student').eq('owner', owner).maybeSingle();
  if (error) throw error;
  if (data) rememberProfile({ display_name: data.display_name, student: data.student });
  return data;
}

export async function saveProfile(form) {
  const { data, error } = await supabase.rpc('vault_save_profile', {
    p_token: getToken(),
    p_name: form.displayName.trim(),
    p_student: (form.student || '').trim(),
    p_phone: (form.phone || '').trim(),
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  rememberProfile({ display_name: row.display_name, student: row.student, phone: (form.phone || '').trim() });
  return row;
}

/* --------------------------------------------------------------- storage */

let storageCfg = null;
// { mode: 'r2' | 'supabase', publicBase }
export async function storageConfig() {
  if (storageCfg) return storageCfg;
  try {
    const r = await fetch('/api/vault-sign', { cache: 'no-store' });
    if (r.ok) storageCfg = await r.json();
  } catch { /* fall through */ }
  if (!storageCfg) storageCfg = { mode: 'supabase', publicBase: `${url}/storage/v1/object/public/vault-media` };
  return storageCfg;
}

const SUPA_BASE = `${url}/storage/v1/object/public/vault-media`;

// Public URL for a stored key. Rows remember which store they went to, so the
// R2 cut-over does not orphan anything uploaded before it.
export function mediaUrl(photo, which = 'web') {
  const key = which === 'orig' ? photo.key : which === 'thumb' ? photo.thumbKey : photo.webKey;
  if (photo.storage === 'r2') return `${storageCfg?.publicBase || ''}/${key}`;
  return `${SUPA_BASE}/${key}`;
}

/* ---------------------------------------------------------------- events */

const eventFromRow = (r, s = {}) => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  blurb: r.blurb || '',
  kind: r.kind,
  startsOn: r.starts_on,
  endsOn: r.ends_on,
  coverPhoto: r.cover_photo,
  open: r.open,
  featured: r.featured,
  hidden: r.hidden,
  photoCount: Number(s.photo_count || 0),
  contributorCount: Number(s.contributor_count || 0),
  likeCount: Number(s.like_count || 0),
  lastUploadAt: s.last_upload_at || null,
});

export async function listEvents() {
  const [{ data: ev, error: e1 }, { data: st, error: e2 }] = await Promise.all([
    supabase.from('vault_events').select('*').eq('house', HOUSE.id).order('starts_on'),
    supabase.from('vault_event_stats').select('*'),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const stats = new Map((st || []).map((s) => [s.event_id, s]));
  return (ev || []).map((r) => eventFromRow(r, stats.get(r.id)));
}

export async function saveEvent(form, id = null, pass = '') {
  const p = {
    slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''),
    title: form.title.trim(),
    blurb: (form.blurb || '').trim(),
    kind: form.kind,
    starts_on: form.startsOn,
    ends_on: form.endsOn || null,
    open: !!form.open,
    featured: !!form.featured,
    hidden: !!form.hidden,
  };
  const { data, error } = await supabase.rpc('vault_admin_save_event', { p_pass: pass, p_id: id, p });
  if (error) throw error;
  return eventFromRow(Array.isArray(data) ? data[0] : data);
}


/* ---------------------------------------------------------------- photos */

const photoFromRow = (r) => ({
  id: r.id,
  eventId: r.event_id,
  owner: r.owner,
  uploaderName: r.uploader_name || '',
  storage: r.storage,
  key: r.key,
  webKey: r.web_key,
  thumbKey: r.thumb_key,
  width: r.width,
  height: r.height,
  bytes: r.bytes,
  contentType: r.content_type,
  takenAt: r.taken_at,
  caption: r.caption || '',
  hidden: r.hidden,
  createdAt: r.created_at,
  likes: 0,
});

// A whole event's photos plus per-photo like totals.
export async function listPhotos(eventId) {
  const { data, error } = await supabase
    .from('vault_photos')
    .select('*')
    .eq('event_id', eventId)
    .order('taken_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  const photos = (data || []).map(photoFromRow);
  await attachLikes(photos);
  return photos;
}

export async function listTopPhotos(limit = 60) {
  const { data: likes, error } = await supabase
    .from('vault_photo_likes')
    .select('photo_id, likes')
    .order('likes', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const ids = (likes || []).map((l) => l.photo_id);
  if (!ids.length) return [];
  const { data, error: e2 } = await supabase.from('vault_photos').select('*').in('id', ids);
  if (e2) throw e2;
  const n = new Map(likes.map((l) => [l.photo_id, l.likes]));
  return (data || []).map(photoFromRow).map((p) => ({ ...p, likes: n.get(p.id) || 0 }))
    .sort((a, b) => b.likes - a.likes || (a.createdAt < b.createdAt ? 1 : -1));
}

export async function listRecentPhotos(limit = 24) {
  const { data, error } = await supabase
    .from('vault_photos').select('*').eq('house', HOUSE.id)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  const photos = (data || []).map(photoFromRow);
  await attachLikes(photos);
  return photos;
}

export async function listMyPhotos() {
  const owner = await getOwner();
  const { data, error } = await supabase
    .from('vault_photos').select('*').eq('owner', owner)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(photoFromRow);
}

async function attachLikes(photos) {
  if (!photos.length) return;
  const ids = photos.map((p) => p.id);
  const { data } = await supabase.from('vault_photo_likes').select('photo_id, likes').in('photo_id', ids);
  const n = new Map((data || []).map((l) => [l.photo_id, l.likes]));
  for (const p of photos) p.likes = n.get(p.id) || 0;
}

export async function insertPhotos(rows) {
  const { data, error } = await supabase.from('vault_photos').insert(rows).select();
  if (error) throw error;
  return (data || []).map(photoFromRow);
}

export async function updatePhoto(id, patch, pass = '') {
  const { error } = await supabase.rpc('vault_set_photo', {
    p_id: id, p_token: getToken(), p_pass: pass,
    p_hidden: 'hidden' in patch ? patch.hidden : null,
    p_caption: 'caption' in patch ? patch.caption : null,
  });
  if (error) throw error;
}

// Uploads to the Supabase bucket (fallback mode). R2 uploads go straight to
// the presigned URL and never touch this.
export async function uploadToSupabase(key, blob, contentType) {
  const { error } = await supabase.storage.from('vault-media').upload(key, blob, {
    contentType, cacheControl: '31536000', upsert: false,
  });
  if (error && !/already exists/i.test(error.message || '')) throw error;
}

/* ----------------------------------------------------------------- likes */

export async function myLikes(photoIds) {
  if (!photoIds.length) return new Set();
  const owner = await getOwner();
  const { data } = await supabase.from('vault_likes').select('photo_id').eq('owner', owner).in('photo_id', photoIds);
  return new Set((data || []).map((l) => l.photo_id));
}

export async function like(photoId) {
  const owner = await getOwner();
  const { error } = await supabase.from('vault_likes').insert({ photo_id: photoId, owner });
  if (error && error.code !== '23505') throw error;
}

export async function unlike(photoId) {
  const { error } = await supabase.rpc('vault_unlike', { p_photo: photoId, p_token: getToken() });
  if (error) throw error;
}

/* -------------------------------------------------------------- comments */

export async function listComments(photoId) {
  const { data, error } = await supabase
    .from('vault_comments').select('*').eq('photo_id', photoId).order('created_at');
  if (error) throw error;
  return (data || []).map((c) => ({
    id: c.id, photoId: c.photo_id, owner: c.owner, author: c.author_name,
    body: c.body, hidden: c.hidden, createdAt: c.created_at,
  }));
}

export async function commentCounts(photoIds) {
  if (!photoIds.length) return new Map();
  const { data } = await supabase.from('vault_comments').select('photo_id').in('photo_id', photoIds).eq('hidden', false);
  const m = new Map();
  for (const c of data || []) m.set(c.photo_id, (m.get(c.photo_id) || 0) + 1);
  return m;
}

export async function addComment(photoId, author, body) {
  const owner = await getOwner();
  const { data, error } = await supabase.from('vault_comments')
    .insert({ photo_id: photoId, owner, author_name: author, body: body.trim() })
    .select().single();
  if (error) throw error;
  return { id: data.id, photoId, owner, author, body: data.body, hidden: false, createdAt: data.created_at };
}

export async function hideComment(id, pass = '') {
  const { error } = await supabase.rpc('vault_hide_comment', { p_id: id, p_token: getToken(), p_pass: pass });
  if (error) throw error;
}

/* -------------------------------------------------------------- requests */

export async function listRequests() {
  const { data, error } = await supabase
    .from('vault_requests').select('*').eq('house', HOUSE.id).order('due_on', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id, eventId: r.event_id, message: r.message || '', goal: r.goal,
    dueOn: r.due_on, open: r.open, createdAt: r.created_at,
  }));
}

export async function saveRequest(form, id = null, pass = '') {
  const p = {
    event_id: form.eventId,
    message: (form.message || '').trim(),
    goal: Number(form.goal) || 40,
    due_on: form.dueOn || null,
    open: !!form.open,
  };
  const { error } = await supabase.rpc('vault_admin_save_request', { p_pass: pass, p_id: id, p });
  if (error) throw error;
}

/* ---------------------------------------------------------------- people */

export async function listPhonesForAdmin(pass) {
  const { data, error } = await supabase.rpc('vault_admin_phones', { p_pass: pass });
  if (error) throw error;
  return data || [];
}

/* ---------------------------------------------------------------- totals */

export async function fetchTotals() {
  const { data, error } = await supabase.from('vault_totals').select('*').eq('house', HOUSE.id).maybeSingle();
  if (error) throw error;
  return {
    photos: Number(data?.photo_count || 0),
    families: Number(data?.family_count || 0),
    events: Number(data?.event_count || 0),
    likes: Number(data?.like_count || 0),
  };
}
