import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TOPICS, SEEDS } from './config.js';
import { listPublic } from './data.js';
import {
  FORM_URL, byline, useCompose, ComposeFields,
  Topbar, Footer, CountStrip, AdviceCard, QuestionCard,
} from './shared.jsx';

/* ------------------------------------------------------- answer, in a modal */

// Answering stays a modal because it is tied to one specific question on the
// board. Sending someone to the form page would lose that context.
function AnswerSheet({ question, onClose, onDone }) {
  const f = useCompose('answer', question);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label="Answer this">
      <button className="sheet-scrim" onClick={onClose} aria-label="Close" tabIndex={-1} />
      <div className="sheet ask">
        <div className="sheet-head">
          <span className="eyebrow">Parent to parent</span>
          <button className="sheet-x" onClick={onClose} aria-label="Close">×</button>
        </div>

        {done ? (
          <>
            <h2 className="sheet-title">Thank you. That is the good stuff.</h2>
            <p className="done-copy">
              A person reads every one before it goes on the board. Yours shows up once it is approved.
            </p>
            <button className="btn flame wide" onClick={onClose}>Back to the board</button>
          </>
        ) : (
          <>
            <h2 className="sheet-title">Answer this</h2>
            <blockquote className="quoted">
              <p>{question.headline}</p>
              <cite>{byline(question)}</cite>
            </blockquote>
            <ComposeFields f={f} mode="answer" />
            <button
              className="btn flame wide"
              onClick={() => f.submit(() => { setDone(true); onDone(); })}
              disabled={!f.ready || f.busy}
            >
              {f.busy ? 'Sending…' : 'Send my answer'}
            </button>
            <p className="review-note">
              Everything here is read by a person before it goes up.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- the board */

export default function Board() {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState('');
  const [answering, setAnswering] = useState(null);
  const [lane, setLane] = useState('all');  // all | advice | questions
  const [topic, setTopic] = useState('all');

  const reload = useCallback(async () => {
    try { setRows(await listPublic()); setLoadErr(''); }
    catch (e) { setLoadErr(e.message || 'Could not load the board.'); }
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 30000);
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => { document.body.style.overflow = answering ? 'hidden' : ''; }, [answering]);

  const advice = useMemo(() => rows.filter((r) => r.kind === 'advice'), [rows]);
  const questions = useMemo(() => rows.filter((r) => r.kind === 'question'), [rows]);
  const answersFor = useMemo(() => {
    const m = {};
    for (const r of rows) {
      if (r.kind !== 'answer' || !r.answersTo) continue;
      (m[r.answersTo] ||= []).push(r);
    }
    // Oldest answer first, so a thread reads in the order it happened.
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

  return (
    <>
      <Topbar />

      <section className="hero board-hero">
        <div className="shell">
          <p className="kicker">Parent to parent</p>
          <h1>What parents<br /><span className="grad">have shared.</span></h1>
          <p className="intro">
            Everything on this page was written by an RCA family and read by a
            person before it went up.
          </p>
          <CountStrip counts={{ advice: advice.length, questions: questions.length }} />
          <div className="hero-cta">
            <a className="btn flame" href={FORM_URL}>Add one of your own</a>
          </div>
        </div>
      </section>

      <section className="board" id="board">
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
              {lane === 'all' && <h2 className="lane-head">Questions from parents</h2>}
              <div className="grid">
                {shownQuestions.map((p) => (
                  <QuestionCard
                    key={p.id}
                    post={p}
                    answers={answersFor[p.id] || []}
                    onAnswer={(q) => setAnswering(q)}
                  />
                ))}
              </div>
            </>
          )}

          {loaded && !showSeeds && shownAdvice.length === 0 && shownQuestions.length === 0 && (
            <p className="empty">Nothing under this filter yet.</p>
          )}

          <div className="under-actions board-foot">
            <a className="btn flame" href={FORM_URL}>Add one of your own</a>
            <a className="btn ghost" href="/">Back to We Are RCAP</a>
          </div>
        </div>
      </section>

      <Footer />

      {answering && (
        <AnswerSheet
          question={answering}
          onClose={() => setAnswering(null)}
          onDone={reload}
        />
      )}
    </>
  );
}
