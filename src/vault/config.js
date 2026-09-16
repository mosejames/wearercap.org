// ---------------------------------------------------------------------------
// The vaults — everything worth changing lives here.
//
// One app, two vaults. The page says which one it is with
// <html data-vault="rcap">; with no attribute it is the Amistad Vault, so
// /ami-vault/ and every test render exactly as they did before RCAP existed.
// The database partitions on vault_*.house, so HOUSE.id is the only value
// that decides what data a page sees.
// ---------------------------------------------------------------------------

export const VAULT_ID =
  (typeof document !== 'undefined' && document.documentElement?.dataset?.vault) || 'amistad';
export const IS_SCHOOL = VAULT_ID !== 'amistad';

const HOUSES_BY_VAULT = {
  amistad: { id: 'amistad', name: 'Amistad', short: 'AMI', meaning: 'Friendship', color: '#BD0032', fg: '#FFFFFF' },
  rcap: { id: 'rcap', name: 'RCA', short: 'RCAP', meaning: 'Four houses, one school', color: '#1a2a56', fg: '#FFFFFF' },
};
export const HOUSE = HOUSES_BY_VAULT[VAULT_ID] || HOUSES_BY_VAULT.amistad;

// The four RCA houses, for the school-wide leaderboard. Colors are the
// official ones Mose confirmed in July 2026 (see src/recap/config.js).
export const RCA_HOUSES = [
  { id: 'amistad',   name: 'Amistad',   meaning: 'Friendship', color: '#D8202D' },
  { id: 'altruismo', name: 'Altruismo', meaning: 'The Givers', color: '#14110F' },
  { id: 'isibindi',  name: 'Isibindi',  meaning: 'Courage',    color: '#1F9D57' },
  { id: 'reveur',    name: 'Rêveur',    meaning: 'Dreamers',   color: '#1F55C0' },
];
export const rcaHouse = (id) => RCA_HOUSES.find((h) => h.id === id) || null;

// Every sentence that names the group. Amistad values are the original copy.
const WORDS_BY_VAULT = {
  amistad: {
    wordmark: 'AMI VAULT',
    place: 'Vault',
    placeLower: 'vault',
    footShort: 'AMI',
    topSub: 'Amistad House',
    family: 'Amistad family',
    anFamily: 'an Amistad family',
    ourFamily: 'our Amistad family',
    fam: 'Amistad fam',
    everyday: 'Everyday Amistad',
    group: 'the house',
    homeEyebrow: 'House of Friendship',
    noteTitle: 'Every child. Every smile. Our family.',
    noteBody: 'In the House of Friendship, we look out for one another and capture the joy along the way. When you take a photo, make room for the friends beside your child, too. A moment you share may be a memory another family treasures forever. This is our story, and we get to keep it together.',
    footLine: 'Amistad means friendship. The vault is what it looks like.',
    zip: 'amistad',
    badge: 'Ami Vault photo badge',
    shareImage: 'an AMI Vault image',
    topRanked: 'Ranked by the house, live. Tap the heart on anything and it moves.',
  },
  rcap: {
    wordmark: 'RCAP CAPSULE',
    place: 'Capsule',
    placeLower: 'Capsule',
    footShort: 'RCAP',
    topSub: 'Ron Clark Academy',
    family: 'RCA family',
    anFamily: 'an RCA family',
    ourFamily: 'every RCA family',
    fam: 'RCA fam',
    everyday: 'Everyday RCA',
    group: 'the school',
    homeEyebrow: 'Four houses. One school.',
    noteTitle: 'Every house. Every family. One year.',
    noteBody: 'Bingo Night, EXP, Field Day, the parent social. Every family is already taking the pictures. Add yours and they count for your house, and the whole school gets to keep them.',
    footLine: 'Photos for every RCA family, from every all-school event this year.',
    zip: 'rcap',
    badge: 'RCAP Capsule photo badge',
    shareImage: 'an RCAP Capsule image',
    topRanked: 'Ranked by every family, live. Tap the heart on anything and it moves.',
  },
};
export const WORDS = WORDS_BY_VAULT[VAULT_ID] || WORDS_BY_VAULT.amistad;

// Cards placed inside an album's photo grid, between the photos. School vault
// only. `events` lists the album slugs a card appears in. The first card
// lands after `after` photos, then it repeats every `every` photos, rotating
// through `variants` so a long scroll never shows the same words twice in a
// row. Short albums get the first card at the end. `until` is the last day it
// shows, Eastern. Nothing here touches the database.
//
// Spacing: two cards, each every 40 photos, offset by 20, is one card per 20
// photos. Present all the way down, never back to back.
export const PROMOS = IS_SCHOOL ? [
  {
    id: 'karaoke-sept-27',
    events: ['bingo-night'],
    after: 6,
    every: 40,
    until: '2026-09-27',
    cta: 'RSVP',
    href: '/karaoke',
    image: '/images/rcap-karaoke-mic.jpg',
    variants: [
      { eyebrow: 'Sun, Sept 27 · 5 to 7pm', title: 'Parent Social: R&B Karaoke', body: 'Bingo was the warm-up. Bring your best song.' },
      { eyebrow: 'Parent Social · Sept 27', title: 'Come sing with the families in these photos.', body: 'R&B karaoke, 5 to 7pm. Grab your spot.' },
    ],
  },
  {
    id: 'membership-2026',
    events: ['bingo-night'],
    after: 26,
    every: 40,
    until: '2027-05-28',
    cta: 'Join the team',
    href: 'https://www.paypal.com/ncp/payment/EWP8R298MW83A',
    external: true,
    variants: [
      { eyebrow: 'RCAP membership', title: 'We are community. We are connected.', body: 'Be part of the team of families supporting a school that gives our kids so much.' },
      { eyebrow: 'RCAP membership', title: 'Be part of the team.', body: 'Every RCA family, pulling together for the school that pours into our children.' },
      { eyebrow: 'RCAP membership', title: 'This school gives us so much.', body: 'Your membership donation is how we give back, together.' },
    ],
  },
] : [];

