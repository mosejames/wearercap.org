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
  // Not money, and not fundraising either. RCA does not keep asking families to
  // buy things, and framing this around raising money describes a place this
  // isn't. What a new family actually needs to know is how to show up.
  { id: 'volunteer',   label: 'Volunteering & pitching in', hint: 'Showing up, signing up, and how families help out.' },
  { id: 'teachers',    label: 'Talking to teachers', hint: 'How to reach out and when. Keep it general, not about a particular teacher.' },
  { id: 'packing',     label: 'Packing the bag',    hint: 'What your student needs on them every single day.' },
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
  // Each entry carries two forms of the same thing, and they are not
  // interchangeable. `q` is the question on the Quick Pick card — it exists to
  // jog a memory. `lead` is what the writer actually completes, and what gets
  // stored and printed on the board, so it has to be a sentence somebody would
  // say out loud. Leaving a question there produced cards that asked the reader
  // something instead of telling them something.
  { topic: 'first-weeks', q: 'What surprised you most in the first two weeks?',                     lead: 'What surprised me most was' },
  { topic: 'first-weeks', q: 'What did you worry about that turned out to be fine?',                lead: 'I worried about this, and it turned out fine:' },
  { topic: 'first-weeks', q: 'What did the first month actually feel like at your house?',          lead: 'At our house, the first month felt like' },

  { topic: 'mornings',    q: 'What time do you actually leave the house?',                          lead: 'We actually leave the house at' },
  { topic: 'mornings',    q: 'What did you change about your mornings after the first month?',      lead: 'After the first month, we changed' },
  { topic: 'mornings',    q: 'How long does the drive really take at that hour?',                   lead: 'At that hour, the drive really takes' },

  { topic: 'uniforms',    q: 'What did you end up needing more of?',                                lead: 'We ended up needing more' },
  { topic: 'uniforms',    q: 'How does your family keep up with uniforms during the week?',         lead: 'We keep up with uniforms by' },
  { topic: 'uniforms',    q: 'What is worth knowing about the uniform exchange?',                   lead: 'What is worth knowing about the uniform exchange is' },

  { topic: 'homework',    q: 'What does a normal weeknight look like at your house?',               lead: 'A normal weeknight at our house looks like' },
  { topic: 'homework',    q: 'What did you stop doing once your family found the rhythm?',          lead: 'Once we found the rhythm, we stopped' },
  { topic: 'homework',    q: 'How long does homework really take?',                                 lead: 'Homework really takes' },

  { topic: 'houses',      q: 'What did your kid say the night they got sorted?',                    lead: 'The night mine got sorted, they said' },
  { topic: 'houses',      q: 'What does the house actually mean to your student day to day?',       lead: 'Day to day, the house means' },

  { topic: 'traditions',  q: 'Which date should a new family put on the calendar right now?',       lead: 'Put this on your calendar right now:' },
  { topic: 'traditions',  q: 'What event did you almost skip and are glad you didn’t?',             lead: 'I almost skipped this one and I am glad I didn’t:' },

  // The widest set on purpose. Getting a new family to show up once is the
  // thing most likely to make the rest of this work, and "volunteer" means a
  // dozen different jobs here — the questions should show that range rather
  // than imply there is one way in.
  { topic: 'volunteer',   q: 'What was the first thing you volunteered for?',                       lead: 'The first thing I volunteered for was' },
  { topic: 'volunteer',   q: 'What is the easiest way for a new family to pitch in?',               lead: 'The easiest way to pitch in is' },
  { topic: 'volunteer',   q: 'How much time does helping out actually take?',                       lead: 'Helping out actually takes' },
  { topic: 'volunteer',   q: 'What did you sign up for that you would do again?',                   lead: 'I would sign up again for' },
  { topic: 'volunteer',   q: 'What is a good first thing to say yes to if you don’t know anyone yet?', lead: 'If you don’t know anyone yet, say yes to' },
  { topic: 'volunteer',   q: 'How do you find out what help is needed?',                            lead: 'I find out what help is needed by' },
  { topic: 'volunteer',   q: 'What surprised you about volunteering here?',                         lead: 'What surprised me about volunteering here was' },

  { topic: 'teachers',    q: 'Where do you actually find out what is going on each week?',          lead: 'I find out what is going on each week from' },
  { topic: 'teachers',    q: 'What do you know now about staying in the loop that you didn’t at first?', lead: 'About staying in the loop, I know now that' },

  // Not lunch. What a kid has to physically have on them, which is the thing
  // that goes wrong in week one.
  { topic: 'packing',     q: 'What goes in the bag every single day?',                              lead: 'Every single day, the bag has' },
  { topic: 'packing',     q: 'What does your student always need that is easy to forget?',          lead: 'The easy thing to forget is' },
  { topic: 'packing',     q: 'What is worth keeping a spare of in the bag?',                        lead: 'It is worth keeping a spare' },
  { topic: 'packing',     q: 'What did your family add to the bag after the first month?',          lead: 'After the first month, we added' },

  { topic: 'parents',     q: 'How did you meet the first RCA parent you actually knew?',            lead: 'I met the first parent I actually knew' },
  { topic: 'parents',     q: 'What did you say yes to that you’re glad you did?',                   lead: 'I am glad I said yes to' },
  { topic: 'parents',     q: 'What would you tell a parent who feels like they don’t know anyone yet?', lead: 'If you feel like you don’t know anyone yet,' },

  // ---------------------------------------------------------------------
  // Drawn from the Parents section of RCA's Dragon Scales (2015). The scales
  // are the school's, and they are written as instructions — "Trust the
  // process", "Don't be a helicopter parent". These are not those lines. Each
  // one turns a directive the school already gives into a question only a
  // parent who has lived it can answer, which is the one thing the scales
  // cannot do for a new family. Scale numbers noted so the provenance is not
  // lost if this grows into something bigger.
  // ---------------------------------------------------------------------
  { topic: 'parents',     q: 'When did you first let your kid handle something themselves?', lead: 'I first let mine handle something themselves when' },              // scale 23
  { topic: 'first-weeks', q: 'When did you stop worrying and start trusting it?',            lead: 'I stopped worrying and started trusting it when' },                // scale 2
  { topic: 'homework',    q: 'When did you stop looking at the grade first?',                lead: 'I stopped looking at the grade first when' },                      // scale 5
  { topic: 'teachers',    q: 'How do you keep up with everything the school sends?',         lead: 'I keep up with everything the school sends by' },                  // scale 16
  { topic: 'volunteer',   q: 'What is a small thing you have done for a teacher that landed?', lead: 'One small thing we did for a teacher that landed was' },         // scale 10
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
