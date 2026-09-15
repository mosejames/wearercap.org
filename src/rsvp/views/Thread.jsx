import { useState } from 'react';
import { Shuffle, Lock } from 'lucide-react';
import { COMMENT_MAX, PROMPTS, nextPrompt, relativeTime, friendlyError } from '../model.js';
import { Avatar } from './Chip.jsx';

/* Answers on the wall, oldest first. Each one carries its question above it,
   so a line like "Ginuwine. Do not tell my husband." lands. */
// Four, deliberately. A long picker on a parent thread adds decisions without
// adding warmth.
export const REACTIONS = ['\u2764\ufe0f', '\ud83d\ude02', '\ud83d\udd25', '\ud83d\ude4c'];

function Reactions({ comment, canReact, onReact, onLockedClick }) {
  // Counts come from the server; this holds the in-flight state so a tap feels
  // instant and cannot be double-fired while the request is out.
  const [busy, setBusy] = useState('');
  const counts = comment.reactions || {};
  const mine = comment.mine || [];

  async function tap(emoji) {
    if (!canReact) return onLockedClick && onLockedClick();
    if (busy) return;
    setBusy(emoji);
    try {
      await onReact(comment.id, emoji);
    } finally {
      setBusy('');
    }
  }

  return (
    <p className="rv-reacts">
      {REACTIONS.map((emoji) => {
        const n = counts[emoji] || 0;
        const on = mine.indexOf(emoji) > -1;
        return (
          <button
            key={emoji}
            type="button"
            className={`rv-react${on ? ' on' : ''}${n ? '' : ' empty'}`}
            aria-pressed={on}
            aria-label={`${emoji} ${n}`}
            disabled={busy === emoji}
            onClick={() => tap(emoji)}
          >
            <span aria-hidden="true">{emoji}</span>
            {n > 0 && <b>{n}</b>}
          </button>
        );
      })}
    </p>
  );
}

export function ThreadList({ thread, canReact, onReact, onLockedClick }) {
  if (!thread.length) return <p className="rv-empty">Nobody has answered yet. Go first.</p>;
  return (
    <ol className="rv-thread">
      {thread.map((c) => (
        <li key={c.id} className="rv-note">
          <Avatar person={c} size={36} />
          <div>
            <p className="rv-note-meta"><b>{c.wall_name}</b> <time dateTime={c.created_at}>{relativeTime(c.created_at)}</time></p>
            {c.prompt && <p className="rv-note-q">{c.prompt}</p>}
            <p className="rv-note-body">{c.body}</p>
            <Reactions
              comment={c}
              canReact={canReact}
              onReact={onReact}
              onLockedClick={onLockedClick}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

/* The question card. Sits at the top of the thread, not in a bar at the
   bottom of the screen, so it is obvious that typing here adds to the wall.
   Parents who have not RSVP'd see the question too, with the way in. */
export function Composer({ locked, onPost, onLockedClick }) {
  const [prompt, setPrompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const left = COMMENT_MAX - body.length;

  async function submit(e) {
    e.preventDefault();
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError('');
    try {
      await onPost(text, prompt);
      setBody('');
      setPrompt((p) => nextPrompt(p));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="rv-ask" onSubmit={submit}>
      <div className="rv-ask-head">
        <span className="rv-ask-kicker">Answer one</span>
        <button type="button" className="rv-ask-shuffle" onClick={() => setPrompt((p) => nextPrompt(p))}>
          <Shuffle size={15} /> Another question
        </button>
      </div>
      <p className="rv-ask-q">{prompt}</p>
      {locked ? (
        <button type="button" className="rv-cta rv-cta-block" onClick={onLockedClick}>
          <Lock size={16} /> RSVP to answer
        </button>
      ) : (
        <>
          <textarea
            value={body} maxLength={COMMENT_MAX} rows={2} onChange={(e) => setBody(e.target.value)}
            placeholder="Your answer" aria-label={prompt}
          />
          {error && <p className="rv-failure" role="alert">{error}</p>}
          <div className="rv-ask-foot">
            <span className={`rv-left${left <= 40 ? ' show' : ''}${left < 0 ? ' over' : ''}`}>{left}</span>
            <button className="rv-cta" disabled={busy || !body.trim()}>{busy ? 'Posting' : 'Post to the wall'}</button>
          </div>
        </>
      )}
    </form>
  );
}
