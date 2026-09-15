import { useState } from 'react';
import { Send } from 'lucide-react';
import { COMMENT_MAX, relativeTime, friendlyError } from '../model.js';
import { Avatar } from './Chip.jsx';

/* A wall of short notes. No replies, no likes. */
export function ThreadList({ thread }) {
  if (!thread.length) return <p className="rv-empty">Nothing yet. Say what you are singing.</p>;
  return (
    <ol className="rv-thread">
      {thread.map((c) => (
        <li key={c.id} className="rv-note">
          <Avatar person={c} size={36} />
          <div>
            <p className="rv-note-meta"><b>{c.wall_name}</b> <time dateTime={c.created_at}>{relativeTime(c.created_at)}</time></p>
            <p className="rv-note-body">{c.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Composer({ onPost }) {
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
      await onPost(text);
      setBody('');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="rv-composer" onSubmit={submit}>
      {error && <p className="rv-failure" role="alert">{error}</p>}
      <div className="rv-composer-row">
        <input
          value={body} maxLength={COMMENT_MAX} onChange={(e) => setBody(e.target.value)}
          placeholder="Pick your song" aria-label="Add to the thread" enterKeyHint="send"
        />
        <button className="rv-send" disabled={busy || !body.trim()} aria-label="Post">
          <Send size={18} />
        </button>
      </div>
      {left <= 40 && <span className={`rv-left${left < 0 ? ' over' : ''}`}>{left}</span>}
    </form>
  );
}
