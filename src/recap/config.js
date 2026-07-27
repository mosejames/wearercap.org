// ---------------------------------------------------------------------------
// The RCAP Recap — everything worth changing lives here.
// House colors come straight from the site palette in src/styles.css.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ROUNDS
// The Recap is a fixture, not a one-off. Each time you want to fire one up —
// after EXP, after bingo night, after House Mania — add a new object to the
// TOP of this list with a fresh slug and a closing date. The board keeps
// every past round; only the newest one accepts new entries.
// ---------------------------------------------------------------------------
export const ROUNDS = [
  {
    slug: 'esp-2026',
    name: 'Summer EXP',
    label: 'SUMMER EXP · 2026',
    prompt: 'this summer',
    closesAt: '2026-08-02T23:59:59-04:00',
    goal: 100,
  },
];

export const CURRENT = ROUNDS[0];

export const SITE = {
  meta: ['THE RCAP RECAP', 'PARENT VOICES'],
  kicker: 'The RCAP Recap',
  titleLead: 'DESCRIBE EXP',
  titleGrad: 'IN ONE WORD.',
  intro:
    'EXP was powered by parents like you. Tell us how it felt with one word, a quick note, or a selfie. Join the recap in under 30 seconds.',
  wordLead: 'Tap your answer',
};

// Official house colors, confirmed by Mose (July 2026):
// Altruismo is the Black House, Amistad the Red House,
// Isibindi the Green House, Rêveur the Blue House.
export const HOUSES = [
  { id: 'altruismo', name: 'Altruismo', meaning: 'The Givers', color: '#14110F', fg: '#FFFFFF' },
  { id: 'amistad',   name: 'Amistad',   meaning: 'Friendship', color: '#D8202D', fg: '#FFF2F1' },
  { id: 'isibindi',  name: 'Isibindi',  meaning: 'Courage',    color: '#1F9D57', fg: '#F0FCF5' },
  { id: 'reveur',    name: 'Rêveur',    meaning: 'Dreamers',   color: '#1F55C0', fg: '#F0F5FF' },
];

// Class of 2031 has no house yet — they stay white until they're sorted.
// pale: true adds a border so white cards read on the white board.
export const UNSORTED = {
  id: 'tbd', name: 'Class of 2031', meaning: 'Sorted soon',
  color: '#FFFFFF', fg: '#1a1613', pale: true,
};

// Parents with kids in more than one house don't pick a single lane — they get
// the flame. It's the whole "Four houses. One RCAP." idea in one card.
export const MULTI = {
  id: 'multi', name: 'Across houses', pickLabel: 'More than one house',
  meaning: 'Four houses, one family', color: '#E0218A', fg: '#FFFFFF', flame: true,
};

export const CLASSES = ['2027', '2028', '2029', '2030', '2031', '2032'];
export const FIRST_SUMMER_CLASS = '2031';
export const RELATIONS = ['Mom', 'Dad', 'Grandparent', 'Auntie', 'Uncle', 'Bonus Parent', 'Guardian'];

// Preset words keep the tallies clustering; parents can also write their own.
export const WORDS = [
  { id: 'inspired',  label: 'Inspired' },
  { id: 'welcomed',  label: 'Welcomed' },
  { id: 'connected', label: 'Connected' },
  { id: 'energized', label: 'Energized' },
  { id: 'proud',     label: 'Proud' },
  { id: 'grateful',  label: 'Grateful' },
  { id: 'seen',      label: 'Seen' },
  { id: 'joyful',    label: 'Joyful' },
  { id: 'exhausted', label: 'Exhausted' },
  { id: 'family',    label: 'Family' },
  { id: 'home',      label: 'Home' },
];
export const WORD_MAX = 20;

export const WORD_PROMPT = 'One word for your EXP';
export const WORD_HINT = 'tap one, or write your own';
export const LINE_PROMPT = 'Why was it worth it?';
export const LINE_HINT = 'one line — no wrong answer';
export const LINE_PLACEHOLDER = 'A moment, a person, something you didn’t expect…';

// Story prompts. Each submission is randomly assigned one, with a shuffle
// button to rotate. Every prompt completes itself naturally, so the board
// fills with different kinds of stories instead of 500 identical ones.
export const PROMPTS = [
  'One thing I’ll remember is…',
  'The best part was…',
  'I left feeling…',
  'I can’t wait to…',
  'Something that surprised me…',
  'One moment that stood out…',
  'I met…',
  'I smiled when…',
  'EXP reminded me…',
  'Next year I hope…',
  'One thing I want people to know…',
  'I volunteered because…',
  'My favorite memory…',
  'This experience showed me…',
  'I didn’t expect…',
  'One thing that made me proud…',
];

export const randomPrompt = (not) => {
  const pool = not ? PROMPTS.filter((p) => p !== not) : PROMPTS;
  return pool[Math.floor(Math.random() * pool.length)];
};

export const HOURS_URL = 'https://www.trackitforward.com/site/the-ron-clark-academy';
export const HASHTAGS = ['#RCAEXP', '#RCAPINSPIRED', '#RONCLARKACADEMY'];
export const ADMIN_HINT = 'Back office lives at /rcap-recap/#admin';

export const roundBySlug = (slug) => ROUNDS.find((r) => r.slug === slug) || CURRENT;

// Preset ids map to their label; a custom word renders as typed, capitalized.
export const wordLabel = (id) => {
  const hit = WORDS.find((w) => w.id === id);
  if (hit) return hit.label;
  const t = String(id || '').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
export const houseById = (id) => {
  if (id === MULTI.id) return MULTI;
  if (id === UNSORTED.id) return UNSORTED;
  return HOUSES.find((h) => h.id === id) || UNSORTED;
};
