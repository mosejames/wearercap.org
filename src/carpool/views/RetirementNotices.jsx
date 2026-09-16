import { useEffect, useState } from 'react';
import { fetchRetirementNotices, dismissRetirementNotice } from '../retirementNotices.js';

export default function RetirementNotices({ userId, canCreate, onCreate }) {
  const [notices, setNotices] = useState([]);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(null);
  useEffect(() => {
    let active = true;
    setNotices([]);
    setError('');
    fetchRetirementNotices(userId).then((rows) => { if (active) setNotices(rows); })
      .catch(() => { if (active) setError('We could not load your carpool updates.'); });
    return () => { active = false; };
  }, [userId, retry]);
  return <>
    {error && <p role="alert">{error} <button className="cp-btn cp-btn--quiet" onClick={() => setRetry((n) => n + 1)}>Try again</button></p>}
    {notices.map((notice) => <section className="cp-next-step" key={notice.id} aria-labelledby={`notice-${notice.id}`}>
      <p className="cp-label">An update on your request</p>
      <h2 className="cp-h3" id={`notice-${notice.id}`}>Your next step is yours.</h2>
      <p>{notice.group_name} was a setup test that accidentally stayed visible. We have retired it and closed your waiting request. This was not a rejection of your family.</p>
      <p>Your family profile is still here. You can explore nearby families or start a crew in your own area. Starting a crew does not commit you to rides or add anyone automatically.</p>
      {canCreate && <button type="button" className="cp-btn cp-btn--primary cp-btn--block" onClick={onCreate}>Create your crew <span aria-hidden="true">→</span></button>}
      <button type="button" className="cp-btn cp-btn--quiet" disabled={busy !== null} onClick={async () => {
        setBusy(notice.id);
        setError('');
        try {
          await dismissRetirementNotice(notice.id, userId);
          setNotices((rows) => rows.filter((row) => row.id !== notice.id));
        } catch { setError('We could not dismiss this update. Please try again.'); }
        finally { setBusy(null); }
      }}>{busy === notice.id ? 'Saving…' : 'Got it'}</button>
    </section>)}
  </>;
}
