// ---------------------------------------------------------------------------
// The RCAP Uniform Exchange — everything worth changing lives here.
// Accepting / not-accepting lists come from the Uniform Swap slide
// (March 2025 meeting). Update them here and the site follows.
// ---------------------------------------------------------------------------

export const SITE = {
  meta: ['RCAP UNIFORM EXCHANGE', 'PARENT TO PARENT'],
  kicker: 'The RCAP Uniform Exchange',
  titleLead: 'UNIFORMS THAT',
  titleGrad: 'KEEP MOVING.',
  intro:
    'Gently loved uniforms live in bins held by RCAP parents. Tell us what ' +
    'your student needs and we\u2019ll find it, then pick a handoff that fits ' +
    'your week \u2014 at carline, or straight from student to student.',
};

// Kept for the front-desk mode, which is built but switched off in settings.
export const FRONT_DESK_DAYS = 3;

// Counts are approximate on purpose. Say so everywhere it matters.
// Fit preferences go here rather than doubling the size list.
export const FIT_HINT = 'Slim, husky or plus fit — anything that helps';

export const APPROX_NOTE =
  'Counts are approximate — bins are living things. If something is off, just adjust it.';

// Item types live in the database (ue_item_types) so the admin can hide or
// restore them without a deploy. This is the boot fallback until they load;
// setItemTypes() replaces it with the live rows.
const DEFAULT_TYPES = [
  { id: 'polo',         label: 'RCA House Polo · Boys',  housed: true,  hidden: false, size_set: 'tops' },
  { id: 'polo-girls',   label: 'RCA House Polo · Girls', housed: true,  hidden: false, size_set: 'girls-tops' },
  { id: 'dress-shirt',  label: 'White Dress Shirt',   housed: false, hidden: false, size_set: 'tops' },
  { id: 'vest',         label: 'Vest',                housed: true,  hidden: false, size_set: 'tops' },
  { id: 'pants-girls',  label: 'Khaki Pants · Girls', housed: false, hidden: false, size_set: 'girls-bottoms' },
  { id: 'pants-boys',   label: 'Khaki Pants · Boys',  housed: false, hidden: false, size_set: 'boys-bottoms' },
  { id: 'shorts-girls', label: 'Khaki Shorts · Girls',housed: false, hidden: false, size_set: 'girls-bottoms' },
  { id: 'shorts-boys',  label: 'Khaki Shorts · Boys', housed: false, hidden: false, size_set: 'boys-bottoms' },
  { id: 'skirt',        label: 'Khaki Skirt',         housed: false, hidden: false, size_set: 'girls-bottoms' },
];

let TYPES = [...DEFAULT_TYPES];

export function setItemTypes(rows) {
  if (rows && rows.length) TYPES = rows;
}
export const allItemTypes = () => TYPES;
export const visibleItemTypes = () => TYPES.filter((t) => !t.hidden);
export const typeHoused = (id) => !!TYPES.find((t) => t.id === id)?.housed;

// ---------------------------------------------------------------------------
// Sizes depend on the item. Girls' bottoms run 7–16; boys' bottoms run 8–20
// with slim and husky cuts, then straight into young men's waist sizes. Tops
// stay on letter sizes, with the numeric equivalent spelled out so a parent who
// only knows "he's a 12" can still find it.
//
// Checked against Tommy Hilfiger's kids guide (Big Boys 8–20, Big Girls 7–16,
// girls' tops XXS–XL), since RCA uniforms are Hilfiger-only.
// ---------------------------------------------------------------------------
const n = (v, label) => ({ v, label: label || v });

