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
    // The class walking in the door. The advice is aimed at them.
    incoming: '2031',
    // The classes who have been here, and so are the ones who answer.
    veterans: ['2027', '2028', '2029', '2030'],
    // Who may ask: everybody. Being new to RCA is not the only way to be new
    // to something here — a first-time 7th grade parent and a first-time 8th
    // grade parent both have questions, and gatekeeping the asking by class
    // was never the point. Answering still belongs to the veterans.
    askers: ['2027', '2028', '2029', '2030', '2031'],
    label: 'FOR THE CLASS OF 2031',
    name: 'Class of 2031',
  },
];

export const CURRENT = ROUNDS[0];

export const SITE = {
  meta: ['WE ARE RCAP', 'PARENT TO PARENT'],
  kicker: 'Parent to parent',
  // The headline is a shared lead-in; the toggle supplies the two endings.
  titleLead: 'ONE THING',
  boardHead: 'What parents have already shared',
};

// The two halves of the toggle. `label` is what shows on the switch and has to
// read as a completion of "ONE THING…", so keep them short and parallel.
export const MODES = {
  advice: {
    label: 'I wish I knew',
    title: 'One Thing I Wish I Knew',
    lead: 'You have been here a while. Hand something over to the families walking in.',
  },
  question: {
    label: 'I’d like to ask',
    title: 'One Thing I’d Like to Ask',
    lead: 'Ask the small practical thing. Somebody here has already lived it.',
  },
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
  // Deliberately not "Money". RCA is not a school that keeps asking families to
  // buy things — tuition covers it — so framing this around cost would describe
  // a place this isn't. What actually exists is the raffle and the drives, and
  // those are about pitching in.
  { id: 'money',       label: 'Fundraisers & pitching in', hint: 'The raffle, the drives, and how families get involved.' },
  { id: 'teachers',    label: 'Talking to teachers', hint: 'How to reach out and when. Keep it general, not about a particular teacher.' },
  { id: 'packing',     label: 'Lunch & packing',     hint: 'What goes in the bag.' },
  { id: 'parents',     label: 'Just for parents',    hint: 'Finding your own footing here.' },
  // Always last. Nobody should stall out because their thing has no box.
  { id: 'other',       label: 'Something else',      hint: 'If it does not fit anything on the list, it still belongs here.' },
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
// The second half of the "keep it kind" guardrail, after the approval queue.
// Naming a teacher is the one thing most likely to turn a useful thread into a
// problem, so the form says so plainly rather than leaving it to be caught.
export const QUESTION_HELP =
  'Ask the small, practical thing. Somebody has already lived it. Keep it ' +
  'about how things work here, not about a particular teacher or student.';
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

// ---------------------------------------------------------------------------
// THE QUESTIONS
//
// The Recap proved this earns its keep: 34 of its 38 entries answered an
// assigned prompt, across 14 different ones. People are not short of things to
// say, they are short of a place to start — a veteran parent has four years of
// material and no idea which bit is useful.
//
// Every question below points at one specific afternoon somebody actually
// lived. That is the whole trick. "What was your first year like?" is the blank
// page again with a question mark on it; "What did you buy in August that you
// never used?" retrieves an actual memory.
//
// None of these invite a complaint, a name, or a cost. Keep it that way.
// ---------------------------------------------------------------------------
export const PROMPTS = [
  { topic: 'first-weeks', q: 'What surprised you most in the first two weeks?' },
  { topic: 'first-weeks', q: 'What did you worry about that turned out to be fine?' },
  { topic: 'first-weeks', q: 'What did the first month actually feel like at your house?' },

  { topic: 'mornings',    q: 'What time do you actually leave the house?' },
  { topic: 'mornings',    q: 'What did you change about your mornings after the first month?' },
  { topic: 'mornings',    q: 'What do you know about car line now that you didn’t in August?' },

  { topic: 'uniforms',    q: 'What did you buy in August that you never used?' },
  { topic: 'uniforms',    q: 'What did you end up needing more of?' },
  { topic: 'uniforms',    q: 'What would you tell someone before they place the first uniform order?' },

  { topic: 'homework',    q: 'What does a normal weeknight look like at your house?' },
  { topic: 'homework',    q: 'What did you stop doing once your family found the rhythm?' },
  { topic: 'homework',    q: 'How long does homework really take?' },

  { topic: 'houses',      q: 'What did your kid say the night they got sorted?' },
  { topic: 'houses',      q: 'What does the house actually mean to your student day to day?' },

  { topic: 'traditions',  q: 'Which date should a new family put on the calendar right now?' },
  { topic: 'traditions',  q: 'What event did you almost skip and are glad you didn’t?' },

  { topic: 'money',       q: 'How did your family end up helping with the raffle?' },
  { topic: 'money',       q: 'What is the easiest way for a new family to pitch in?' },

  { topic: 'teachers',    q: 'When did you first reach out to the school, and how did you do it?' },
  { topic: 'teachers',    q: 'What do you know now about staying in the loop that you didn’t at first?' },

  { topic: 'packing',     q: 'What goes in the bag every single day?' },
  { topic: 'packing',     q: 'What did you figure out about lunch after a few weeks?' },

  { topic: 'parents',     q: 'How did you meet the first RCA parent you actually knew?' },
  { topic: 'parents',     q: 'What did you say yes to that you’re glad you did?' },
  { topic: 'parents',     q: 'What would you tell a parent who feels like they don’t know anyone yet?' },
];

// Three questions, biased toward the corners of the board nobody has covered.
//
// Pure random is how you end up with six answers about car line and nothing
// about the first week. Weighting by what is already published means the
// suggestions quietly steer toward the gaps — the useful half of a leaderboard
// with none of the part that produces a losing house.
export function suggestThree(counts = {}, exclude = []) {
  const skip = new Set(exclude);
  const pool = PROMPTS.filter((p) => !skip.has(p.q));
  const usable = pool.length >= 3 ? pool : PROMPTS;

  // Shuffle first so equal-weight topics don't always surface in file order.
  const shuffled = [...usable].sort(() => Math.random() - 0.5);
  shuffled.sort((a, b) => (counts[a.topic] ?? 0) - (counts[b.topic] ?? 0));

  // One per topic, so the three on screen never look like the same question
  // asked three ways.
  const out = [];
  const seen = new Set();
  for (const p of shuffled) {
    if (seen.has(p.topic)) continue;
    seen.add(p.topic);
    out.push(p);
    if (out.length === 3) break;
  }
  return out;
}
