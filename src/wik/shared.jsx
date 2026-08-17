import React, { useEffect, useState } from 'react';
import {
  CURRENT, SITE, RELATIONS, TOPICS, topicById, suggestThree,
  ADVICE_PROMPT, ADVICE_HELP, ADVICE_BODY_PROMPT, ADVICE_BODY_HELP,
  QUESTION_PROMPT, QUESTION_HELP, QUESTION_BODY_PROMPT, QUESTION_BODY_HELP,
  ANSWER_PROMPT, ANSWER_HELP,
  HEADLINE_MAX, BODY_MAX,
} from './config.js';
import { addPost } from './data.js';

/* ---------------------------------------------------------------- the pages */

export const FORM_URL = '/wish-i-knew/';
export const BOARD_URL = '/wish-i-knew/read/';

/* ----------------------------------------------------------------- helpers */

// "A Class of 2029 Mom" reads better than a bare name, and it is what a parent
// who does not want to be named still gets to stand behind.
export const byline = (p) =>
  p.authorName
    ? `${p.authorName} · Class of ${p.gradClass} ${p.relation}`
    : `A Class of ${p.gradClass} ${p.relation}`;

export const shortDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
};

// Long advice gets a smaller headline so a card never blows out on a phone.
export const sizeClass = (text) => {
  const n = (text || '').length;
  if (n <= 48) return 'xl';
  if (n <= 90) return 'lg';
  return 'md';
};

// Anyone may ask; only the classes who have been here may advise or answer.
export const classesFor = (mode) => (mode === 'question' ? CURRENT.askers : CURRENT.veterans);

export function shareThisPage(url = window.location.origin + FORM_URL) {
  if (navigator.share) navigator.share({ title: 'One Thing I Wish I Knew', url });
  else navigator.clipboard?.writeText(url);
}

/* ------------------------------------------------------------------ chrome */

export function Topbar() {
  return (
    <header className="topbar">
      <div className="shell topbar-in">
        <a className="mark" href="/">
          We Are <span>RCAP</span>
          <small>RON CLARK ACADEMY PARENTS</small>
        </a>
        <p className="topmeta mono">
          {SITE.meta.map((m) => <span key={m}>{m}<br /></span>)}
        </p>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="foot">
      <div className="shell">
        <p className="mono">WE ARE RCAP · {CURRENT.label}</p>
        <p><a href="mailto:hello@wearercap.org">hello@wearercap.org</a></p>
      </div>
    </footer>
  );
}

// The live tally. It used to sit in the hero; it belongs next to the actions
// under the form, where it reads as "here is what is already there" rather than
// as a scoreboard someone has to get past before they can write anything.
export function CountStrip({ counts, className = '' }) {
  return (
    <p className={`mono strip ${className}`}>
      {CURRENT.label}
      <b>·</b>{counts.advice} {counts.advice === 1 ? 'ANSWER' : 'ANSWERS'}
      <b>·</b>{counts.questions} {counts.questions === 1 ? 'QUESTION' : 'QUESTIONS'}
    </p>
  );
}

/* --------------------------------------------------------------------- form */

