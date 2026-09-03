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
    tags: ['maker', 'organizer', 'giveback'],
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
    tags: ['people', 'creative', 'maker'],
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
    tags: ['creative', 'organizer', 'giveback'],
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
    tags: ['creative', 'people', 'giveback'],
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
    tags: ['creative', 'backstage', 'maker'],
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
    tags: ['people', 'backstage'],
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
    tags: ['organizer', 'backstage', 'giveback'],
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
    tags: ['giveback', 'maker'],
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
    tags: ['people', 'maker', 'backstage'],
    blurb: 'Dads, granddads, uncles, stepdads, big brothers. Any man in an RCA family.',
    what: 'Year round, heaviest around events. This group picks its own leadership.',
    does: [
      'Show up where hands are needed',
      'Parking, setup, teardown, hauling',
      'Be a visible presence in the building',
    ],
    noChair: true,
  },
];

export const byId = (id) => COMMITTEES.find((c) => c.id === id);

/* Score by how many of the parent's traits a committee carries. Ties keep the
   original order, which is roughly "biggest and most familiar first". */
export function rank(traits) {
  if (!traits.length) return COMMITTEES;
  return COMMITTEES.map((c, i) => ({
    c,
    i,
    score: c.tags.filter((t) => traits.includes(t)).length,
  }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.c);
}

export function topMatches(traits) {
  if (!traits.length) return [];
  return rank(traits).filter((c) => c.tags.some((t) => traits.includes(t))).slice(0, 4);
}
