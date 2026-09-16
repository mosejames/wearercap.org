import { useEffect, useRef, useState } from 'react';
import { rewardCall } from './rewards.js';
import { SITE } from './config.js';
import { mediaUrl } from './data.js';
import { BadgeIcon } from './BadgeIcon.jsx';

export const capsuleCommunity = (action, args = {}) => rewardCall('capsule_community', { p_action: action, ...args });
const READ_EVENT = 'capsule-thanks-read';

export function ThankYouButton({ photoId, owner, onSignIn }) {
  const [thanked, setThanked] = useState(false);
  const [loading, setLoading] = useState(!!owner);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setThanked(false); setError(''); setLoading(!!owner);
    if (owner) capsuleCommunity('state', { p_photo: photoId }).then(r => { if (live) setThanked(r.thanked); })
      .catch(() => { if (live) setError('Could not load your thank-you.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [photoId, owner, retry]);
  const send = async () => {
    if (!owner) { onSignIn('Sign in to thank this parent privately.'); return; }
    setBusy(true); setError('');
    try { const r = await capsuleCommunity(thanked ? 'undo' : 'send', { p_photo: photoId }); setThanked(r.thanked); }
    catch (e) { setError(e.message || 'Your thank-you could not be sent.'); }
    finally { setBusy(false); }
  };
  return <div className="capsule-thank">
    <button className={`lb-action${thanked ? ' on' : ''}`} disabled={loading || busy} aria-pressed={thanked} onClick={send}>
      <span aria-hidden="true">♡</span><span>{busy ? 'Saving…' : thanked ? 'Thank-you sent ✓' : 'Thank you, that’s my kid!'}</span>
    </button>
    <small>{thanked ? 'Shared privately with the contributor. Tap again to undo.' : 'Only you and the contributor can see this. No leaderboard points.'}</small>
    {error && <p className="err" role="alert">{error} <button className="link" onClick={() => setRetry(n => n + 1)}>Try again</button></p>}
  </div>;
}

export function FirstShareBadge({ celebrate = false }) {
  return <div className={`capsule-first-share${celebrate ? ' celebrate' : ''}`} role={celebrate ? 'status' : undefined}>
    <BadgeIcon milestone={1} />
    <div><small>{celebrate ? 'Your first badge' : 'Earned'}</small><b>First Share</b>
      <p>{celebrate ? 'Your first memories are in the Capsule. Another family might find their favorite photo because of you.' : 'You shared a memory for another family to find.'}</p>
    </div>
  </div>;
}

export function uploadShareMessage(event) {
  return `Just added my ${event.title} photos! You might spot your family. Take a look and add yours: ${SITE.origin}${SITE.base}e/${encodeURIComponent(event.slug)}`;
}

export function PostUploadShare({ event }) {
  const [first, setFirst] = useState(false);
  const [status, setStatus] = useState('');
  const message = uploadShareMessage(event);
  const claim = useRef(null);
  useEffect(() => {
    let live = true;
    claim.current ||= capsuleCommunity('claim');
    claim.current.then(r => { if (live && r.first_share) setFirst(true); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); setStatus('Message copied. Ready for your group chat.'); }
    catch { setStatus('Select the message below and copy it to your group chat.'); }
  };
  const share = async () => {
    if (!navigator.share) { await copy(); return; }
    try { await navigator.share({ title: event.title, text: message }); setStatus('Shared. Thank you for bringing more families in.'); }
    catch (e) { if (e.name !== 'AbortError') setStatus('Sharing could not open. Try Copy message.'); }
  };
  return <section className="capsule-upload-share">
    {first && <FirstShareBadge celebrate />}
    <h4>Someone’s favorite photo might be yours.</h4>
    <p>Let your group chat know the photos are here.</p>
    <label className="field"><span>Ready to send</span><textarea aria-label="Group chat message" readOnly rows={4} value={message} onFocus={e => e.target.select()} /></label>
    <div className="row"><button className="btn primary" onClick={copy}>Copy message</button><button className="btn ghost" onClick={share}>Share</button></div>
    {status && <p className="fine" role="status">{status}</p>}
  </section>;
}

export function ThanksIndicator({ owner }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let live = true;
    setCount(0);
    if (!owner) return;
    const load = () => capsuleCommunity('summary').then(r => { if (live) setCount(r.unread); }).catch(() => {});
    load(); const timer = setInterval(load, 45000);
    window.addEventListener(READ_EVENT, load);
    return () => { live = false; clearInterval(timer); window.removeEventListener(READ_EVENT, load); };
  }, [owner]);
  return count > 0 ? <a href="#/me" className="capsule-thanks-count" aria-label={`${count} new thank-yous. Open your private thank-yous.`} title="New private thank-yous">{count > 99 ? '99+' : count}</a> : null;
}

export function CapsuleInbox({ owner, refresh }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true; setData(null); setError('');
    const load = () => capsuleCommunity('inbox', { p_offset: page * 20 }).then(r => { if (live) { setData(r); setError(''); } })
      .catch(() => { if (live) setError('Your private thank-yous could not load.'); });
    load(); const timer = setInterval(load, 45000);
    return () => { live = false; clearInterval(timer); };
  }, [owner, refresh, page, retry]);
  const markRead = async () => {
    setBusy(true); setError('');
    try {
      await capsuleCommunity('read', { p_ids: data.items.filter(i => !i.read_at).map(i => i.id) });
      setRetry(n => n + 1); window.dispatchEvent(new Event(READ_EVENT));
    } catch { setError('Could not mark these thank-yous as read.'); }
    finally { setBusy(false); }
  };
  return <section className="capsule-inbox" aria-label="Private thank-yous">
    {data?.first_share_at && <FirstShareBadge />}
    <h2>Thank-yous from families</h2><p className="fine">Private notes of appreciation for your photos. These don’t affect rankings.</p>
    {error && <p className="err" role="alert">{error} <button className="link" onClick={() => setRetry(n => n + 1)}>Try again</button></p>}
    {!data && !error && <p role="status">Loading your thank-yous…</p>}
    {data && <>{!data.total ? <p>When a parent taps “Thank you, that’s my kid!” on your photo, you’ll see it here.</p> : <>
      <ul className="capsule-thanks-list">{data.items.map(item => <li key={item.id} className={!item.read_at ? 'unread' : ''}>
        <a href={`#/e/${item.slug}/p/${item.photo_id}`}><img src={mediaUrl({ storage: item.storage, thumbKey: item.thumb_key }, 'thumb')} alt="" loading="lazy" />
          <span><b>{item.sender}</b><span>“Thank you, that’s my kid!”</span><small>{item.title}{!item.read_at ? ' · New' : ''}</small></span>
        </a>
      </li>)}</ul>
      {data.items.some(i => !i.read_at) && <button className="btn small ghost" disabled={busy} onClick={markRead}>{busy ? 'Saving…' : 'Mark these as read'}</button>}
      {(page > 0 || (page + 1) * 20 < data.total) && <div className="row"><button className="btn small ghost" disabled={!page} onClick={() => setPage(n => n - 1)}>Previous</button><span>Page {page + 1}</span><button className="btn small ghost" disabled={(page + 1) * 20 >= data.total} onClick={() => setPage(n => n + 1)}>Next</button></div>}
    </>}</>}
  </section>;
}
