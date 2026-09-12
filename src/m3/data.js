// ---------------------------------------------------------------------------
// Data layer for the M³ Vault. Every read and write to Supabase goes through
// here so the views never touch table names.
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';
import { VAULT } from './config.js';

const url = import.meta.env.VITE_SUPABASE_URL;
export const supabase = createClient(url, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

/* -------------------------------------------------------------- identity */
// No accounts. The browser makes a secret token on first visit and keeps it
// in localStorage; the database only ever sees sha256(token) as `owner`.

const TOKEN_KEY = 'm3-vault-token';
const NAME_KEY = 'm3-vault-profile';
const PASS_KEY = 'm3-vault-pass';

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
    try { localStorage.setItem(TOKEN_KEY, t); } catch { /* memory only */ }
  }
  return t;
}

let ownerCache = null;
export async function getOwner() {
  if (ownerCache) return ownerCache;
  const bytes = new TextEncoder().encode(getToken());
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  ownerCache = Array.from(new Uint8Array(hash), (x) => x.toString(16).padStart(2, '0')).join('');
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
  const { data, error } = await supabase.rpc('m3_pass_ok', { p_vault: VAULT.id, p_pass: pass });
  return !error && !!data;
}

/* --------------------------------------------------------------- profile */

const personFromRow = (r) => ({
  owner: r.owner,
  displayName: r.display_name,
  team: r.team || '',
  students: r.students || [],
});

export async function fetchProfile() {
  const owner = await getOwner();
  const { data, error } = await supabase.from('m3_people').select('*').eq('owner', owner).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const p = personFromRow(data);
  rememberProfile(p);
  return p;
}

export async function saveProfile(form) {
  const { data, error } = await supabase.rpc('m3_save_profile', {
    p_token: getToken(),
    p_name: form.displayName.trim(),
    p_team: (form.team || '').trim(),
    p_students: (form.students || []).map((s) => s.trim()).filter(Boolean),
    p_phone: (form.phone || '').trim(),
  });
  if (error) throw error;
  const p = personFromRow(Array.isArray(data) ? data[0] : data);
  rememberProfile(p);
  return p;
}

// Everyone's name and team, keyed by owner. Small list; fetched once a view.
export async function listPeople() {
  const { data, error } = await supabase.from('m3_people').select('*').eq('vault', VAULT.id);
  if (error) throw error;
  return new Map((data || []).map((r) => [r.owner, personFromRow(r)]));
}

export async function listTeams() {
  const { data, error } = await supabase.from('m3_teams').select('*').eq('vault', VAULT.id).order('team');
  if (error) throw error;
  return (data || []).map((t) => ({
    team: t.team, chaperones: t.chaperones || [], students: t.students || [],
    photoCount: Number(t.photo_count || 0), lastUploadAt: t.last_upload_at,
  }));
}

/* --------------------------------------------------------------- storage */

let storageCfg = null;
export async function storageConfig() {
  if (storageCfg) return storageCfg;
  try {
    const r = await fetch('/api/m3-sign', { cache: 'no-store' });
    if (r.ok) storageCfg = await r.json();
  } catch { /* fall through */ }
  if (!storageCfg) storageCfg = { mode: 'supabase', publicBase: `${url}/storage/v1/object/public/m3-media` };
  return storageCfg;
}

const SUPA_BASE = `${url}/storage/v1/object/public/m3-media`;

export function mediaUrl(photo, which = 'web') {
  const key = which === 'orig' ? photo.key : which === 'thumb' ? photo.thumbKey : photo.webKey;
  if (photo.storage === 'r2') return `${storageCfg?.publicBase || ''}/${key}`;
  return `${SUPA_BASE}/${key}`;
}

export async function uploadToSupabase(key, blob, contentType) {
  const { error } = await supabase.storage.from('m3-media').upload(key, blob, {
    contentType, cacheControl: '31536000', upsert: false,
  });
  if (error && !/already exists/i.test(error.message || '')) throw error;
}

/* ---------------------------------------------------------------- events */

const eventFromRow = (r, s = {}) => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  blurb: r.blurb || '',
  kind: r.kind,
  ongoing: r.ongoing || r.kind === 'everyday',
  startsOn: r.starts_on,
  startsAt: r.starts_at,
  endsOn: r.ends_on,
  hidden: r.hidden,
  photoCount: Number(s.photo_count || 0),
  contributorCount: Number(s.contributor_count || 0),
  likeCount: Number(s.like_count || 0),
  lastUploadAt: s.last_upload_at || null,
});

