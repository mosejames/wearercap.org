import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CURRENT, SITE, RELATIONS, TOPICS, topicById,
  ADVICE_PROMPT, ADVICE_HELP, ADVICE_BODY_PROMPT, ADVICE_BODY_HELP,
  QUESTION_PROMPT, QUESTION_HELP, QUESTION_BODY_PROMPT, QUESTION_BODY_HELP,
  ANSWER_PROMPT, ANSWER_HELP,
  HEADLINE_MAX, BODY_MAX, REVIEW_NOTE, SEEDS,
} from './config.js';
import { listPublic, addPost, adminAll, setStatus, declineThread } from './data.js';

/* ----------------------------------------------------------------- helpers */

// "A Class of 2029 Mom" reads better than a bare name, and it is what a parent
// who does not want to be named still gets to stand behind.
const byline = (p) =>
  p.authorName
    ? `${p.authorName} · Class of ${p.gradClass} ${p.relation}`
    : `A Class of ${p.gradClass} ${p.relation}`;

const shortDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
};

// Long advice gets a smaller headline so a card never blows out on a phone.
const sizeClass = (text) => {
  const n = (text || '').length;
  if (n <= 48) return 'xl';
  if (n <= 90) return 'lg';
  return 'md';
};

/* -------------------------------------------------------------------- form */

function useIdentity() {
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [gradClass, setGradClass] = useState('');
  return { name, setName, relation, setRelation, gradClass, setGradClass };
}

