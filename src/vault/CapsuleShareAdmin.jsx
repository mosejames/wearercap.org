import { useEffect, useState } from 'react';
import { adminShare, shareUrl } from './capsuleShare.js';

export function CapsuleShareAdmin({ event, pass }) {
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    setBusy(true); setLink(null); setError('');
    adminShare(event.id, 'get', pass).then(value => { if (active) setLink(value); })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [event.id, pass]);
  const change = async (action, patch = {}) => {
    setBusy(true); setError(''); setMessage('');
    try { setLink(await adminShare(event.id, action, pass, patch)); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <section className="capsule-share-admin stack" aria-label="Private share link">
    <h3>Share capsule downloads</h3>
    <p className="fine">Create a private link to download all photos and videos from <b>{event.title}</b>. Open the download page yourself, or copy the link to share it. Choose which quality options to offer below. No sign-in is needed.</p>
    {link ? <>
      <a className="capsule-share-url" aria-label="Private share URL" href={shareUrl(link.token)} target="_blank" rel="noopener noreferrer">{shareUrl(link.token)}</a>
      <div className="capsule-share-buttons">
        <a className="btn small primary" href={shareUrl(link.token)} target="_blank" rel="noopener noreferrer">Open downloads</a>
        <button type="button" className="btn small ghost" disabled={busy} onClick={async () => {
          try { await navigator.clipboard.writeText(shareUrl(link.token)); setMessage('Link copied.'); }
          catch { setError('Select the link above and copy it.'); }
        }}>Copy Link</button>
        <button type="button" className="btn small ghost" disabled={busy} onClick={() => change('regenerate')}>Regenerate</button>
        <button type="button" className="btn small ghost" disabled={busy} onClick={() => change('update', { enabled: !link.enabled })}>{link.enabled ? 'Disable' : 'Enable'}</button>
      </div>
      <p className="fine">{!link.enabled ? 'Disabled' : link.expires_at && new Date(link.expires_at) <= new Date() ? 'Expired' : 'Enabled'} · {link.download_count} completed downloads. Regenerate replaces the URL and invalidates the old link.</p>
      {[['allow_web_download', 'Web Quality'], ['allow_full_download', 'Full Quality']].map(([key, label]) => <label key={key}>
        <input type="checkbox" checked={link[key]} disabled={busy} onChange={e => change('update', { [key]: e.target.checked })} /> {label}
      </label>)}
      <label className="field"><span>Expires at (optional)</span><input type="datetime-local" disabled={busy}
        value={link.expires_at ? localDateTime(link.expires_at) : ''}
        onChange={e => change('update', { expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
      <p className="fine">Created {new Date(link.created_at).toLocaleString()}. Expiry uses your local time.</p>
    </> : <button type="button" className="btn primary" disabled={busy} onClick={() => change('create')}>{busy ? 'Loading…' : 'Generate private link'}</button>}
    {error && <p className="err" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
function localDateTime(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
