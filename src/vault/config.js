// ---------------------------------------------------------------------------
// The Amistad Vault — everything worth changing lives here.
// ---------------------------------------------------------------------------

export const HOUSE = {
  id: 'amistad',
  name: 'Amistad',
  short: 'AMI',
  meaning: 'Friendship',
  color: '#D8202D',
  fg: '#FFF2F1',
};

export const YEAR = { label: '2026–27', short: '26–27', start: '2026-08-26', end: '2027-05-28' };

export const SITE = {
  title: 'The Amistad Vault',
  meta: ['THE AMISTAD VAULT', '2026–27'],
  kicker: 'One house. One school year. Every photo.',
  titleLead: 'THE AMISTAD',
  titleGrad: 'VAULT.',
  intro:
    'Every family is already taking the pictures. This is where they go so the whole house can see them, keep them, and still have them in ten years. Add yours from your phone in under a minute.',
  // Derived at runtime, not hardcoded, so share links are right whether this
  // is served at wearercap.org/ami-vault/ or at its own domain.
  get base() {
    if (typeof window === 'undefined') return '/';
    const p = window.location.pathname;
    return p.endsWith('/') ? p : `${p.slice(0, p.lastIndexOf('/'))}/`;
  },
  get origin() {
    return typeof window === 'undefined' ? 'https://wearercap.org' : window.location.origin;
  },
};

// Copy on the home page around the open asks.
export const ASK = {
  eyebrow: 'Photos wanted',
  none: 'Nothing open right now. Add to Everyday Amistad any time.',
};

export const KINDS = {
  house:     { label: 'House',     short: 'AMI' },
  school:    { label: 'School',    short: 'RCA' },
  trip:      { label: 'Trip',      short: 'Trip' },
  milestone: { label: 'Milestone', short: '★' },
  everyday:  { label: 'Everyday',  short: 'Daily' },
};

// Rendition sizes generated on the phone before upload. The original is kept
// untouched (or converted to a full-size JPEG if it arrived as HEIC).
export const WEB_MAX = 1800;     // long edge, px — the lightbox size
export const THUMB_MAX = 560;    // long edge, px — the grid size
export const WEB_QUALITY = 0.84;
export const THUMB_QUALITY = 0.8;
export const HEIC_ORIGINAL_QUALITY = 0.93;

export const MAX_BATCH = 60;           // files per pick
export const MAX_FILE_MB = 50;         // anything bigger is skipped with a note
export const UPLOAD_PARALLEL = 3;

export const ADMIN_HINT = 'Back office lives at /ami-vault/#/admin';
export const CONTACT = 'mose@mosejames.com';

export const DATE_TZ = 'America/New_York';

export const fmtDate = (iso, opts = {}) => {
  if (!iso) return '';
  const d = typeof iso === 'string' && iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...opts });
};

export const fmtRange = (a, b) => {
  if (!b || b === a) return fmtDate(a);
  const da = new Date(`${a}T12:00:00`), db = new Date(`${b}T12:00:00`);
  if (da.getMonth() === db.getMonth()) return `${fmtDate(a)}–${db.getDate()}`;
  return `${fmtDate(a)} – ${fmtDate(b)}`;
};

export const monthKey = (iso) => iso.slice(0, 7);
export const monthLabel = (key) =>
  new Date(`${key}-15T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

export const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
