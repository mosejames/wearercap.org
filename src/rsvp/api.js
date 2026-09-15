import { supabase } from '../carpool/supabaseClient.js';
import { squareCrop } from './model.js';

/* Every read and write for an event page.

   There is no sign-in. Saying yes gives this browser a random token, and that
   token is the whole identity: it edits or cancels the RSVP, unlocks the
   thread, and uploads the photo. It is kept in localStorage and in the private
   link we email, so a parent on a new phone opens the link and is back.

   The tables have no grants. Reads come from definer functions that return
   wall names, houses and photos only; phones and emails never leave Postgres
   except through event_rsvp_mine (token required) and the passcode back
   office. */

const key = (slug) => `rcap_rsvp_${slug}`;

export function getToken(slug) {
  try { return localStorage.getItem(key(slug)); } catch { return null; }
}

export function setToken(slug, token) {
  try { localStorage.setItem(key(slug), token); } catch { /* private mode: the emailed link still works */ }
}

export function clearToken(slug) {
  try { localStorage.removeItem(key(slug)); } catch { /* no-op */ }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isToken = (t) => UUID.test(String(t || ''));

/* ?t=<token> from the email wins over whatever this browser held, then comes
   out of the address bar so a screenshot of the page does not carry it. */
export function adoptTokenFromUrl(slug, loc = window.location, hist = window.history) {
  const params = new URLSearchParams(loc.search);
  const t = params.get('t');
  if (!isToken(t)) return getToken(slug);
  setToken(slug, t);
  params.delete('t');
  const qs = params.toString();
  try { hist.replaceState(null, '', loc.pathname + (qs ? `?${qs}` : '') + loc.hash); } catch { /* no-op */ }
  return t;
}

export function privateLink(slug, token, origin = window.location.origin) {
  return `${origin}/rsvp/${slug}?t=${token}`;
}

async function rpc(name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

export const loadEvent = (slug) => rpc('event_get', { p_slug: slug });
export const loadWall = async (slug) => (await rpc('event_wall', { p_slug: slug })) || [];
// The token is optional and only decides which reactions come back marked as
// this browser's own; the counts are the same either way.
export const loadThread = async (slug, token) =>
  (await rpc('event_thread', { p_slug: slug, p_token: isToken(token) ? token : null })) || [];

// Toggling is done in the database so one RSVP counts once per emoji per
// comment, however many times the button is tapped.
export async function reactToComment(token, commentId, emoji) {
  if (!isToken(token)) return null;
  return rpc('event_comment_react', { p_token: token, p_comment_id: commentId, p_emoji: emoji });
}

export async function loadMine(slug, token) {
  if (!isToken(token)) return null;
  return rpc('event_rsvp_mine', { p_slug: slug, p_token: token });
}

/** Creates or updates. Returns the token either way. */
export async function rsvp(slug, token, payload) {
  return rpc('event_rsvp_upsert', { p_slug: slug, p_token: isToken(token) ? token : null, p_payload: payload });
}

export const cancel = (token) => rpc('event_rsvp_cancel', { p_token: token });
export const comment = (token, body, prompt = null) => rpc('event_comment_post', { p_token: token, p_body: body, p_prompt: prompt });

/* Fire and forget. The function reads the address off the row by token, so it
   cannot be pointed at anyone else, and it refuses to send twice. It also
   posts the board alert. A slow mail API must never hold up the done state. */
export function sendConfirmation(token) {
  return supabase.functions
    .invoke('event-confirm', { body: { kind: 'confirm', token } })
    .catch((e) => console.warn('confirmation failed', e));
}

export function notifyComment(token, commentId) {
  return supabase.functions
    .invoke('event-confirm', { body: { kind: 'comment', token, comment_id: commentId } })
    .catch((e) => console.warn('comment alert failed', e));
}

/* Square, 400px, JPEG, under 300 KB, all before it leaves the phone. iOS
   hands HEIC to the picker; Safari can decode it natively, anything else gets
   heic-to, same as The Collective. */
export async function preparePhoto(file) {
  if (!file) return null;
  if (file.size > 30 * 1024 * 1024) throw new Error('Choose a photo under 30 MB.');
  let source = file;
  const heic = /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '');
  const url0 = URL.createObjectURL(source);
  let img = new Image();
  try {
    img.src = url0;
    await img.decode();
  } catch {
    URL.revokeObjectURL(url0);
    if (!heic) throw new Error('Could not read this photo. Try a JPG or PNG.');
    const { heicTo } = await import('heic-to');
    source = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 });
    img = new Image();
    img.src = URL.createObjectURL(source);
    await img.decode();
  }
  const { sx, sy, side, out } = squareCrop(img.naturalWidth, img.naturalHeight, 400);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not prepare this photo.');
  ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
  URL.revokeObjectURL(img.src);
  let blob = null;
  for (const q of [0.86, 0.76, 0.64, 0.5]) {
    blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size < 300 * 1024) break;
  }
  canvas.width = canvas.height = 0;
  if (!blob || blob.size >= 300 * 1024) throw new Error('This photo could not be made small enough. Try another.');
  return blob;
}

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/* The bucket takes no client writes at all. event-photo checks the token,
   then writes <event_id>/<rsvp_id>.jpg with the service key. */
export async function uploadPhoto(token, blob) {
  const image = await toBase64(blob);
  const { data, error } = await supabase.functions.invoke('event-photo', { body: { token, image } });
  if (error) throw error;
  return data && data.photo_url;
}

/* Live wall and thread. Public broadcast topic, public fields only; the
   trigger that sends it lives in the migration. Returns an unsubscribe. */
export function subscribe(slug, { onRsvp, onComment }) {
  const channel = supabase
    .channel(`event:${slug}`)
    .on('broadcast', { event: 'rsvp' }, (m) => onRsvp && onRsvp(m.payload))
    .on('broadcast', { event: 'comment' }, (m) => onComment && onComment(m.payload))
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export const adminList = (pass, slug) => rpc('event_admin_list', { p_pass: pass, p_slug: slug });
export const adminHideComment = (pass, id, hidden) => rpc('event_admin_hide_comment', { p_pass: pass, p_id: id, p_hidden: hidden });
export const adminRemovePhoto = (pass, id) => rpc('event_admin_remove_photo', { p_pass: pass, p_rsvp: id });
