/* The ten committees.

   `tags` drives the recommendation step. A parent picks how they like to show
   up, and committees carrying those tags float to the top. Nothing is hidden by
   it — "Explore all" is always one tap away — so a wrong guess costs a parent
   scrolling, never an option.

   `accent` is the card's colour block. Structural, not decorative: it is how
   you tell one committee from another at a glance in the grid.

   Copy discipline, and it is tight on purpose. `blurb` is the hook and it is
   the only prose on the card. `what` is ONE sentence and carries the timing,
   which is why there is no separate month line any more. `does` is three
   bullets and is the thing people actually decide on. No history, no
   commitment estimates, no who-it-suits line: none of that changed a mind, and
   all of it slowed the page down. If something needs more room than this, it
   belongs with the chair after they are picked. */

export const TRAITS = [
  { id: 'maker',     label: 'I like making things happen' },
  { id: 'creative',  label: "I'm creative" },
  { id: 'backstage', label: 'I like working behind the scenes' },
  { id: 'people',    label: 'Put me where the people are' },
  { id: 'organizer', label: "I'm good at organizing" },
  { id: 'giveback',  label: 'I want to give back' },
];

export const HOUSES = ['Altruismo', 'Amistad', 'Isibindi', 'Rêveur', 'Not sorted yet'];

export const CLASS_YEARS = ['2027', '2028', '2029', '2030', '2031', '2032'];

export const COMMITTEES = [
  {
    id: 'raffle',
    name: 'Fall Raffle',
    accent: 'orange',
    tags: ['maker', 'organizer'],
    blurb: 'The fundraiser that pays for everything we do for the teachers.',
    what: 'Tickets sell through October, and the drawing is mid November.',
    does: [
      'Set the ticket price and build the prize list',
      'Chase prize donations',
      'Run the drawing',
    ],
  },
  {
    id: 'trunk',
    name: 'Trunk or Treat',
    accent: 'gold',
    tags: ['maker', 'creative', 'people', 'organizer'],
    blurb: 'Halloween in the parking lot. Each house decorates a section and the kids work the cars.',
    what: 'Late October, and the chair seat is open.',
    does: [
      'Lay out the house sections',
      'Get a lead in every house, all four',
      'Sort candy and bags, and set up that day',
    ],
  },
  {
    id: 'taw',
    name: 'Teacher Appreciation Week',
    accent: 'magenta',
    tags: ['creative', 'organizer'],
    blurb: 'One week in May that tells this staff what they are worth to us.',
    what: 'A chair and co-chair own the week, and each class takes a day inside one theme.',
    does: [
      'Poll the teachers first',
      'Set the theme and hold the budget',
      'Give each class its day',
    ],
  },
  {
    id: 'fourdays',
    name: '4 Days of Christmas',
    accent: 'red',
    tags: ['creative', 'people'],
    blurb: 'Your class picks a day in December and spoils the staff rotten.',
    what: 'One day in December, run by your class.',
    does: [
      'Rally the parents in your class',
      'Decide what your day looks like',
      'Set it up that morning',
    ],
  },
  {
    id: 'decor',
    name: 'Holiday Decor',
    accent: 'green',
    tags: ['maker', 'creative', 'backstage'],
    blurb: 'Two weekends that turn the whole building into something kids remember.',
    what: 'One weekend up in November, a short one down after Christmas.',
    does: [
      'Plan what goes where',
      'Source trees, lights, and decor',
      'Work the setup weekend',
    ],
  },
  {
    id: 'concessions',
    name: 'Concessions',
    accent: 'blue',
    tags: ['backstage', 'people', 'organizer'],
    blurb: 'Basketball season, the stand, and a shift you can actually commit to.',
    what: 'Home games only, roughly November through February.',
    does: [
      'Stock the stand and set prices',
      'Build the shift schedule',
      'Work games and handle the cash box',
    ],
  },
  {
    id: 'uniform',
    name: 'Uniform Swap',
    accent: 'gold',
    tags: ['backstage', 'organizer'],
    blurb: 'Outgrown pieces from one family, straight to the family that needs them.',
    what: 'Steady all year, busiest in August and January.',
    does: [
      'Sort donations by size and piece',
      'Match requests to what is on hand',
      'Coordinate handoffs at carline',
    ],
  },
  {
    id: 'marcom',
    name: 'Marketing and Communications',
    accent: 'magenta',
    tags: ['creative', 'people'],
    blurb: 'So the parent who is at work at 9am still gets to see House Cheers.',
    what: 'A small team on photo, video, and writing, year round.',
    does: [
      'Shoot and edit at events',
      'Run the Instagram and the parent newsletter',
      'Go live from House Cheers on Fridays',
    ],
  },
  {
    id: 'service',
    name: 'Community Service',
    accent: 'green',
    tags: ['maker', 'organizer', 'people', 'giveback'],
    blurb: 'The one that has not been built yet. Come help decide what it is.',
    what: 'Board-led and school-wide, with the first push around December.',
    does: [
      'Decide what our service effort is',
      'Build the first one',
      'Bring the whole school into it',
    ],
  },
  {
    id: 'men',
    name: 'Men of RCAP',
    accent: 'ink',
    tags: ['maker', 'backstage', 'people'],
    blurb: 'Dads, granddads, uncles, stepdads, big brothers. Any man in an RCA family.',
    what: 'Year round, heaviest around events. This group picks its own leadership.',
    does: [
      'Show up where hands are needed',
      'Parking, setup, teardown, hauling',
      'Be a visible presence in the building',
    ],
    noChair: true,
    // Self-governing and open to any man in an RCA family, so it does not
    // compete for recommendation slots against committees that need
    // recruiting. Still listed under Explore all.
    noMatch: true,
  },
];

export const byId = (id) => COMMITTEES.find((c) => c.id === id);

const MATCHABLE = COMMITTEES.filter((c) => !c.noMatch);

/* How many matchable committees carry each trait. */
const FREQ = MATCHABLE.reduce((m, c) => {
  c.tags.forEach((t) => { m[t] = (m[t] || 0) + 1; });
  return m;
}, {});

/* Scoring.

   Counting matched tags and breaking ties by list order was wrong, and wrong in
   a way that looked plausible: every tie went to whichever committee sat higher
   in the catalog, which is roughly "biggest and most familiar first". So Fall
   Raffle and Teacher Appreciation Week won nearly every tie, and picking only
   "I want to give back" did not surface Community Service at all.

   Two corrections. A trait carried by three committees says more about a parent
   than one carried by eight, so each match is worth 1/frequency. And a
   committee carrying many tags would otherwise match everything, so the total
   is divided by the square root of its tag count. Breadth stops being an
   advantage; being genuinely about the thing starts being one. */
function score(c, traits) {
  if (!traits.length || c.noMatch) return 0;
  const raw = c.tags.reduce((n, t) => n + (traits.includes(t) && FREQ[t] ? 1 / FREQ[t] : 0), 0);
  return raw / Math.sqrt(c.tags.length);
}

export function rank(traits) {
  if (!traits.length) return COMMITTEES;
  return COMMITTEES
    .map((c, i) => ({ c, i, s: score(c, traits) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.c);
}

/* Five rather than four. With ten committees a fifth costs one card of
   scrolling and stops a near-miss from being invisible. */
export function topMatches(traits) {
  if (!traits.length) return [];
  return COMMITTEES
    .map((c, i) => ({ c, i, s: score(c, traits) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, 5)
    .map((x) => x.c);
}
