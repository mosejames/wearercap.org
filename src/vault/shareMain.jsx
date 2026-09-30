import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { recipientShare, downloadShare } from './capsuleShare.js';
import './capsuleShare.css';

export function CapsuleSharePage() {
  const token = window.location.pathname.split('/')[2] || '';
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  useEffect(() => {
    let active = true;
    if (!/^[0-9a-f]{64}$/.test(token)) { setError('This private link is unavailable.'); setLoading(false); return; }
    recipientShare(token).then(data => { if (active) { setInfo(data); document.title = `${data.title} | Capsule Download`; } })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);
  const start = async quality => {
    setBusy(true); setError(''); setProgress(null);
    let destination;
    try {
      // Obtain a file destination during the click gesture, before network calls.
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({ suggestedName: `${info.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 100)}-${quality}-quality.zip`, types: [{ description: 'ZIP archive', accept: { 'application/zip': ['.zip'] } }] });
        destination = await handle.createWritable();
      }
      await downloadShare(token, quality, setProgress, destination);
    } catch (e) {
      if (destination) { try { await destination.abort(); } catch { /* already closed */ } }
      setProgress(null);
      if (e.name !== 'AbortError') setError(e.message || 'Download failed. Please try again.');
    } finally { setBusy(false); }
  };
  return <main className="capsule-share-page">
    <p className="share-eyebrow">{info?.house === 'amistad' ? 'AMI' : 'RCAP'} Capsule</p>
    <h1>{info?.title || 'Private Capsule Download'}</h1>
    {loading && <p role="status">Loading your capsule…</p>}
    {info && <>
      <p>Download the photos and videos from this capsule. No sign-in needed.</p>
      <p>{info.file_count} files available.</p>
      <div className="share-options">
        <section><h2>Web Quality</h2><p>Smaller photos for phones, social media and email. Videos and GIFs keep their saved quality.</p>
          <button disabled={busy || !info.allow_web_download || !info.file_count} onClick={() => start('web')}>Download All · Web Quality</button>
          {!info.allow_web_download && <p>This option is disabled.</p>}</section>
        <section><h2>Full Quality</h2><p>The highest quality files saved in this capsule, for printing, design and archiving.</p>
          <button disabled={busy || !info.allow_full_download || !info.file_count} onClick={() => start('full')}>Download All · Full Quality</button>
          {!info.allow_full_download && <p>This option is disabled.</p>}</section>
      </div>
      {!info.file_count && <p>There are no files available yet.</p>}
      <p className="share-note">Your ZIP is made when you download. Keep this page open until it finishes. For large capsules, use Chrome or Edge on a computer to save directly to disk.</p>
    </>}
    {busy && <p role="status">{progress ? `Saving ${progress.files} of ${progress.total} files…` : 'Preparing your download…'}</p>}
    {progress?.done && <p role="status">Your ZIP is ready. Check your downloads.{!progress.counted && ' Download statistics could not be updated.'}</p>}
    {error && <p role="alert">{error}</p>}
  </main>;
}
if (document.getElementById('root')) createRoot(document.getElementById('root')).render(<StrictMode><CapsuleSharePage /></StrictMode>);
