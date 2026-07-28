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
    'Gently loved uniforms live in QR-coded bins held by RCAP parents. ' +
    'Search every bin, request what your student needs, and the bin holder ' +
    'drops it at the RCA front desk within three days.',
};

export const FRONT_DESK_DAYS = 3;

// Counts are approximate on purpose. Say so everywhere it matters.
export const APPROX_NOTE =
  'Counts are approximate — bins are living things. If something is off, just adjust it.';

// Item types live in the database (ue_item_types) so the admin can hide or
// restore them without a deploy. This is the boot fallback until they load;
// setItemTypes() replaces it with the live rows.
const DEFAULT_TYPES = [
  { id: 'polo',        label: 'RCA House Polo',    housed: true,  hidden: false },
  { id: 'dress-shirt', label: 'White Dress Shirt', housed: false, hidden: false },
  { id: 'vest',        label: 'Vest',              housed: true,  hidden: false },
  { id: 'pants',       label: 'Khaki Pants',       housed: false, hidden: false },
  { id: 'shorts',      label: 'Khaki Shorts',      housed: false, hidden: false },
  { id: 'skirt',       label: 'Khaki Skirt',       housed: false, hidden: false },
];

let TYPES = [...DEFAULT_TYPES];

export function setItemTypes(rows) {
  if (rows && rows.length) TYPES = rows;
}
export const allItemTypes = () => TYPES;
export const visibleItemTypes = () => TYPES.filter((t) => !t.hidden);
export const typeHoused = (id) => !!TYPES.find((t) => t.id === id)?.housed;

export const SIZES = [
  'YXS', 'YS', 'YM', 'YL', 'YXL',
  'AXS', 'AS', 'AM', 'AL', 'AXL', 'A2XL',
  'Other',
];

// What we're hoping for, said warmly. Every piece in a bin turns up on a
// school morning for somebody's kid — that's the whole standard.
export const DONATION_STANDARD = {
  title: 'What makes a great donation',
  intro:
    'Everything that goes into a bin turns up on a school morning for somebody else’s ' +
    'child. So the bar is a loving one: send what you’d be glad to see come home.',
  points: [
    {
      icon: '💚',
      t: 'Gently loved',
      d: 'Outgrown, not worn out — with real school years still left in it.',
    },
    {
      icon: '🧼',
      t: 'Freshly washed',
      d: 'Straight from your machine to the bin. Every single time.',
    },
    {
      icon: '✨',
      t: 'Stain-free',
      d: 'Nothing a wash didn’t lift, and every button and zipper still doing its job.',
    },
    {
      icon: '🌈',
      t: 'True color',
      d: 'Still deep and even — not sun-faded, thinned out, or gone gray.',
    },
  ],
  close:
    'The test we use: would you be happy if this showed up for your own child on the ' +
    'first day of school? If the answer is yes, it’s exactly what we’re looking for.',
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

// The QR code on every bin resolves here.
export const binUrl = (code) =>
  `https://wearercap.org/uniform-exchange/#/bin/${code}`;

// The bin-coordinator seat is open right now — questions go to the RCAP
// inbox until it's filled. Swap in a name + email here when it is.
export const CONTACT = {
  name: '',
  email: 'hello@wearercap.org',
};
