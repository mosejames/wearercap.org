import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Share2 } from 'lucide-react';
import { CURRENT, SITE, MODES, topicById } from './config.js';
import { listPublic, waitForPublish, adminAll, setStatus, declineThread } from './data.js';
import {
  BOARD_URL, FORM_URL, byline, shortDate, useCompose, ComposeFields,
  Topbar, Footer, CountStrip, shareThisPage,
} from './shared.jsx';

// The back office is reached by typing #admin and has no chrome of its own, so
// without this it is a dead end: you deal with the queue and the only way out
// is the address bar. Every screen in here carries it.
function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="Go to">
      <a href={BOARD_URL}>← The board</a>
      <a href={FORM_URL}>The form</a>
      <a href="/">We Are RCAP</a>
    </nav>
  );
}

/* ------------------------------------------------------------- landing form */

// A segmented pill: one track, two labels, and a thumb that slides between
// them. The thumb is a separate element rather than a background on the active
// half so it can animate across instead of blinking from one side to the other.
function ModeToggle({ mode, setMode }) {
  return (
    <div
      className={`toggle ${mode === 'question' ? 'ask' : ''}`}
      role="tablist"
      aria-label="What do you want to do"
    >
      <span className="toggle-thumb" aria-hidden="true" />
      {['advice', 'question'].map((m) => (
        <button
          key={m}
          role="tab"
          aria-selected={mode === m}
          className={`toggle-half ${mode === m ? 'on' : ''}`}
          onClick={() => setMode(m)}
        >
          {MODES[m].label}
        </button>
      ))}
    </div>
  );
}