// One hook drives the form in both places it appears: the landing page in
// either mode, and the answer modal over on the board.
export function useCompose(mode, question = null) {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [gradClass, setGradClass] = useState('');
  const [topic, setTopic] = useState(question ? question.topic : '');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // The chosen question, and whether they have opted out of being asked one.
  // Null and false means "still deciding", which is the state the three cards
  // are shown in.
  const [picked, setPicked] = useState(null);
  const [ownWay, setOwnWay] = useState(false);

  const classes = classesFor(mode);

  // Flipping the toggle changes which classes are on offer, so a class picked
  // under the old mode has to go. One incoming class means nothing to choose.
  useEffect(() => {
    setGradClass(classes.length === 1 ? classes[0] : '');
    setErr('');
    setPicked(null);
    setOwnWay(false);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const ready =
    !!relation && !!gradClass && !!topic &&
    headline.trim().length >= 3 && headline.trim().length <= HEADLINE_MAX;

  function choose(p) {
    setPicked(p);
    setTopic(p ? p.topic : '');   // picking the question is picking the topic
    setOwnWay(false);
  }

  function ownThing() {
    setPicked(null);
    setOwnWay(true);
    setTopic('');
  }

  function reset() {
    setTopic(question ? question.topic : '');
    setHeadline('');
    setBody('');
    setErr('');
    setPicked(null);
    setOwnWay(false);
  }

  async function submit(onDone) {
    if (!ready || busy) return;
    setBusy(true); setErr('');
    try {
      const post = await addPost({
        kind: mode,
        topic,
        headline,
        body,
        authorName: name,
        relation,
        gradClass,
        // The lead-in, not the question. This is what prints on the board, and
        // it has to read as the first half of a sentence somebody said — a
        // question there makes the card interrogate the reader instead of
        // telling them something.
        prompt: picked?.lead || '',
        answersTo: mode === 'answer' ? question.id : null,
      });
      onDone(post);
    } catch (e) {
      setErr(e.message || 'That did not save. Try once more.');
    }
    setBusy(false);
  }

  return {
    name, setName, relation, setRelation, gradClass, setGradClass,
    topic, setTopic, headline, setHeadline, body, setBody,
    picked, ownWay, choose, ownThing,
    classes, busy, err, ready, submit, reset,
  };
}


// Three questions, one per topic, biased toward whatever the board is thin on.
// Cards rather than a list because the point is that they are pickable — and
// because a list of questions reads as a form asking you three things rather
// than an offer of one.
function QuestionPicker({ f, counts }) {
  const [trio, setTrio] = useState(() => suggestThree(counts));
  const [seen, setSeen] = useState(() => trio.map((p) => p.q));

  function shuffle() {
    const next = suggestThree(counts, seen);
    setTrio(next);
    setSeen((prev) => [...prev, ...next.map((p) => p.q)]);
  }

  return (
    <div className="picker">
      <div className="picker-top">
        <span className="picker-badge mono">Quick pick</span>
        <button type="button" className="picker-shuffle" onClick={shuffle}>↻ Swap these out</button>
      </div>
      <p className="picker-sub">
        You have years of this. Starting from a real question is easier than
        starting from a blank box.
      </p>

      <div className="picker-cards">
        {trio.map((p) => (
          <button type="button" className="qcard" key={p.q} onClick={() => f.choose(p)}>
            <span className="qcard-tag mono">{topicById(p.topic).label}</span>
            <span className="qcard-q">{p.q}</span>
          </button>
        ))}
      </div>

      {/* Not a footnote. Someone who arrived with the thing they wanted to say
          should see this as an equal option, not as an escape hatch they have
          to go looking for. */}
      <div className="picker-own">
        <span className="picker-or mono">or</span>
        <button type="button" className="btn ghost wide" onClick={f.ownThing}>
          Write my own thing
        </button>
      </div>
    </div>
  );
}

export function ComposeFields({ f, mode, topicCounts = {} }) {
  const isQuestion = mode === 'question';
  const isAnswer = mode === 'answer';

  const prompt = isAnswer ? ANSWER_PROMPT : isQuestion ? QUESTION_PROMPT : ADVICE_PROMPT;
  const help = isAnswer ? ANSWER_HELP : isQuestion ? QUESTION_HELP : ADVICE_HELP;
  const bodyPrompt = isQuestion ? QUESTION_BODY_PROMPT : ADVICE_BODY_PROMPT;
  const bodyHelp = isQuestion ? QUESTION_BODY_HELP : ADVICE_BODY_HELP;
  // One label for both lanes now that asking is open to every class. "Your
  // student starts" only ever made sense for the incoming families.
  const classLabel = 'Your student’s class';

  return (
    <>
      <label className="lab">
        Your first name <span className="opt">optional</span>
        <input
          className="field"
          value={f.name}
          maxLength={40}
          placeholder="Leave blank to stay anonymous"
          onChange={(e) => f.setName(e.target.value)}
        />
      </label>

      <div className="two">
        <label className="lab">
          You are
          <select className="field" value={f.relation} onChange={(e) => f.setRelation(e.target.value)}>
            <option value="">Choose…</option>
            {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="lab">
          {classLabel}
          <select className="field" value={f.gradClass} onChange={(e) => f.setGradClass(e.target.value)}>
            <option value="">Choose…</option>
            {f.classes.map((c) => <option key={c} value={c}>Class of {c}</option>)}
          </select>
        </label>
      </div>

      {/* Advice only. A veteran parent has four years of material and no idea
          which bit is useful, so they get three specific questions to pick
          from. Asking is left open: a new family already arrives with the
          thing they are worried about. */}
      {mode === 'advice' && !f.picked && !f.ownWay && (
        <QuestionPicker f={f} counts={topicCounts} />
      )}

      {/* Once they have picked, the question replaces the topic field — because
          choosing the question already chose the topic. */}
      {mode === 'advice' && f.picked && (
        <div className="picked">
          <span className="picked-tag mono">{topicById(f.picked.topic).label}</span>
          <p className="picked-q">{f.picked.q}</p>
          <div className="picked-foot">
            <button type="button" className="linky" onClick={() => f.choose(null)}>Pick a different one</button>
            <button type="button" className="linky" onClick={f.ownThing}>Write my own instead</button>
          </div>
        </div>
      )}

      {/* The dropdown is the write-your-own path, and the answer modal, which
          inherits its topic from the question it is answering. */}
      {(isQuestion || (mode === 'advice' && f.ownWay)) && (
        <>
          <label className="lab">
            What is this about
            <select className="field" value={f.topic} onChange={(e) => f.setTopic(e.target.value)}>
              <option value="">Choose…</option>
              {TOPICS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          {f.topic && <p className="hint">{topicById(f.topic).hint}</p>}
        </>
      )}

      <label className="lab">
        {mode === 'advice' && f.picked ? f.picked.lead : prompt}
        <textarea
          className="field ta"
          rows={isAnswer ? 4 : 3}
          value={f.headline}
          maxLength={HEADLINE_MAX}
          placeholder={isQuestion ? 'How early do people actually line up for car line?' : ''}
          onChange={(e) => f.setHeadline(e.target.value)}
        />
        <span className="count">{HEADLINE_MAX - f.headline.length}</span>
      </label>
      <p className="hint">
        {mode === 'advice' && f.picked
          ? 'Finish the sentence. One or two lines is plenty.'
          : help}
      </p>

      {!isAnswer && (
        <>
          <label className="lab">
            {bodyPrompt} <span className="opt">optional</span>
            <textarea
              className="field ta"
              rows={3}
              value={f.body}
              maxLength={BODY_MAX}
              onChange={(e) => f.setBody(e.target.value)}
            />
            <span className="count">{BODY_MAX - f.body.length}</span>
          </label>
          <p className="hint">{bodyHelp}</p>
        </>
      )}

      {f.err && <p className="err">{f.err}</p>}
    </>
  );
}

/* -------------------------------------------------------------------- cards */

export function AdviceCard({ post, seed = false }) {
  return (
    <article className={`card advice ${seed ? 'seed' : ''}`}>
      <div className="card-meta">
        <span className="topic-tag">{topicById(post.topic).label}</span>
        {seed
          ? <span className="mono dim">EXAMPLE</span>
          : <span className="mono dim">{shortDate(post.createdAt)}</span>}
      </div>
      {/* When a question was taken, the writer only supplied the second half,
          so the two halves are set differently: the lead quiet and light, their
          words heavy and underlined in the flame. That is what stops
          "…don't know anyone yet, Just continue to show up." reading as a
          run-on — the capital is obviously the start of a filled-in blank
          rather than a botched clause. Someone who wrote their own thing has
          no lead, and the whole line is theirs, so nothing is marked. */}
      <p className={`card-headline ${sizeClass((post.prompt || '') + post.headline)}`}>
        {post.prompt
          ? (
            <>
              <span className="card-lead">{post.prompt} </span>
              <span className="card-answer">{post.headline}</span>
            </>
          )
          : post.headline}
      </p>
      {post.body && <p className="card-body">{post.body}</p>}
      <p className="card-by">{seed ? 'An RCA parent' : byline(post)}</p>
    </article>
  );
}

export function QuestionCard({ post, answers, onAnswer }) {
  return (
    <article className="card question">
      <div className="card-meta">
        <span className="topic-tag ask">{topicById(post.topic).label}</span>
        <span className="mono dim">ASKED {shortDate(post.createdAt)}</span>
      </div>
      <p className={`card-headline ${sizeClass(post.headline)}`}>{post.headline}</p>
      {post.body && <p className="card-body">{post.body}</p>}
      <p className="card-by">{byline(post)}</p>

      {answers.length > 0 && (
        <div className="answers">
          {answers.map((a) => (
            <div className="answer" key={a.id}>
              <p>{a.headline}</p>
              <p className="card-by">{byline(a)}</p>
            </div>
          ))}
        </div>
      )}

      <button className="btn ghost small" onClick={() => onAnswer(post)}>
        {answers.length ? 'Add your answer' : 'Answer this'}
      </button>
    </article>
  );
}
