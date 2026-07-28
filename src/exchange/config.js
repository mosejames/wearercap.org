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

export const ITEM_TYPES = [
  { id: 'polo',        label: 'RCA Polo' },
  { id: 'dress-shirt', label: 'White Dress Shirt' },
  { id: 'sweater',     label: 'Sweater / Cardigan' },
  { id: 'house',       label: 'House Apparel / Swag' },
  { id: 'bottoms',     label: 'Bottoms (Hilfiger only)' },
  { id: 'ski',         label: 'Ski Apparel / Gear' },
  { id: 'other',       label: 'Other' },
];

export const SIZES = [
  'YXS', 'YS', 'YM', 'YL', 'YXL',
  'AXS', 'AS', 'AM', 'AL', 'AXL', 'A2XL',
  'Other',
];

export const ACCEPTING = [
  'RCA shirts and sweaters',
  'House apparel and swag',
  'Like-new white dress shirts',
  'Hilfiger-only bottoms',
  'Ski apparel and gear',
];

export const NOT_ACCEPTING = [
  'Lands’ End bottoms',
  'Lands’ End Isibindi polos',
  'Buckhead Uniforms skorts',
];

export const HOUSES = [
  { id: 'altruismo', name: 'Altruismo', color: '#14110F', fg: '#FFFFFF' },
  { id: 'amistad',   name: 'Amistad',   color: '#D8202D', fg: '#FFF2F1' },
  { id: 'isibindi',  name: 'Isibindi',  color: '#1F9D57', fg: '#F0FCF5' },
  { id: 'reveur',    name: 'Rêveur',    color: '#1F55C0', fg: '#F0F5FF' },
];

export const houseById = (id) => HOUSES.find((h) => h.id === id) || null;

export const typeLabel = (id) =>
  (ITEM_TYPES.find((t) => t.id === id) || { label: id }).label;

// The QR code on every bin resolves here.
export const binUrl = (code) =>
  `https://wearercap.org/uniform-exchange/#/bin/${code}`;

// Swap questions go to the Uniform Swap chair (March 2025 slide).
export const CONTACT = {
  name: 'Sandra Mitchell',
  email: 'ladyofproverbs31@gmail.com',
};