export const SIZE_SETS = {
  tops: [
    { group: 'Youth', sizes: [
      n('YXS', 'YXS · 4–5'), n('YS', 'YS · 6–7'), n('YM', 'YM · 8–10'),
      n('YL', 'YL · 12–14'), n('YXL', 'YXL · 16–18'),
    ] },
    { group: 'Adult', sizes: [
      n('AXS', 'Adult XS'), n('AS', 'Adult S'), n('AM', 'Adult M'),
      n('AL', 'Adult L'), n('AXL', 'Adult XL'), n('A2XL', 'Adult 2XL'),
    ] },
    { group: '', sizes: [n('Other')] },
  ],

  // Girls' polos don't run on the youth scale. Tommy Hilfiger sells girls'
  // tops as XXS–XL over sizes 4–16 (Big Girls: S=7, M=8–10, L=12–14, XL=16),
  // then straight into juniors — so that's what a family sees, with the
  // numbers spelled out for anyone who only knows "she's a 10".
  'girls-tops': [
    { group: 'Girls', sizes: [
      n('GXS', 'Girls XS · 4–6'), n('GS', 'Girls S · 7'), n('GM', 'Girls M · 8–10'),
      n('GL', 'Girls L · 12–14'), n('GXL', 'Girls XL · 16'),
    ] },
    { group: 'Juniors', sizes: [
      n('JXS', 'Juniors XS'), n('JS', 'Juniors S'), n('JM', 'Juniors M'),
      n('JL', 'Juniors L'), n('JXL', 'Juniors XL'),
    ] },
    { group: '', sizes: [n('Other')] },
  ],

  'girls-bottoms': [
    { group: 'Girls', sizes: [n('7'), n('8'), n('10'), n('12'), n('14'), n('16')] },
    { group: 'Juniors', sizes: [
      n('Jr 0', 'Juniors 0'), n('Jr 1', 'Juniors 1'), n('Jr 3', 'Juniors 3'),
      n('Jr 5', 'Juniors 5'), n('Jr 7', 'Juniors 7'), n('Jr 9', 'Juniors 9'),
      n('Jr 11', 'Juniors 11'),
    ] },
    { group: '', sizes: [n('Other')] },
  ],

  'boys-bottoms': [
    { group: 'Boys', sizes: [
      n('8'), n('10'), n('12'), n('14'), n('16'), n('18'), n('20'),
    ] },
    { group: "Young men's waist", sizes: [
      n('W28', '28 waist'), n('W29', '29 waist'), n('W30', '30 waist'),
      n('W31', '31 waist'), n('W32', '32 waist'), n('W34', '34 waist'), n('W36', '36 waist'),
    ] },
    { group: '', sizes: [n('Other')] },
  ],
};

export const SIZE_SET_LABEL = {
  tops: 'Shirts & vests',
  'girls-tops': "Girls' polos",
  'girls-bottoms': "Girls' bottoms",
  'boys-bottoms': "Boys' bottoms",
};

// Which set an item type uses. Unknown types fall back to tops.
export const sizeSetFor = (typeId) =>
  (TYPES.find((t) => t.id === typeId) || {}).size_set || 'tops';

// Grouped options for a dropdown. No item chosen on the browse page means
// every set, labelled so "10" from girls and "10" from boys stay distinct.
export function sizeGroups(typeId) {
  if (typeId) return SIZE_SETS[sizeSetFor(typeId)] || SIZE_SETS.tops;
  const out = [];
  for (const [key, groups] of Object.entries(SIZE_SETS)) {
    for (const g of groups) {
      if (!g.group) continue;
      out.push({ group: `${SIZE_SET_LABEL[key]} · ${g.group}`, sizes: g.sizes });
    }
  }
  out.push({ group: '', sizes: [n('Other')] });
  return out;
}

// Every size value that exists, for validation and fallbacks.
export const allSizes = () =>
  Object.values(SIZE_SETS).flatMap((gs) => gs.flatMap((g) => g.sizes.map((x) => x.v)));

// Slim, husky and plus used to be their own options. They're a fit
// preference, not a size, so they live in "anything else" now — but bins
// logged before that change still hold them, and they should read properly.
const LEGACY_LABELS = {
  '8S': '8 Slim', '10S': '10 Slim', '12S': '12 Slim', '14S': '14 Slim',
  '16S': '16 Slim', '18S': '18 Slim', '20S': '20 Slim',
  '10H': '10 Husky', '12H': '12 Husky', '14H': '14 Husky',
  '16H': '16 Husky', '18H': '18 Husky', '20H': '20 Husky',
  '8.5': '8½ Plus', '10.5': '10½ Plus', '12.5': '12½ Plus',
  '14.5': '14½ Plus', '16.5': '16½ Plus',
};