export const promosFor = (slug, today) =>
  PROMOS.filter((p) => p.events.includes(slug) && today <= p.until).sort((a, b) => a.after - b.after);

// Where each card lands in an album of `count` photos: [{ at, promo, card }].
// `at` is how many photos come before it; `card` is the variant to show.
export const promoSlots = (promos, count) => {
  const slots = [];
  for (const p of promos) {
    const variants = p.variants?.length ? p.variants : [p];
    for (let n = 0, at = p.after; ; n++, at += p.every || Infinity) {
      if (at > count && n > 0) break;
      slots.push({ at: Math.min(at, count), promo: p, card: { ...p, ...variants[n % variants.length] }, key: `${p.id}-${n}` });
      if (!p.every || at >= count) break;
    }
  }
  return slots.sort((x, y) => x.at - y.at);
};

export const YEAR = { label: '2026–27', short: '26–27', start: '2026-08-26', end: '2027-05-28' };

export const SITE = {
  title: IS_SCHOOL ? 'The RCAP Capsule' : 'The Amistad Vault',
  meta: [IS_SCHOOL ? 'THE RCAP CAPSULE' : 'THE AMISTAD VAULT', '2026–27'],
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
    if (p.endsWith('/')) return p;
    // Strip a filename (/ami-vault/index.html), but never a directory served
    // without its trailing slash. Vercel answers /ami-vault with the page
    // rather than redirecting to /ami-vault/, and treating that last segment
    // as a filename collapsed the base to '/', which is how an invite went
    // out as /e/<slug> instead of /ami-vault/e/<slug>.
    const cut = p.lastIndexOf('/');
    return p.slice(cut + 1).includes('.') ? p.slice(0, cut + 1) : `${p}/`;
  },
  get origin() {
    return typeof window === 'undefined' ? 'https://wearercap.org' : window.location.origin;
  },
};

// Copy on the home page around the open asks.
export const ASK = {
  eyebrow: 'Photos wanted',
  none: `Nothing open right now. Add to ${IS_SCHOOL ? 'Everyday RCA' : 'Everyday Amistad'} any time.`,
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
export const PHOTO_MASTER_MAX = 2560;
export const PHOTO_MASTER_QUALITY = 0.85;
export const WEB_MAX = 1800;     // long edge, px — the lightbox size
export const THUMB_MAX = 560;    // long edge, px — the grid size
export const WEB_QUALITY = 0.84;
export const THUMB_QUALITY = 0.8;
export const HEIC_ORIGINAL_QUALITY = 0.93;

export const MAX_BATCH = 60;           // files per pick
export const MAX_FILE_MB = 50;         // anything bigger is skipped with a note
export const UPLOAD_PARALLEL = 3;

export const ADMIN_HINT = `Back office lives at /${IS_SCHOOL ? 'rcap-capsule' : 'ami-vault'}/#/admin`;
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

/* The vault runs on school time, not device time.

   This used to read the browser's local date, which is fine in Atlanta and
   wrong everywhere else. A parent on the 7th Grade London trip is five hours
   ahead, so their vault would roll over to the next day at 7pm Eastern and
   an album would open early. Eastern is the only clock the whole house
   shares, so every date question in the app asks this one. */
export const todayISO = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: DATE_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);

// Milliseconds until 12:01am Eastern tomorrow, so a page left open overnight
// rolls over on its own instead of showing yesterday until someone reloads.
// The extra minute keeps it off the boundary, where a second of clock drift
// would land it back on the previous day.
export const msUntilNextDay = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DATE_TZ, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(now).reduce((a, x) => ({ ...a, [x.type]: Number(x.value) }), {});
  const h = parts.hour === 24 ? 0 : parts.hour;   // some engines report hour 24
  const sinceMidnight = ((h * 60 + parts.minute) * 60 + parts.second) * 1000;
  return 86_400_000 - sinceMidnight + 60_000;
};

/* One rule for whether an album takes uploads, so the button, the chooser and
   the floating action button can never disagree.

   An album opens at 12:01am Eastern on the day it happens, and then it never
   closes. Somebody finding October photos on their old phone in March is the
   vault working, not a late submission, and a time capsule that stops
   accepting the past is just an archive. Before the day it is readable but
   not writable: photos of an event that has not happened yet are either a
   mistake or somebody in the wrong album.

   There is deliberately no admin "close" here. Hiding an album, hiding a
   single upload, or moving uploads to the right album cover every real
   problem, and each of those is reversible. A closed door is not. */
export const acceptsUploads = (e, today) =>
  !!e && !e.hidden && (e.ongoing || e.kind === 'everyday' || e.startsOn <= today);

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