// Three states, because the honest answer is not known the instant someone
// hits send: waiting on the screen, live, or held for a person. The waiting
// state is deliberately short-lived and says nothing it might have to take
// back.
function DonePanel({ post, onAgain }) {
  const isQuestion = post.kind === 'question';
  const [state, setState] = useState('checking'); // checking | live | held

  useEffect(() => {
    let alive = true;
    waitForPublish(post.id).then((live) => {
      if (alive) setState(live ? 'live' : 'held');
    });
    return () => { alive = false; };
  }, [post.id]);

  const title = state === 'live'
    ? 'It’s live.'
    : isQuestion ? 'Your question is in.' : 'Thank you. That is the good stuff.';

  const copy = {
    checking: 'Putting it on the board…',
    live: isQuestion
      ? 'It is on the board now, where a parent who has been here can answer it.'
      : 'It is on the board now, where the families coming in will read it.',
    held: isQuestion
      ? 'A parent who has been here will answer it. Both the question and the answer get read before they go up, so give it a day.'
      : 'A person reads every one before it goes on the board. Yours shows up once it is approved.',
  }[state];

  return (
    <div className={`compose done-panel ${isQuestion ? 'ask' : ''}`}>
      <span className="eyebrow">{state === 'live' ? 'Published' : 'Got it'}</span>
      <h2 className="compose-title">{title}</h2>
      <p className={`done-copy ${state === 'checking' ? 'waiting' : ''}`}>{copy}</p>
      <blockquote className="quoted">
        <p>{post.headline}</p>
        <cite>{byline(post)}</cite>
      </blockquote>
      <div className="done-actions">
        <button className="btn flame" onClick={onAgain}>
          {isQuestion ? 'Ask another one' : 'Share another one'}
        </button>
        {state === 'live' && (
          <a className="btn ghost" href={BOARD_URL}>
            <BookOpen size={18} aria-hidden="true" />
            See it on the board
          </a>
        )}
      </div>
    </div>
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
        <AdminNav />
      </div>
    );
  }

  return (
    <div className="shell admin">
      <span className="eyebrow">RCAP · Wish I Knew back office</span>
      <h1>{counts.pending} waiting on you</h1>
      <p className="admin-sub">{counts.approved} live on the board · {counts.declined} declined</p>
      <AdminNav />

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

      {/* An empty queue is the normal state now that the screen publishes the
          clean ones itself, so it should read as finished rather than as a
          blank page, and it should offer somewhere to go. */}
      {shown.length === 0 && (
        <div className="empty-state">
          <p className="empty">
            {tab === 'pending'
              ? counts.approved > 0
                ? 'Nothing waiting on you. Everything that came in has been dealt with.'
                : 'Nothing waiting on you yet.'
              : tab === 'approved'
                ? 'Nothing has been published yet.'
                : 'Nothing has been declined.'}
          </p>
          <div className="under-actions">
            <a className="btn ghost" href={BOARD_URL}>
              <BookOpen size={18} aria-hidden="true" />
              See the board
            </a>
            <a className="btn ghost" href={FORM_URL}>Write one yourself</a>
          </div>
        </div>
      )}

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

// This page does exactly one job now: get one thing out of one parent. The
// board it feeds lives at BOARD_URL, because mixing "write something" and
// "read everything" on one screen made both of them long.
export default function App() {
  const [mode, setMode] = useState('advice');
  const [done, setDone] = useState(null);
  const [counts, setCounts] = useState({ advice: 0, questions: 0 });
  const [isAdmin, setIsAdmin] = useState(
    () => typeof window !== 'undefined' && window.location.hash === '#admin'
  );

  const f = useCompose(mode);

  // A finished submission clears when the toggle moves, so flipping the switch
  // always lands on a fresh form rather than someone else's receipt.
  useEffect(() => { setDone(null); }, [mode]);

  const loadCounts = useCallback(async () => {
    try {
      const rows = await listPublic();
      setCounts({
        advice: rows.filter((r) => r.kind === 'advice').length,
        questions: rows.filter((r) => r.kind === 'question').length,
      });
    } catch { /* the tally is decoration; a failure here must not block the form */ }
  }, []);

  useEffect(() => {
    loadCounts();
    const onHash = () => setIsAdmin(window.location.hash === '#admin');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [loadCounts]);

  if (isAdmin) return <Admin />;

  return (
    <>
      <Topbar />

      <section className={`hero ${mode === 'question' ? 'ask' : ''}`}>
        <div className="shell">
          <p className="kicker">{SITE.kicker}</p>

          {/* Switch first, then the headline it rewrites. Flipping the pill and
              watching the title change is the clearest way to show a parent
              that there are two lanes and which one they are standing in. */}
          <ModeToggle mode={mode} setMode={setMode} />

          <h1>
            {SITE.titleLead}<br />
            <span className="grad">{MODES[mode].label}.</span>
          </h1>
          <p className="intro">{MODES[mode].lead}</p>
        </div>
      </section>

      <section className={`compose-wrap ${mode === 'question' ? 'ask' : ''}`}>
        <div className="narrow">
          {done ? (
            <DonePanel post={done} onAgain={() => { setDone(null); f.reset(); }} />
          ) : (
            <div className={`compose ${mode === 'question' ? 'ask' : ''}`}>
              <ComposeFields f={f} mode={mode} />
              <button
                className="btn flame wide"
                onClick={() => f.submit((p) => { setDone(p); f.reset(); loadCounts(); })}
                disabled={!f.ready || f.busy}
              >
                {f.busy ? 'Sending…' : mode === 'question' ? 'Send my question' : 'Send it in'}
              </button>
              <p className="review-note">
                Everything here is read by a person before it goes up. This is the
                first thing many new families will see, so we keep it useful and
                we keep it kind.
              </p>
            </div>
          )}

          {/* Everything that is not the form sits down here, after the ask.
              Reading is the more useful next step of the two, so it gets the
              solid button and sharing keeps the outline. */}
          <div className="under-form">
            <CountStrip counts={counts} />
            <div className="under-actions">
              <a className="btn solid" href={BOARD_URL}>
                <BookOpen size={18} aria-hidden="true" />
                Read what other parents wrote
              </a>
              <button className="btn ghost" onClick={() => shareThisPage()}>
                <Share2 size={17} aria-hidden="true" />
                Share this page
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