// A stored size rendered for humans; unknown values pass straight through so
// nothing logged before this change ever displays as a blank.
export function sizeLabel(v) {
  for (const groups of Object.values(SIZE_SETS)) {
    for (const g of groups) {
      const hit = g.sizes.find((x) => x.v === v);
      if (hit) return hit.label;
    }
  }
  return LEGACY_LABELS[v] || v;
}

// A bare number in a chip reads like a quantity: "Khaki Pants · Boys [12]"
// looks like twelve pairs of pants, not a size 12. Letter sizes ("YM · 8–10")
// and waists ("28 waist") say what they are already — the plain numbers don't,
// so say it for them.
export const sizeChip = (v) => {
  const l = sizeLabel(v);
  return /^\d+$/.test(l) ? `Size ${l}` : l;
};

// The first sensible default for a given item type.
export const firstSize = (typeId) => (sizeGroups(typeId)[0]?.sizes[0]?.v) || 'YM';

// A light touch, not a lecture. These are parents who already know what a
// good hand-me-down looks like — this just tilts the head toward it.
export const DONATION_STANDARD = {
  title: 'A quick reminder',
  body:
    'Whatever goes into a bin turns up on somebody else\u2019s child on a school ' +
    'morning \u2014 so: gently loved, freshly washed, stain-free, still true in color.',
};

export const HOUSES = [
  { id: 'altruismo', name: 'Altruismo', color: '#14110F', fg: '#FFFFFF' },
  { id: 'amistad',   name: 'Amistad',   color: '#D8202D', fg: '#FFF2F1' },
  { id: 'isibindi',  name: 'Isibindi',  color: '#1F9D57', fg: '#F0FCF5' },
  { id: 'reveur',    name: 'Rêveur',    color: '#1F55C0', fg: '#F0F5FF' },
];

export const houseById = (id) => HOUSES.find((h) => h.id === id) || null;

// Uniforms are broken up by houses: an Isibindi polo only helps an Isibindi
// family. '' means house-neutral (white dress shirts, bottoms, ski gear).
export const ANY_HOUSE = { id: '', name: 'Any house', color: '#efeae1', fg: '#1a1613' };
export const HOUSE_CHOICES = [ANY_HOUSE, ...HOUSES];
export const houseInfo = (id) => houseById(id) || ANY_HOUSE;

// Types where the house picker defaults to a house instead of "Any house".
export const typeLabel = (id) =>
  (TYPES.find((t) => t.id === id) || { label: id }).label;

// ---------------------------------------------------------------------------
// Links people actually send.
//
// The app is a hash router, and a fragment never reaches the server — so a
// scraper building a message preview only ever saw the one static page, and
// every link in the system looked identical in a thread. These short paths hit
// a tiny function that answers with tags written for that destination, then
// bounces the visitor into the app. The old `#/…` links still work, printed
// QR labels included.
// ---------------------------------------------------------------------------
const ROOT = 'https://wearercap.org/uniform-exchange';

// The QR code on every bin resolves here. Shorter URL, simpler code, easier scan.
export const binUrl = (code) => `${ROOT}/b/${code}`;
export const holderUrl = (token) => `${ROOT}/h/${token}`;
export const myUrl = (token) => `${ROOT}/m/${token}`;

// The bin-coordinator seat is open right now — questions go to the RCAP
// inbox until it's filled. Swap in a name + email here when it is.
export const CONTACT = {
  name: '',
  email: 'hello@wearercap.org',
};

// ---------------------------------------------------------------------------
// Phone numbers. People type "+1 404 555 1212", "(404) 555-1212", "404.555.1212"
// and "14045551212" and mean the same thing, so every comparison runs on digits
// and every display runs through here. Storage is E.164 so there's one
// canonical form in the database.
// ---------------------------------------------------------------------------
export function phoneDigits(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') return d.slice(1);
  if (d.length === 10) return d;
  return '';
}

export function prettyPhone(v) {
  const d = phoneDigits(v);
  if (!d) return String(v || '');
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export const samePhone = (a, b) => {
  const x = phoneDigits(a);
  return !!x && x === phoneDigits(b);
};
