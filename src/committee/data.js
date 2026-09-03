/* The nine committees, plus what each one is for and who tends to like it.

   `tags` drives the recommendation step. A parent picks how they like to show
   up, and committees carrying those tags float to the top. Nothing is hidden by
   it — "Explore all" is always one tap away — so a wrong guess costs a parent
   scrolling, never an option.

   `accent` is the card's colour block. It is doing structural work, not
   decoration: it is how you tell one committee from another at a glance in the
   grid, so no two neighbours in the default order share one. */

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
    commitment: 'Heavy for about six weeks, then done',
    what: "RCAP's biggest fundraiser of the year, and the money it brings in is what funds Teacher Appreciation Week in the spring. It began as the Fall Festival in the warehouse days, moved online in 2020, and then outgrew the thing it replaced.",
    does: [
      'Set the ticket price and build the prize list in September',
      'Ask local businesses and families for prize donations',
      'Keep sales tracked by class and house',
      'Run the drawing in mid November',
    ],
    who: 'People who like a goal, a deadline, and a number to beat.',
  },
  {
    id: 'taw',
    name: 'Teacher Appreciation Week',
    accent: 'magenta',
    tags: ['creative', 'organizer', 'giveback'],
    blurb: 'One week in May that tells this staff what they are worth to us.',
    when: 'Planning in March, the week itself in May',
    commitment: 'Quiet until spring, then all-in for a week',
    what: 'The oldest thing RCAP does. There has been a Teacher Appreciation Week every spring since at least 2011, from the Soul Train Extravaganza to The Most Magical School on Earth to last year\u2019s World Tour. It is the reason the raffle exists.',
    does: [
      'Poll the teachers first, before anything gets planned',
      'Set one theme for the whole week',
      'Give each class its day and the guidelines to run it',
      'Keep five class days feeling like one week',
    ],
    who: 'People with taste and follow-through, who want the payoff to be visible.',
    note: 'New this year: a chair and co-chair own the week and its budget, and each class takes a day inside the shared theme. Same model as 4 Days of Christmas.',
  },
  {
    id: 'fourdays',
    name: '4 Days of Christmas',
    accent: 'red',
    tags: ['creative', 'people', 'giveback'],
    blurb: 'Your class picks a day in December and spoils the staff rotten.',
    when: 'Sign up in November, the week is in December',
    commitment: 'One day. Genuinely.',
    what: "During RCA's holiday week, each class takes one day and showers the teachers and staff. Usually two chairmen per class. It is separate from Holiday Decor: that team puts the school up, this team runs the days.",
    does: [
      'Rally the parents in your class',
      'Decide what your day looks like',
      'Collect what you need and set it up that morning',
    ],
    who: 'Anyone who has never done anything with RCAP before. This is the door.',
  },
  {
    id: 'decor',
    name: 'Holiday Decor',
    accent: 'green',
    tags: ['creative', 'backstage', 'maker'],
    blurb: 'Two weekends that turn the whole building into something kids remember.',
    when: 'Setup weekend in November, teardown after Christmas',
    commitment: 'Two weekends, hands-on',
    what: 'Parents transform the entire school for the holidays. The tradition traces back to the first RCA tree lighting in 2011 and has grown into a full building takeover every November.',
    does: [
      'Plan what goes where and what needs replacing',
      'Source trees, lights, and decor',
      'Work the setup weekend in November',
      'Come back for breakdown the week after Christmas',
    ],
    who: 'People who would rather build the thing than run the meeting about it.',
  },
  {
    id: 'concessions',
    name: 'Concessions',
    accent: 'blue',
    tags: ['people', 'backstage'],
    blurb: 'Basketball season, the stand, and a shift you can actually commit to.',
    when: 'Basketball season, roughly November to February',
    commitment: 'A shift at a time',
    what: 'Concessions runs the stand at home basketball games. That is the whole scope. It is not year-round and it is not open-ended, which is exactly why it is a good first committee.',
    does: [
      'Stock the stand and set prices',
      'Build the shift schedule for home games',
      'Work games and handle the cash box',
    ],
    who: 'People who want a clear start and end, and to meet half the school doing it.',
  },
  {
    id: 'uniform',
    name: 'Uniform Swap',
    accent: 'gold',
    tags: ['organizer', 'backstage', 'giveback'],
    blurb: 'Outgrown pieces from one family, straight to the family that needs them.',
    when: 'All year, busiest in August and January',
    commitment: 'Steady and low, with two busy stretches',
    what: 'The longest-running family service RCAP offers, going back to the very first year in our records. Families donate what their kids outgrow, and families who need pieces get them free, no questions asked. It runs through wearercap.org/uniform-exchange with a bin holder in each house.',
    does: [
      'Take in donations and keep them sorted by size and piece',
      'Match requests to what is on hand',
      'Coordinate handoffs at carline or through the students',
    ],
    who: 'Quiet operators. Nobody sees this work and every family feels it.',
    note: 'Being rebuilt this year. The parent who ran it is stepping back, so whoever takes this gets to set it up right instead of inheriting someone else\u2019s system.',
  },
  {
    id: 'marcom',
    name: 'Marketing and Communications',
    accent: 'magenta',
    tags: ['creative', 'people'],
    blurb: 'So the parent who is at work at 9am still gets to see House Cheers.',
    when: 'All year, around events and Friday mornings',
    commitment: 'A few hours a week, camera in hand',
    what: 'New this year. One chair building a small team of three or four, with someone on content, someone on photography, and someone on video. The team runs the RCAP Instagram and goes live from House Cheers on Friday mornings, which is the single thing working parents ask for most.',
    does: [
      'Show up with a camera at events',
      'Edit and post, and keep a consistent voice',
      'Go live from House Cheers on Fridays',
    ],
    who: 'People who already shoot, edit, or write, and want it to be for something.',
    note: 'The board approves content before it posts and account access stays limited to two people. That is about protecting the account, not second-guessing your eye.',
  },
  {
    id: 'service',
    name: 'Community Service',
    accent: 'green',
    tags: ['giveback', 'maker'],
    blurb: 'The one that has not been built yet. Come help decide what it is.',
    when: 'Shaped by the group, first push around December',
    commitment: 'Up to the people who show up',
    what: 'New this year, board-led and school-wide, and we intend to give it the same energy the raffle gets. The first idea on the table is supporting Isibindi\u2019s community Christmas gift drive, possibly as a house competition with house points. A parents\u2019 unity walk has also been floated.',
    does: [
      'Brainstorm what our service effort should actually be',
      'Pick the first one and build it',
      'Bring the whole school into it, not just the parents who already show up',
    ],
    who: 'People with an idea they have been waiting for somewhere to put.',
  },
  {
    id: 'men',
    name: 'Men of RCAP',
    accent: 'ink',
    tags: ['people', 'maker', 'backstage'],
    blurb: 'Dads, granddads, uncles, stepdads, big brothers. Any man in an RCA family.',
    when: 'All year, heaviest around events',
    commitment: 'Come when you can',
    what: 'Started as RCA Dads in June 2011 and has been going ever since. Car washes, parking crews, event setup and teardown, holiday decor muscle, the Thursday afternoon bike club. In one recent year the group logged more than 2,600 volunteer hours.',
    does: [
      'Show up where hands are needed',
      'Parking, setup, teardown, hauling',
      'Be a visible presence in the building for these kids',
    ],
    who: 'Any man in an RCA family. That is the whole bar.',
    noChair: true,
    note: 'This group runs itself and picks its own leadership, so there is no chair application. Add it to your list and they will reach out directly.',
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