function IdentityFields({ id, classes, classLabel }) {
  return (
    <>
      <label className="lab">
        Your first name <span className="opt">optional</span>
        <input
          className="field"
          value={id.name}
          maxLength={40}
          placeholder="Leave blank to stay anonymous"
          onChange={(e) => id.setName(e.target.value)}
        />
      </label>

      <div className="two">
        <label className="lab">
          You are
          <select className="field" value={id.relation} onChange={(e) => id.setRelation(e.target.value)}>
            <option value="">Choose…</option>
            {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="lab">
          {classLabel}
          <select className="field" value={id.gradClass} onChange={(e) => id.setGradClass(e.target.value)}>
            <option value="">Choose…</option>
            {classes.map((c) => <option key={c} value={c}>Class of {c}</option>)}
          </select>
        </label>
      </div>
    </>
  );
}

// One sheet, three jobs. `mode` is 'advice' | 'question' | 'answer'.
function Sheet({ mode, question, onClose, onDone }) {
  const id = useIdentity();
  const [topic, setTopic] = useState(question ? question.topic : '');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const isQuestion = mode === 'question';
  const isAnswer = mode === 'answer';

  const classes = isQuestion ? [CURRENT.incoming] : CURRENT.veterans;
  const classLabel = isQuestion ? 'Your student starts' : 'Your student’s class';

  const prompt = isAnswer ? ANSWER_PROMPT : isQuestion ? QUESTION_PROMPT : ADVICE_PROMPT;
  const help = isAnswer ? ANSWER_HELP : isQuestion ? QUESTION_HELP : ADVICE_HELP;
  const bodyPrompt = isQuestion ? QUESTION_BODY_PROMPT : ADVICE_BODY_PROMPT;
  const bodyHelp = isQuestion ? QUESTION_BODY_HELP : ADVICE_BODY_HELP;

  const title = isAnswer ? 'Answer this' : isQuestion ? 'Ask a parent' : 'Share one thing';

  // A single incoming class means there is nothing to choose; pick it for them.
  useEffect(() => {
    if (classes.length === 1) id.setGradClass(classes[0]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ready =
    !!id.relation && !!id.gradClass && !!topic &&
    headline.trim().length >= 3 && headline.trim().length <= HEADLINE_MAX;

  async function submit() {
    if (!ready || busy) return;
    setBusy(true); setErr('');
    try {
      const post = await addPost({
        kind: mode,
        topic,
        headline,
        body,
        authorName: id.name,
        relation: id.relation,
        gradClass: id.gradClass,
        answersTo: isAnswer ? question.id : null,
      });
      onDone(post);
    } catch (e) {
      setErr(e.message || 'That did not save. Try once more.');
    }
    setBusy(false);
  }

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={title}>
      <button className="sheet-scrim" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <div className={`sheet ${isQuestion ? 'ask' : ''}`}>
        <div className="sheet-head">
          <span className="eyebrow">{isQuestion ? 'Class of ' + CURRENT.incoming : 'Parent to parent'}</span>
          <button className="sheet-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        <h2 className="sheet-title">{title}</h2>

        {isAnswer && (
          <blockquote className="quoted">
            <p>{question.headline}</p>
            <cite>{byline(question)}</cite>
          </blockquote>
        )}

        <IdentityFields id={id} classes={classes} classLabel={classLabel} />

        {!isAnswer && (
          <div className="lab">
            What is this about
            <div className="chips">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`chip ${topic === t.id ? 'on' : ''}`}
                  onClick={() => setTopic(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {topic && <p className="hint">{topicById(topic).hint}</p>}
          </div>
        )}

        <label className="lab">
          {prompt}
          <textarea
            className="field ta"
            rows={isAnswer ? 4 : 3}
            value={headline}
            maxLength={HEADLINE_MAX}
            placeholder={isQuestion ? 'How early do people actually line up for car line?' : ''}
            onChange={(e) => setHeadline(e.target.value)}
          />
          <span className="count">{HEADLINE_MAX - headline.length}</span>
        </label>
        <p className="hint">{help}</p>

        {!isAnswer && (
          <>
            <label className="lab">
              {bodyPrompt} <span className="opt">optional</span>
              <textarea
                className="field ta"
                rows={3}
                value={body}
                maxLength={BODY_MAX}
                onChange={(e) => setBody(e.target.value)}
              />
              <span className="count">{BODY_MAX - body.length}</span>
            </label>
            <p className="hint">{bodyHelp}</p>
          </>
        )}

        {err && <p className="err">{err}</p>}

        <button className="btn flame wide" onClick={submit} disabled={!ready || busy}>
          {busy ? 'Sending…' : isAnswer ? 'Send my answer' : isQuestion ? 'Send my question' : 'Send it in'}
        </button>

        <p className="review-note">{REVIEW_NOTE}</p>
      </div>
    </div>
  );
}

function Done({ post, onClose }) {
  const isQuestion = post.kind === 'question';
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true">
      <button className="sheet-scrim" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <div className="sheet done">
        <span className="eyebrow">Got it</span>
        <h2 className="sheet-title">
          {isQuestion ? 'Your question is in.' : 'Thank you. That is the good stuff.'}
        </h2>
        <p className="done-copy">
          {isQuestion
            ? 'A parent who has been here will answer it. Both the question and the answer get read before they go up, so give it a day.'
            : 'A person reads every one before it goes on the board. Yours shows up once it is approved.'}
        </p>
        <blockquote className="quoted">
          <p>{post.headline}</p>
          <cite>{byline(post)}</cite>
        </blockquote>
        <button className="btn flame wide" onClick={onClose}>Back to the board</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- board */

function AdviceCard({ post, seed = false }) {
  return (
    <article className={`card advice ${seed ? 'seed' : ''}`}>
      <div className="card-meta">
        <span className="topic-tag">{topicById(post.topic).label}</span>
        {seed ? <span className="mono dim">EXAMPLE</span> : <span className="mono dim">{shortDate(post.createdAt)}</span>}
      </div>
      <p className={`card-headline ${sizeClass(post.headline)}`}>{post.headline}</p>
      {post.body && <p className="card-body">{post.body}</p>}
      <p className="card-by">{seed ? 'An RCA parent' : byline(post)}</p>
    </article>
  );
}

function QuestionCard({ post, answers, onAnswer }) {
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

/* -------------------------------------------------------------- back office */

function Admin() {
  const [pass, setPass] = useState('');
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [tab, setTab] = useState('pending');

  const load = useCallback(async (p) => {
    try { setRows(await adminAll(p)); setErr(''); return true; }
    catch (e) { setErr(e.message || 'Could not load.'); return false; }
  }, []);

  async function unlock(e) {
    e.preventDefault();
    if (await load(pass)) setOpen(true);
  }

  async function decide(post, status) {
    setBusyId(post.id); setErr('');
    try {
      if (post.kind === 'question' && status === 'declined') {
        await declineThread(post.id, pass);
      } else {
        await setStatus(post.id, status, pass);
      }
      await load(pass);
    } catch (e) { setErr(e.message || 'Could not update.'); }
    setBusyId(null);
  }

  const counts = useMemo(() => ({
    pending: rows.filter((r) => r.status === 'pending').length,
    approved: rows.filter((r) => r.status === 'approved').length,
    declined: rows.filter((r) => r.status === 'declined').length,
  }), [rows]);

  const shown = useMemo(() => rows.filter((r) => r.status === tab), [rows, tab]);

  const questionById = useMemo(() => {
    const m = {};
    for (const r of rows) if (r.kind === 'question') m[r.id] = r;
    return m;
  }, [rows]);

  function downloadCSV() {
    const head = ['Kind', 'Status', 'Topic', 'Headline', 'Body', 'Name', 'Relation', 'Class of', 'Answers question', 'Submitted'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head.map(esc).join(',')];
    for (const r of rows) {
      lines.push([
        r.kind, r.status, topicById(r.topic).label, r.headline, r.body,
        r.authorName, r.relation, r.gradClass,
        r.answersTo ? (questionById[r.answersTo]?.headline || r.answersTo) : '',
        r.createdAt,
      ].map(esc).join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wish-i-knew-${CURRENT.slug}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!open) {
    return (
      <div className="narrow admin-gate">
        <span className="eyebrow">RCAP · Wish I Knew back office</span>
        <h1>Back office</h1>
        <form onSubmit={unlock}>
          <input
            className="field"
            type="password"
            value={pass}
            placeholder="Passcode"
            onChange={(e) => setPass(e.target.value)}
          />
          <button className="btn flame wide" style={{ marginTop: 14 }}>Open</button>
        </form>
        {err && <p className="err">{err}</p>}
        <p className="hint">Nothing on this page is readable without the passcode. Pending posts are invisible to the public site.</p>
      </div>
    );
  }

  return (
    <div className="shell admin">
      <span className="eyebrow">RCAP · Wish I Knew back office</span>
      <h1>{counts.pending} waiting on you</h1>
      <p className="admin-sub">{counts.approved} live on the board · {counts.declined} declined</p>

      <div className="tabs">
        {['pending', 'approved', 'declined'].map((t) => (
          <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
            {t} ({counts[t]})
          </button>
        ))}
        <button className="btn ghost small" onClick={() => load(pass)}>Refresh</button>
        <button className="btn ghost small" onClick={downloadCSV}>Download CSV</button>
      </div>

      {err && <p className="err">{err}</p>}

      {shown.length === 0 && <p className="empty">Nothing here.</p>}

      <div className="admin-list">
        {shown.map((r) => (
          <div className="admin-row" key={r.id}>
            <div className="card-meta">
              <span className={`topic-tag ${r.kind === 'question' ? 'ask' : ''}`}>
                {r.kind === 'answer' ? 'Answer' : r.kind === 'question' ? 'Question' : 'Advice'}
                {' · '}{topicById(r.topic).label}
              </span>
              <span className="mono dim">{shortDate(r.createdAt)}</span>
            </div>
            {r.answersTo && (
              <p className="admin-parent">
                Answering: “{questionById[r.answersTo]?.headline || 'a question'}”
              </p>
            )}
            <p className="card-headline md">{r.headline}</p>
            {r.body && <p className="card-body">{r.body}</p>}
            <p className="card-by">{byline(r)}{r.authorName ? '' : ' (anonymous)'}</p>
            <div className="admin-actions">
              {r.status !== 'approved' && (
                <button className="btn flame small" disabled={busyId === r.id} onClick={() => decide(r, 'approved')}>
                  Approve
                </button>
              )}
              {r.status !== 'declined' && (
                <button className="btn ghost small" disabled={busyId === r.id} onClick={() => decide(r, 'declined')}>
                  {r.kind === 'question' ? 'Decline (and its answers)' : 'Decline'}
                </button>
              )}
              {r.status !== 'pending' && (
                <button className="btn ghost small" disabled={busyId === r.id} onClick={() => decide(r, 'pending')}>
                  Put back in the queue
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- app */

export default function App() {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [sheet, setSheet] = useState(null); // {mode, question}
  const [done, setDone] = useState(null);
  const [lane, setLane] = useState('all');  // all | advice | questions
  const [topic, setTopic] = useState('all');
  const [isAdmin, setIsAdmin] = useState(
    () => typeof window !== 'undefined' && window.location.hash === '#admin'
  );

  const reload = useCallback(async () => {
    try { setRows(await listPublic()); setLoadErr(''); }
    catch (e) { setLoadErr(e.message || 'Could not load the board.'); }
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
    const onHash = () => setIsAdmin(window.location.hash === '#admin');
    window.addEventListener('hashchange', onHash);
    const t = setInterval(reload, 30000);
    return () => { window.removeEventListener('hashchange', onHash); clearInterval(t); };
  }, [reload]);

  useEffect(() => {
    document.body.style.overflow = sheet || done ? 'hidden' : '';
  }, [sheet, done]);

  const advice = useMemo(() => rows.filter((r) => r.kind === 'advice'), [rows]);
  const questions = useMemo(() => rows.filter((r) => r.kind === 'question'), [rows]);
  const answersFor = useMemo(() => {
    const m = {};
    for (const r of rows) {
      if (r.kind !== 'answer' || !r.answersTo) continue;
      (m[r.answersTo] ||= []).push(r);
    }
    // Oldest answer first — the thread should read in the order it happened.
    for (const k of Object.keys(m)) m[k].reverse();
    return m;
  }, [rows]);

  // Only offer a topic filter for topics that actually have something in them.
  const liveTopics = useMemo(() => {
    const used = new Set(rows.map((r) => r.topic));
    return TOPICS.filter((t) => used.has(t.id));
  }, [rows]);

  const byTopic = (list) => (topic === 'all' ? list : list.filter((r) => r.topic === topic));
  const shownAdvice = byTopic(advice);
  const shownQuestions = byTopic(questions);

  const showSeeds = loaded && advice.length === 0 && topic === 'all' && lane !== 'questions';

  if (isAdmin) return <Admin />;

  return (
    <>
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

      <section className="hero">
        <div className="shell">
          <p className="kicker">{SITE.kicker}</p>
          <h1>
            {SITE.titleLead}<br />
            <span className="flame">{SITE.titleGrad}</span>
          </h1>
          <p className="intro">{SITE.intro}</p>

          <p className="mono strip">
            {CURRENT.label}
            <b>·</b>{advice.length} {advice.length === 1 ? 'ANSWER' : 'ANSWERS'}
            <b>·</b>{questions.length} {questions.length === 1 ? 'QUESTION' : 'QUESTIONS'}
          </p>

          <div className="hero-cta">
            <button className="btn flame" onClick={() => setSheet({ mode: 'advice' })}>
              I’ve been here. Share one thing.
            </button>
            <button className="btn ghost" onClick={() => setSheet({ mode: 'question' })}>
              I’m new. Ask a question.
            </button>
          </div>
        </div>
      </section>

      <section className="board">
        <div className="shell">
          <div className="filters">
            <div className="lanes">
              {[
                ['all', 'Everything'],
                ['advice', `Advice (${advice.length})`],
                ['questions', `Questions (${questions.length})`],
              ].map(([id, label]) => (
                <button key={id} className={`lane ${lane === id ? 'on' : ''}`} onClick={() => setLane(id)}>
                  {label}
                </button>
              ))}
            </div>

            {liveTopics.length > 1 && (
              <div className="chips topics">
                <button className={`chip ${topic === 'all' ? 'on' : ''}`} onClick={() => setTopic('all')}>
                  All topics
                </button>
                {liveTopics.map((t) => (
                  <button key={t.id} className={`chip ${topic === t.id ? 'on' : ''}`} onClick={() => setTopic(t.id)}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loadErr && <p className="err">{loadErr}</p>}
          {!loaded && <p className="empty">Loading…</p>}

          {showSeeds && (
            <>
              <p className="seed-note">
                Nothing has been approved yet. Here is the shape of it: three
                examples so you can see what a good one looks like.
              </p>
              <div className="grid">
                {SEEDS.map((s, i) => <AdviceCard key={i} post={s} seed />)}
              </div>
            </>
          )}

          {lane !== 'questions' && shownAdvice.length > 0 && (
            <div className="grid">
              {shownAdvice.map((p) => <AdviceCard key={p.id} post={p} />)}
            </div>
          )}

          {lane !== 'advice' && shownQuestions.length > 0 && (
            <>
              {lane === 'all' && <h2 className="lane-head">Asked by Class of {CURRENT.incoming}</h2>}
              <div className="grid">
                {shownQuestions.map((p) => (
                  <QuestionCard
                    key={p.id}
                    post={p}
                    answers={answersFor[p.id] || []}
                    onAnswer={(q) => setSheet({ mode: 'answer', question: q })}
                  />
                ))}
              </div>
            </>
          )}

          {loaded && !showSeeds && shownAdvice.length === 0 && shownQuestions.length === 0 && (
            <p className="empty">Nothing under this filter yet.</p>
          )}
        </div>
      </section>

      <section className="closer">
        <div className="narrow">
          <h2>Know somebody starting in the fall?</h2>
          <p>
            Send them this page. It is the whole point: the things we each
            worked out alone, handed over before they need them.
          </p>
          <div className="hero-cta">
            <button
              className="btn flame"
              onClick={() => {
                const url = window.location.origin + '/wish-i-knew/';
                if (navigator.share) navigator.share({ title: 'One Thing I Wish I Knew', url });
                else navigator.clipboard?.writeText(url);
              }}
            >
              Share the page
            </button>
            <a className="btn ghost" href="/">Back to We Are RCAP</a>
          </div>
        </div>
      </section>

      <footer className="foot">
        <div className="shell">
          <p className="mono">WE ARE RCAP · {CURRENT.label}</p>
          <p><a href="mailto:hello@wearercap.org">hello@wearercap.org</a></p>
        </div>
      </footer>

      {sheet && (
        <Sheet
          mode={sheet.mode}
          question={sheet.question}
          onClose={() => setSheet(null)}
          onDone={(post) => { setSheet(null); setDone(post); }}
        />
      )}
      {done && <Done post={done} onClose={() => setDone(null)} />}
    </>
  );
}
