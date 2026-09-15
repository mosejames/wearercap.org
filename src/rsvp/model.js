import { HOUSES as DIRECTORY_HOUSES } from '../directory/model.js';

/* Event RSVP rules, shared by the page and its tests. The database enforces
   every one of these again inside event_rsvp_upsert; the copy here exists so a
   parent sees the problem next to the field instead of after a round trip. */

// Same four houses and colours as The Collective. Imported, not copied.
export const HOUSES = DIRECTORY_HOUSES;
export const NO_HOUSE_COLOR = '#1a2a56';
export const GRADES = [4, 5, 6, 7, 8];
export const COMMENT_MAX = 280;

/* The thread is answers, not announcements. Reminiscent and a little cheeky,
   never "what are you singing", since nobody wants to give that away early.
   Every answer is stored with its question so the wall never reads random. */
export const PROMPTS = [
  "What song couldn't you wait to hear on prom night?",
  'In middle school, what song did you plan to walk down the aisle to?',
  'Whose poster was on your bedroom wall?',
  'What song did you tape off the radio and play until the cassette wore out?',
  'Which R&B group were you ready to join as the fifth member?',
  'What song did you slow dance to at your first party?',
  'What song gets you up at the cookout every time?',
  'What song would your student be mortified to catch you singing?',
];

/** Next question, never the one on screen. `rand` is injectable for tests. */
export function nextPrompt(current, rand = Math.random) {
  const pool = PROMPTS.filter((p) => p !== current);
  return pool[Math.floor(rand() * pool.length)] || PROMPTS[0];
}

export function houseColor(key) {
  const h = HOUSES.find((x) => x.key === key);
  return h ? h.color : NO_HOUSE_COLOR;
}

/* Altruismo's colour is a pale stone, so white initials disappear on it. */
export function houseInk(key) {
  return key === 'altruismo' ? '#1a1613' : '#ffffff';
}

export function houseName(key) {
  const h = HOUSES.find((x) => x.key === key);
  return h ? h.name : '';
}

export const tidyName = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v', 'vi', 'esq', 'phd', 'md']);

/** "Jamelia Johnson" -> "Jamelia J.", and "Mose James IV" -> "Mose J.", since
    a generational suffix is not the surname. Mirrors public.event_wall_name. */
export function wallName(full) {
  const parts = tidyName(full).split(' ').filter(Boolean);
  if (!parts.length) return '';
  let n = parts.length;
  while (n > 2 && SUFFIXES.has(parts[n - 1].toLowerCase().replace(/[.,]/g, ''))) n--;
  if (n === 1) return parts[0];
  return `${parts[0]} ${parts[n - 1][0].toUpperCase()}.`;
}

export function initials(label) {
  const parts = tidyName(label).replace(/\./g, '').split(' ').filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

/** US numbers to E.164, or null. Mirrors public.event_normalize_phone. */
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  if (!/^[2-9]\d{9}$/.test(d)) return null;
  return `+1${d}`;
}

