// ---------------------------------------------------------------------------
// One Thing I Wish I Knew — everything worth changing lives here.
//
// Same fixture idea as the Recap: this is not a one-off for 2031. When the
// Class of 2032 walks in, change INCOMING and VETERAN_CLASSES below, give the
// round a fresh slug, and the page is ready again. Last year's thread stays in
// the database untouched.
// ---------------------------------------------------------------------------

export const ROUNDS = [
  {
    slug: 'class-of-2031',
    // The class walking in the door. They ask; they do not give advice yet.
    incoming: '2031',
    // The classes who have been here and can answer.
    veterans: ['2027', '2028', '2029', '2030'],
    label: 'FOR THE CLASS OF 2031',
    name: 'Class of 2031',
  },
];

export const CURRENT = ROUNDS[0];

export const SITE = {
  meta: ['WE ARE RCAP', 'PARENT TO PARENT'],
  kicker: 'Parent to parent',
  titleLead: 'ONE THING I WISH',
  titleGrad: 'I KNEW.',
  intro:
    'Every RCA family remembers the first month. The things nobody tells you, ' +
    'that you figure out by week three. This is where we hand them over early. ' +
    'Written by the parents already here, for the ones just walking in.',
};

export const RELATIONS = ['Mom', 'Dad', 'Grandparent', 'Auntie', 'Uncle', 'Bonus Parent', 'Guardian'];

// ---------------------------------------------------------------------------
// TOPICS
// These do three jobs: they sort the board, they give a stuck parent somewhere
// to start, and they keep the advice practical instead of abstract. Add or
// rename freely — the value stored is the `id`, so renaming a `label` is safe
// but changing an `id` orphans old posts.
// ---------------------------------------------------------------------------
export const TOPICS = [
  { id: 'first-weeks', label: 'The first few weeks', hint: 'What the first month actually feels like.' },
  { id: 'mornings',    label: 'Mornings & car line', hint: 'Getting there, dropping off, the rhythm of it.' },
  { id: 'uniforms',    label: 'Uniforms',            hint: 'What to buy, what to skip, what to borrow.' },
  { id: 'homework',    label: 'Homework & nights',   hint: 'The nightly routine that worked for you.' },
  { id: 'houses',      label: 'House life',          hint: 'Sorting, points, and what it means to your kid.' },
  { id: 'traditions',  label: 'Traditions & events', hint: 'The dates that matter and why.' },
  { id: 'money',       label: 'Money & fundraisers', hint: 'Planning ahead so nothing lands as a surprise.' },
  { id: 'teachers',    label: 'Talking to teachers', hint: 'How to reach out and when.' },
  { id: 'packing',     label: 'Lunch & packing',     hint: 'What goes in the bag.' },
  { id: 'parents',     label: 'Just for parents',    hint: 'Finding your own footing here.' },
];

export const topicById = (id) => TOPICS.find((t) => t.id === id) || { id, label: id, hint: '' };

// ---------------------------------------------------------------------------
// THE ASK
// The wording is the first half of the guardrail — the approval queue is the
// second. Every prompt below points at what helped, not at what went wrong.
// A parent who wants to vent has nowhere here to put it, which is the point.
// ---------------------------------------------------------------------------
export const ADVICE_PROMPT = 'One thing I wish I knew when we got to RCA';
export const ADVICE_HELP =
  'Finish the sentence in one line. Something you would tell a friend whose ' +
  'kid just got in.';
export const ADVICE_BODY_PROMPT = 'Why it helped';
export const ADVICE_BODY_HELP =
  'Optional. A sentence or two on what it changed for your family.';

export const QUESTION_PROMPT = 'What do you want to ask a parent who has been here?';
export const QUESTION_HELP =
  'Ask the small, practical thing. Somebody has already lived it.';
export const QUESTION_BODY_PROMPT = 'Anything else that would help someone answer';
export const QUESTION_BODY_HELP = 'Optional.';

export const ANSWER_PROMPT = 'Your answer';
export const ANSWER_HELP = 'Speak from your own family. What actually worked.';

export const HEADLINE_MAX = 160;
export const BODY_MAX = 500;

// Shown under the form so nobody is surprised by the delay.
export const REVIEW_NOTE =
  'Everything here is read by a person before it goes up. This is the first ' +
  'thing many new families will see, so we keep it useful and we keep it kind.';

// The board opens with these when there is nothing to show yet, so an early
// visitor never lands on an empty page. They are examples of the FORM, not
// real submissions, and they are labelled as such on the board.
export const SEEDS = [
  {
    topic: 'first-weeks',
    headline: 'The first two weeks are loud, and that is not a warning sign.',
    body: 'Ours came home wiped out every day until about week three, then it clicked. We almost read it as a problem. It was just the volume of a new place.',
  },
  {
    topic: 'uniforms',
    headline: 'Buy fewer than you think, and check the uniform exchange first.',
    body: 'We over-bought in August for a kid who grew two inches by November. The exchange had most of what we actually needed.',
  },
  {
    topic: 'parents',
    headline: 'Say yes to one thing early, even if it is small.',
    body: 'One shift at one event is how you meet the parents who end up answering your texts for the next four years.',
  },
];
