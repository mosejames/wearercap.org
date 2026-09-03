/* The nine committees.

   `tags` drives the recommendation step. A parent picks how they like to show
   up, and committees carrying those tags float to the top. Nothing is hidden by
   it — "Explore all" is always one tap away — so a wrong guess costs a parent
   scrolling, never an option.

   `accent` is the card's colour block. Structural, not decorative: it is how
   you tell one committee from another at a glance in the grid.

   Copy discipline: `what` is two sentences, `does` is three bullets, `who` is
   one line. Details is a nudge toward a decision, not a briefing. Anything
   needing more room than this belongs in the chair's hands after they are
   picked, not on a card a parent is skimming in a gym. */

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
    when: 'September to mid November',
    commitment: 'Heavy for six weeks, then done',
    what: 'Our biggest fundraiser, and the money is what pays for Teacher Appreciation Week in the spring. Five weeks of selling, then the drawing in November.',
    does: [
      'Set the ticket price and build the prize list',
      'Chase prize donations from local businesses',
      'Run the drawing',
    ],
    who: 'For people who like a goal and a number to beat.',
  },
  {
    id: 'taw',
    name: 'Teacher Appreciation Week',
    accent: 'magenta',
    tags: ['creative', 'organizer', 'giveback'],
    blurb: 'One week in May that tells this staff what they are worth to us.',
    when: 'Planning in March, the week itself in May',
    commitment: 'Quiet until spring, then all-in for a week',
    what: 'The oldest thing RCAP does, every spring since 2011. New this year: a chair and co-chair own the week and its budget, and each class takes a day inside one theme.',
    does: [
      'Poll the teachers before anything gets planned',
      'Set the theme and hold the budget',
      'Give each class its day and its guidelines',
    ],
    who: 'For people with taste and follow-through.',
  },
  {
    id: 'fourdays',
    name: '4 Days of Christmas',
    accent: 'red',
    tags: ['creative', 'people', 'giveback'],
    blurb: 'Your class picks a day in December and spoils the staff rotten.',
    when: 'Sign up in November, the week is in December',
    commitment: 'One day. Genuinely.',
    what: "During RCA's holiday week each class takes one day and showers the staff. Not the same as Holiday Decor: that team puts the school up, this one runs the days.",
    does: [
      'Rally the parents in your class',
      'Decide what your day looks like',
      'Set it up that morning',
    ],
    who: 'The easiest way in if you have never done this before.',
  },
  {
    id: 'decor',
    name: 'Holiday Decor',
    accent: 'green',
    tags: ['creative', 'backstage', 'maker'],
    blurb: 'Two weekends that turn the whole building into something kids remember.',
    when: 'Setup weekend in November, teardown after Christmas',
    commitment: 'Two weekends, hands-on',
    what: 'Parents turn the whole school over for the holidays, a tradition since the first tree lighting in 2011. One weekend up in November, a short one down after Christmas.',
    does: [
      'Plan what goes where and what needs replacing',
      'Source trees, lights, and decor',
      'Work the setup weekend',
    ],
    who: 'For people who would rather build the thing than run the meeting about it.',
  },
  {
    id: 'concessions',
    name: 'Concessions',
    accent: 'blue',
    tags: ['people', 'backstage'],
    blurb: 'Basketball season, the stand, and a shift you can actually commit to.',
    when: 'Basketball season, roughly November to February',
    commitment: 'A shift at a time',
    what: 'The stand at home basketball games. That is the whole scope, which is exactly why it makes a good first committee.',
    does: [
      'Stock the stand and set prices',
      'Build the shift schedule for home games',
      'Work games and handle the cash box',
    ],
    who: 'For people who want a clear start and end.',
  },
  {
    id: 'uniform',
    name: 'Uniform Swap',
    accent: 'gold',
    tags: ['organizer', 'backstage', 'giveback'],
    blurb: 'Outgrown pieces from one family, straight to the family that needs them.',
    when: 'All year, busiest in August and January',
    commitment: 'Steady and low, with two busy stretches',
    what: 'Families donate what their kids outgrow, and families who need pieces get them free, no questions asked. It runs on wearercap.org/uniform-exchange with a bin holder in each house.',
    does: [
      'Sort donations by size and piece',
      'Match requests to what is on hand',
      'Coordinate handoffs at carline',
    ],
    who: 'For quiet operators. Nobody sees this work and every family feels it.',
    note: 'Being rebuilt this year, so whoever takes it gets to set it up their way.',
  },
  {
    id: 'marcom',
    name: 'Marketing and Communications',
    accent: 'magenta',
    tags: ['creative', 'people'],
    blurb: 'So the parent who is at work at 9am still gets to see House Cheers.',
    when: 'All year, around events and Friday mornings',
    commitment: 'A few hours a week, camera in hand',
    what: 'New this year. One chair and a team of three or four on content, photo, and video, running the RCAP Instagram and going live from House Cheers on Fridays.',
    does: [
      'Shoot at events',
      'Edit and post, and keep a consistent voice',
      'Go live Friday mornings',
    ],
    who: 'For people who already shoot or write and want it to be for something.',
    note: 'The board approves content before it posts and account access stays limited to two people.',
  },
  {
    id: 'service',
    name: 'Community Service',
    accent: 'green',
    tags: ['giveback', 'maker'],
    blurb: 'The one that has not been built yet. Come help decide what it is.',
    when: 'Shaped by the group, first push around December',
    commitment: 'Up to the people who show up',
    what: "New this year, board-led and school-wide. The first idea is supporting Isibindi's Christmas gift drive, maybe as a house competition, but nothing is locked.",
    does: [
      'Decide what our service effort actually is',
      'Build the first one',
      'Bring the whole school into it',
    ],
    who: 'For people with an idea they have been waiting to put somewhere.',
  },
  {
    id: 'men',
    name: 'Men of RCAP',
    accent: 'ink',
    tags: ['people', 'maker', 'backstage'],
    blurb: 'Dads, granddads, uncles, stepdads, big brothers. Any man in an RCA family.',
    when: 'All year, heaviest around events',
    commitment: 'Come when you can',
    what: 'RCA Dads since 2011. Car washes, parking crews, setup and teardown, decor muscle, the Thursday bike club. More than 2,600 volunteer hours in one recent year.',
    does: [
      'Show up where hands are needed',
      'Parking, setup, teardown, hauling',
      'Be a visible presence in the building',
    ],
    who: 'For any man in an RCA family. That is the whole bar.',
    noChair: true,
    note: 'Runs itself and picks its own leadership, so there is no chair application.',
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