/** Formats as the parent types: (404) 555-0199. */
export function formatPhoneInput(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export const validEmail = (s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(s || '').trim());

/** Returns { field: message } for anything wrong. Empty object means go. */
export function validate(form) {
  const errors = {};
  const name = tidyName(form.full_name);
  if (name.length < 2) errors.full_name = 'Add your name.';
  else if (name.split(' ').length < 2) errors.full_name = 'First and last, so the wall can say who you are.';
  else if (name.length > 80) errors.full_name = 'That name is too long.';
  if (!normalizePhone(form.phone)) errors.phone = 'Use a 10 digit US number.';
  if (!validEmail(form.email)) errors.email = 'Check your email address.';
  if (!HOUSES.some((h) => h.key === form.house)) errors.house = 'Pick your house.';
  if ((form.grades || []).some((g) => !GRADES.includes(Number(g)))) errors.grades = 'Grades are 4 through 8.';
  if (form.bringing && tidyName(form.plus_one_name).length < 2) errors.plus_one_name = 'Add their name, or turn this off.';
  return errors;
}

/** The payload event_rsvp_upsert takes. */
export function toPayload(form) {
  return {
    full_name: tidyName(form.full_name),
    phone: normalizePhone(form.phone),
    email: String(form.email || '').trim().toLowerCase(),
    house: form.house || null,
    grades: [...new Set((form.grades || []).map(Number))].sort((a, b) => a - b),
    plus_one_name: form.bringing ? tidyName(form.plus_one_name) : null,
  };
}

/** A saved RSVP (from event_rsvp_mine) back into form state for editing. */
export function fromMine(mine) {
  if (!mine) return emptyForm();
  return {
    full_name: mine.full_name || '',
    phone: formatPhoneInput(mine.phone || ''),
    email: mine.email || '',
    house: mine.house || '',
    grades: mine.grades || [],
    bringing: !!mine.plus_one_name,
    plus_one_name: mine.plus_one_name || '',
  };
}

export function emptyForm() {
  return { full_name: '', phone: '', email: '', house: '', grades: [], bringing: false, plus_one_name: '' };
}

/* Database error codes to the words a parent reads. */
const MESSAGES = {
  duplicate_phone: 'That number is already on the wall. Check your email for your link.',
  invalid_phone: 'Use a 10 digit US number.',
  invalid_email: 'Check your email address.',
  invalid_name: 'Add your first and last name.',
  invalid_house: 'Pick your house.',
  event_closed: 'RSVPs for this one are closed.',
  event_full: 'The room is full.',
  rsvp_required: 'RSVP to join the thread.',
  slow_down: 'Give it a few seconds before posting again.',
  comments_closed: 'The thread is closed.',
  invalid_body: 'Keep it under 280 characters.',
};

export function friendlyError(err) {
  const raw = String((err && (err.message || err)) || '');
  const code = Object.keys(MESSAGES).find((k) => raw.includes(k));
  return code ? MESSAGES[code] : 'That did not go through. Check your connection and try again.';
}

export function countLine(n) {
  if (!n) return 'Be the first name on the wall.';
  return n === 1 ? '1 parent is in.' : `${n} parents are in.`;
}

const TZ = 'America/New_York';

export function eventWhen(ev) {
  const s = new Date(ev.starts_at);
  const e = new Date(ev.ends_at);
  const day = s.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: TZ });
  const t = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ }).replace(':00', '');
  return { day, time: `${t(s)} to ${t(e)}` };
}

export function eyebrowDate(ev) {
  return new Date(ev.starts_at)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ })
    .toUpperCase()
    .replace('SEP ', 'SEPT ');
}

export function relativeTime(iso, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: TZ });
}

export function mapsUrl(ev) {
  const q = [ev.venue_name, ev.venue_address].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Slug from /rsvp/<slug> with or without a trailing slash. */
export function slugFromPath(pathname) {
  const m = String(pathname || '').match(/\/rsvp\/([a-z0-9-]+)\/?/i);
  return m ? m[1].toLowerCase() : null;
}

/* Merge a realtime wall event into the list: newest first, cancellations
   removed, an edit replaces the old chip in place. */
export function mergeWall(list, row) {
  const rest = list.filter((x) => x.id !== row.id);
  if (row.status && row.status !== 'going') return rest;
  const existing = list.find((x) => x.id === row.id);
  const chip = { id: row.id, wall_name: row.wall_name, house: row.house, has_plus_one: row.has_plus_one, photo_url: row.photo_url, created_at: row.created_at };
  if (existing) return list.map((x) => (x.id === row.id ? chip : x));
  return [chip, ...rest];
}

export function mergeThread(list, row) {
  const rest = list.filter((x) => x.id !== row.id);
  if (row.hidden) return rest;
  return [...rest, row].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

/** Square centre crop that fits the longest edge into `size`. */
export function squareCrop(width, height, size = 400) {
  const side = Math.min(width, height);
  return { sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), side, out: Math.min(size, side) };
}
