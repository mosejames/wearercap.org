// ---------------------------------------------------------------------------
// The M³ Vault: everything worth changing lives here.
// Mall Math Marathon, Class of 2028, Tuesday September 15, 2026, Lenox Mall.
// ---------------------------------------------------------------------------

export const VAULT = {
  id: 'm3-2028',
  name: 'Mall Math Marathon',
  short: 'M³',
  group: 'Class of 2028',
  host: 'Dr. J',
  // Placeholder palette until the real colors are named. Chrome is what the
  // top bar, hero and footer wear; accent is buttons. White on the chrome
  // measures above 12:1, dark ink on the accent above 10:1.
  chrome: '#14213d',
  accent: '#fca311',
  fg: '#ffffff',
};

export const DAY = { date: '2026-09-15', label: 'Tuesday, September 15', place: 'Lenox Mall' };

export const SITE = {
  title: 'M³ Vault',
  kicker: 'One class. One day. Every photo.',
  intro:
    'Thirteen chaperones, seven-plus teams, one mall. Add what you shoot as the day happens and Dr. J gets the whole marathon tonight, in order, with every team in it.',
  // Derived at runtime so share links are right at /m3-vault/ and at
  // /m3-vault (Vercel serves the bare path without redirecting).
  get base() {
    if (typeof window === 'undefined') return '/';
    const p = window.location.pathname;
    if (p.endsWith('/')) return p;
    const cut = p.lastIndexOf('/');
    return p.slice(cut + 1).includes('.') ? p.slice(0, cut + 1) : `${p}/`;
  },
  get origin() {
    return typeof window === 'undefined' ? 'https://wearercap.org' : window.location.origin;
  },
};

export const ASK = {
  eyebrow: 'Photos wanted',
  none: 'Nothing open right now. Around the Mall takes anything, any time.',
};

// Suggestions of what to capture. Not albums: one tap drops the line into the
// caption so the vault can later answer "show me every huddle".
export const SHOT_LIST = [
  'The huddle',
  'Reading the price tag',
  'Mission sheet mid-work',
  'The long way around',
  'The face when the math clicks',
  'Just browsing',
  'Finish line at the food court',
  'Team photo',
];

export const KINDS = {
  moment:   { label: 'Moment',   short: 'M³' },
  everyday: { label: 'Any time', short: 'Any' },
};

export const MAX_BATCH = 60;
export const MAX_FILE_MB = 50;
export const UPLOAD_PARALLEL = 3;

export const CONTACT = 'mose@mosejames.com';
export const DATE_TZ = 'America/New_York';

/* The vault runs on Atlanta time, not device time. Every date question in the
   app asks this one function. */
export const todayISO = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: DATE_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);

export const msUntilNextDay = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DATE_TZ, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(now).reduce((a, x) => ({ ...a, [x.type]: Number(x.value) }), {});
  const h = parts.hour === 24 ? 0 : parts.hour;
  const sinceMidnight = ((h * 60 + parts.minute) * 60 + parts.second) * 1000;
  return 86_400_000 - sinceMidnight + 60_000;
};

/* One rule for whether an album takes uploads. Opens at 12:01am Eastern on
   the day, then never closes. The database says the same thing in
   m3_can_upload(); this is the copy the buttons read so they never disagree
   with the insert policy. <=, not <. */
export const acceptsUploads = (e, today) =>
  !!e && !e.hidden && (e.ongoing || e.kind === 'everyday' || e.startsOn <= today);

export const fmtDate = (iso, opts = {}) => {
  if (!iso) return '';
  const d = typeof iso === 'string' && iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: DATE_TZ, ...opts });
};

export const fmtTime = (hms) => {
  if (!hms) return '';
  const [h, m] = hms.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const hh = ((h + 11) % 12) + 1;
  return m ? `${hh}:${String(m).padStart(2, '0')}${ap}` : `${hh}${ap}`;
};

export const fmtWhen = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: DATE_TZ }) : '';

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const fmtBytes = (n) => {
  if (!n) return '0 B';
  if (n < 1e6) return `${Math.round(n / 1e3)} KB`;
  if (n < 1e9) return `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0)} MB`;
  return `${(n / 1e9).toFixed(2)} GB`;
};