export async function listEvents() {
  const [{ data: ev, error: e1 }, { data: st, error: e2 }] = await Promise.all([
    supabase.from('m3_events').select('*').eq('vault', VAULT.id)
      .order('starts_on').order('starts_at', { ascending: true, nullsFirst: true }),
    supabase.from('m3_event_stats').select('*'),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const stats = new Map((st || []).map((s) => [s.event_id, s]));
  return (ev || []).map((r) => eventFromRow(r, stats.get(r.id)));
}

export async function saveEvent(form, id = null, pass = '') {
  const p = {
    vault: VAULT.id,
    slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''),
    title: form.title.trim(),
    blurb: (form.blurb || '').trim(),
    kind: form.kind || 'moment',
    ongoing: !!form.ongoing,
    starts_on: form.startsOn,
    starts_at: form.startsAt || '',
    ends_on: form.endsOn || '',
    hidden: !!form.hidden,
  };
  const { data, error } = await supabase.rpc('m3_admin_save_event', { p_pass: pass, p_id: id, p });
  if (error) throw error;
  return eventFromRow(Array.isArray(data) ? data[0] : data);
}

/* ---------------------------------------------------------------- photos */

const photoFromRow = (r) => ({
  id: r.id,
  eventId: r.event_id,
  owner: r.owner,
  uploaderName: r.uploader_name || '',
  kind: r.kind || 'photo',
  storage: r.storage,
  key: r.key,
  webKey: r.web_key,
  thumbKey: r.thumb_key,
  width: r.width,
  height: r.height,
  bytes: r.bytes,
  durationS: r.duration_s,
  contentType: r.content_type,
  takenAt: r.taken_at,
  caption: r.caption || '',
  hidden: r.hidden,
  createdAt: r.created_at,
  likes: 0,
});

export const isVideoPhoto = (p) => p.kind === 'video' || /^video\//.test(p.contentType || '');

// Order by capture time so a day reads as a day even when photos arrive late.
export async function listPhotos(eventId) {
  const { data, error } = await supabase
    .from('m3_photos').select('*').eq('event_id', eventId)
    .order('taken_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  const photos = (data || []).map(photoFromRow);
  await attachLikes(photos);
  return photos;
}

export async function listAllPhotos() {
  const { data, error } = await supabase
    .from('m3_photos').select('*').eq('vault', VAULT.id)
    .order('taken_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  const photos = (data || []).map(photoFromRow);
  await attachLikes(photos);
  return photos;
}

export async function listTopPhotos(limit = 60) {
  const { data: likes, error } = await supabase
    .from('m3_photo_likes').select('photo_id, likes').order('likes', { ascending: false }).limit(limit);
  if (error) throw error;
  const ids = (likes || []).map((l) => l.photo_id);
  if (!ids.length) return [];
  const { data, error: e2 } = await supabase.from('m3_photos').select('*').in('id', ids);
  if (e2) throw e2;
  const n = new Map(likes.map((l) => [l.photo_id, l.likes]));
  return (data || []).map(photoFromRow).map((p) => ({ ...p, likes: n.get(p.id) || 0 }))
    .sort((a, b) => b.likes - a.likes || (a.createdAt < b.createdAt ? 1 : -1));
}

export async function listRecentPhotos(limit = 24) {
  const { data, error } = await supabase
    .from('m3_photos').select('*').eq('vault', VAULT.id)
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  const photos = (data || []).map(photoFromRow);
  await attachLikes(photos);
  return photos;
}

export async function listMyPhotos() {
  const owner = await getOwner();
  const { data, error } = await supabase
    .from('m3_photos').select('*').eq('owner', owner).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(photoFromRow);
}

export async function listCoverPhotos(eventId, n = 4) {
  const { data, error } = await supabase.from('m3_photos').select('*').eq('event_id', eventId)
    .order('created_at', { ascending: false }).limit(n);
  if (error) throw error;
  return (data || []).map(photoFromRow);
}

async function attachLikes(photos) {
  if (!photos.length) return;
  const ids = photos.map((p) => p.id);
  const { data } = await supabase.from('m3_photo_likes').select('photo_id, likes').in('photo_id', ids);
  const n = new Map((data || []).map((l) => [l.photo_id, l.likes]));
  for (const p of photos) p.likes = n.get(p.id) || 0;
}

export async function insertPhotos(rows) {
  const { data, error } = await supabase.from('m3_photos').insert(rows).select();
  if (error) throw error;
  return (data || []).map(photoFromRow);
}

export async function updatePhoto(id, patch, pass = '') {
  const { error } = await supabase.rpc('m3_set_photo', {
    p_id: id, p_token: getToken(), p_pass: pass,
    p_hidden: 'hidden' in patch ? patch.hidden : null,
    p_caption: 'caption' in patch ? patch.caption : null,
  });
  if (error) throw error;
}

export async function moveUploads(ids, toEventId, pass) {
  const { data, error } = await supabase.rpc('m3_move_uploads', { p_pass: pass, p_photos: ids, p_to: toEventId });
  if (error) throw error;
  return data;
}

/* ----------------------------------------------------------------- likes */

export async function myLikes(photoIds) {
  if (!photoIds.length) return new Set();
  const owner = await getOwner();
  const { data } = await supabase.from('m3_likes').select('photo_id').eq('owner', owner).in('photo_id', photoIds);
  return new Set((data || []).map((l) => l.photo_id));
}

export async function like(photoId) {
  const owner = await getOwner();
  const { error } = await supabase.from('m3_likes').insert({ photo_id: photoId, owner });
  if (error && error.code !== '23505') throw error;
}

export async function unlike(photoId) {
  const { error } = await supabase.rpc('m3_unlike', { p_photo: photoId, p_token: getToken() });
  if (error) throw error;
}

/* -------------------------------------------------------------- comments */

export async function listComments(photoId) {
  const { data, error } = await supabase
    .from('m3_comments').select('*').eq('photo_id', photoId).order('created_at');
  if (error) throw error;
  return (data || []).map((c) => ({
    id: c.id, photoId: c.photo_id, owner: c.owner, author: c.author_name,
    body: c.body, hidden: c.hidden, createdAt: c.created_at,
  }));
}

export async function commentCounts(photoIds) {
  if (!photoIds.length) return new Map();
  const { data } = await supabase.from('m3_comments').select('photo_id').in('photo_id', photoIds);
  const m = new Map();
  for (const c of data || []) m.set(c.photo_id, (m.get(c.photo_id) || 0) + 1);
  return m;
}

export async function addComment(photoId, author, body) {
  const owner = await getOwner();
  const { data, error } = await supabase.from('m3_comments')
    .insert({ photo_id: photoId, owner, author_name: author, body: body.trim() })
    .select().single();
  if (error) throw error;
  return { id: data.id, photoId, owner, author, body: data.body, hidden: false, createdAt: data.created_at };
}

export async function hideComment(id, pass = '') {
  const { error } = await supabase.rpc('m3_hide_comment', { p_id: id, p_token: getToken(), p_pass: pass });
  if (error) throw error;
}

/* -------------------------------------------------------------- requests */

export async function listRequests() {
  const { data, error } = await supabase
    .from('m3_requests').select('*').eq('vault', VAULT.id).order('due_on', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id, eventId: r.event_id, message: r.message || '', goal: r.goal,
    dueOn: r.due_on, open: r.open, createdAt: r.created_at,
  }));
}

export async function saveRequest(form, id = null, pass = '') {
  const p = {
    vault: VAULT.id,
    event_id: form.eventId,
    message: (form.message || '').trim(),
    goal: Number(form.goal) || 40,
    due_on: form.dueOn || '',
    open: !!form.open,
  };
  const { error } = await supabase.rpc('m3_admin_save_request', { p_pass: pass, p_id: id, p });
  if (error) throw error;
}

/* ---------------------------------------------------------- admin + totals */

export async function listPhonesForAdmin(pass) {
  const { data, error } = await supabase.rpc('m3_admin_phones', { p_pass: pass, p_vault: VAULT.id });
  if (error) throw error;
  return data || [];
}

export async function fetchTotals() {
  const { data, error } = await supabase.from('m3_totals').select('*').eq('vault', VAULT.id).maybeSingle();
  if (error) throw error;
  return {
    photos: Number(data?.photo_count || 0),
    families: Number(data?.family_count || 0),
    events: Number(data?.event_count || 0),
    likes: Number(data?.like_count || 0),
  };
}
