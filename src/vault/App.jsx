import { createContext, useContext, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  HOUSE, YEAR, SITE, ASK, KINDS, MAX_BATCH, ADMIN_HINT, CONTACT,
  fmtDate, fmtRange, monthKey, monthLabel, todayISO, plural,
} from './config.js';
import {
  bannedMembers, unbanMember, syncIdentity, ownsUpload, requireContributor, signOut, removeUpload, reportUpload, reviewReports, dismissReport, banUploader,
  getOwner, localProfile, fetchProfile, saveProfile, localPass, rememberPass, checkPass,
  storageConfig, mediaUrl, listEvents, saveEvent,
  listContributorPhotos, listPhotos, listTopPhotos, listRecentPhotos, listMyPhotos,
  myLikes, like, unlike, listComments, commentCounts, addComment, hideComment,
  listRequests, saveRequest, listPhonesForAdmin, fetchTotals,
} from './data.js';
import { SaveMedia } from './SaveMedia.jsx';
import { ACTIVITIES, SuggestionForm, SuggestionReview, GalleryVisibility } from './Categories.jsx';
import { StaffPanel } from './AdminTools.jsx';
import { DashboardStats, MyActivity } from './Activity.jsx';
import { recordView } from './viewTracking.js';
import { Avatar, AvatarContext, CommunityPage, BadgeShelf, BadgeCelebration } from './Community.jsx';
import { rewardCall, saveAvatar } from './rewards.js';
import { followSheetViewport } from './sheetViewport.js';
import { isVideo } from './videos.js';
import { supabase, sendCode, verifyCode, authHeaders } from './auth.js';
import { uploadBatch } from './upload.js';
import { zipStream, saveStream } from './zipstream.js';

/* ------------------------------------------------------------- routing */

function useHash() {
  const [h, setH] = useState(() => window.location.hash);
  useEffect(() => {
    const f = () => setH(window.location.hash);
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return h;
}

function parseRoute(hash) {
  const raw = (hash || '').replace(/^#\/?/, '');
  const [path] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'e' && parts[1]) return { name: 'event', slug: parts[1], photoId: parts[2] === 'p' ? parts[3] : null };
  if (parts[0] === 'activity' && parts[1]) return { name: 'activity', category: parts[1] };
  if (parts[0] === 'community') return { name: 'community', eventId: parts[1] || '' };
  if (parts[0] === 'person' && parts[1]) return { name: 'person', owner: parts[1] };
  if (parts[0] === 'top') return { name: 'top' };
  if (parts[0] === 'me') return { name: 'me' };
  if (parts[0] === 'admin') return { name: 'admin' };
  return { name: 'home' };
}

const go = (path) => { window.location.hash = path; };

/* ------------------------------------------------------------- helpers */

const useDocTitle = (t) => { useEffect(() => { document.title = t ? `${t} · ${SITE.title}` : SITE.title; }, [t]); };

function useLockScroll(on) {
  useEffect(() => {
    if (!on) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [on]);
}

const fmtBytes = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : n >= 1e6 ? `${Math.round(n / 1e6)} MB` : `${Math.round(n / 1e3)} KB`);

const eventStatus = (e, today) => {
  if (e.ongoing || e.kind === 'everyday') return 'open';
  const end = e.endsOn || e.startsOn;
  if (e.startsOn > today) return 'upcoming';
  if (end >= today) return 'today';
  return 'past';
};

const initials = (name) => (name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

// A real path, not a hash, so the link preview can be about this one event.
// /ami-vault/e/<slug> is rewritten to api/vault-link.js by vercel.json.
const inviteUrl = (slug) => `${SITE.origin}${SITE.base}e/${slug}`;

/* --------------------------------------------------------------- icons */

const I = {
  heart: (f) => (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.4 5c2 0 3.4 1.1 4.1 2.2C11.2 6.1 12.6 5 14.6 5 18 5 20.1 8.4 18.6 11.8 16.5 16.4 12 21 12 21z"
        fill={f ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  comment: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  down: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  left: (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  right: (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3v12m0-12L8 7m4-4l4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
  ),
};

/* -------------------------------------------------------------- shells */

function Sheet({ title, onClose, children, wide = false }) {
  const backdrop = useRef(null);
  useLayoutEffect(() => followSheetViewport(backdrop.current), []);
  useLockScroll(true);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div ref={backdrop} className="sheet-back" onClick={onClose}>
      <div className={`sheet${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">{I.close}</button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast" role="status">{msg}</div>;
}

function useToast() {
  const [msg, setMsg] = useState('');
  const t = useRef(null);
  const show = useCallback((m, ms = 2600) => {
    setMsg(m);
    clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(''), ms);
  }, []);
  return [msg, show];
}

const ReportContext = createContext(() => {});
const FLAG = <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0" /></svg>;

function PhoneSheet({ onClose, onVerified, reason }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [seconds, setSeconds] = useState(0);
  useEffect(() => { if (!seconds) return; const id = setTimeout(() => setSeconds((n) => n - 1), 1000); return () => clearTimeout(id); }, [seconds]);
  const send = async () => {
    setBusy(true); setErr('');
    try { await sendCode(phone); setSent(true); setSeconds(60); }
    catch (e) { setErr(e.message || 'The text could not be sent. Please try again.'); }
    finally { setBusy(false); }
  };
  return <Sheet title={sent ? 'Check your texts' : 'Your memories, connected to you'} onClose={onClose}>
    <form className="stack" onSubmit={async (e) => {
      e.preventDefault(); if (!sent) return send();
      setBusy(true); setErr('');
      try { await verifyCode(phone, code); await onVerified(); }
      catch (ex) { setErr(ex.message || 'That code did not work. Please try again.'); }
      finally { setBusy(false); }
    }}>
      <p>{sent ? `Enter the six-digit code sent to ${phone}.` : reason || 'Verify your mobile number once to share, report a concern, and manage your uploads from any phone.'}</p>
      {!sent ? <label className="field"><span>Mobile number</span><input autoFocus type="tel" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(404) 555-0123" maxLength={24} /><small>Your number stays private. Release updates are optional. Message and data rates may apply.</small></label>
        : <label className="field"><span>Verification code</span><input autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></label>}
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn primary" disabled={busy}>{busy ? 'One moment…' : sent ? 'Verify and continue' : 'Text me a code'}</button>
      {sent && <div className="row"><button className="link" type="button" disabled={busy || seconds > 0} onClick={send}>{seconds ? `Resend in ${seconds}s` : 'Resend code'}</button><button type="button" className="link" disabled={busy} onClick={() => { setSent(false); setCode(''); setErr(''); }}>Change number</button></div>}
    </form>
  </Sheet>;
}
function ReportSheet({ photo, onClose }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');
  return <Sheet title={sent ? 'Thank you for looking out for our family' : 'Report a concern'} onClose={onClose}>
    {sent ? <div className="stack"><p>Your report is in the private review area. Your name will not be shared with other families. Reporting does not automatically remove an upload.</p><button className="btn primary" onClick={onClose}>Done</button></div>
    : <form className="stack" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { await reportUpload(photo.id, reason, note); setSent(true); } catch (ex) { setErr(ex.message); } finally { setBusy(false); } }}>
      <p>Help us keep the House of Friendship welcoming. What needs our attention?</p>
      <label className="field"><span>Reason</span><select required value={reason} onChange={(e) => setReason(e.target.value)}><option value="">Choose a reason</option><option value="inappropriate">Inappropriate content</option><option value="privacy">Please remove a photo of me or my child</option><option value="spam">Spam or unrelated content</option><option value="other">Something else</option></select></label>
      <label className="field"><span>A little more detail <i>optional</i></span><textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label>
      {err && <p role="alert" className="err">{err}</p>}
      <button className="btn primary" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
    </form>}
  </Sheet>;
}
function ModerationPanel({ pass, onChanged }) {
  const [reports, setReports] = useState(null);
  const [banned, setBanned] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => Promise.all([reviewReports(pass), bannedMembers(pass)]).then(([r, b]) => { setReports(r); setBanned(b); }).catch((e) => setErr(e.message)), [pass]);
  useEffect(() => { load(); const timer = setInterval(load, 60000); return () => clearInterval(timer); }, [load]);
  const act = async (fn) => { setBusy(true); setErr(''); try { await fn(); await load(); onChanged(); } catch (e) { setErr(e.message); } finally { setBusy(false); } };
  return <section className="adm-sec"><div className="adm-head"><h2>Community reports {reports?.length ? `(${reports.length})` : ''}</h2><button className="btn small ghost" onClick={load}>Refresh</button></div>
    <p className="fine">Uploads appear immediately. Reports stay private and do not automatically hide anything.</p>
    {err && <p className="err" role="alert">{err}</p>}
    {reports === null ? <p>Loading reports…</p> : !reports.length ? <p>No open concerns. Thank you for looking after our family.</p> : reports.map((r) => <article className="moderation-report" key={r.id}>
      <img src={mediaUrl(r.photo, 'thumb')} alt="Reported upload" />
      <div><b>{r.event}</b>{r.photo.cleanupPending && <p className="err">Hidden from the gallery. Retry removal to finish deleting the files.</p>}<details className="moderation-preview"><summary>View full upload</summary>{isVideo(r.photo) ? <video controls playsInline preload="none" src={mediaUrl(r.photo, 'orig')} /> : <img src={mediaUrl(r.photo, 'web')} alt="Reported upload for review" loading="lazy" />}</details><p>{r.photo.uploaderName || 'Amistad family'} · {r.reason === 'privacy' ? 'Removal requested by family' : r.reason}</p>{r.note && <p>{r.note}</p>}
        <div className="row"><button className="btn small ghost" disabled={busy} onClick={() => act(() => dismissReport(r.id, pass))}>Dismiss report</button>
        <button className="btn small primary" disabled={busy} onClick={() => { if (confirm('Remove this upload and delete its stored files?')) act(() => removeUpload(r.photo.id, pass)); }}>Remove upload</button>
        {r.can_ban && !r.banned && <button className="btn small ghost" disabled={busy} onClick={() => { if (confirm('Ban this verified number from uploading, commenting, and reporting?')) act(() => banUploader(r.photo.id, pass)); }}>Ban contributor</button>}
        {r.can_ban && <button className="btn small ghost" disabled={busy} onClick={() => { if (confirm('Ban this number and hide all their uploads and comments?')) act(() => banUploader(r.photo.id, pass, true)); }}>Ban and hide all</button>}
        {r.banned && <span className="fine">Contributor banned</span>}
        {!r.can_ban && <span className="fine">Older upload: no verified number linked yet.</span>}
        </div>
      </div>
    </article>)}
    {banned.length > 0 && <details><summary>Banned contributors ({banned.length})</summary>{banned.map((b) => <div className="row" key={b.user_id}><span>{b.name || 'Contributor'} · number ending {b.last_four}</span><button className="btn small ghost" disabled={busy} onClick={() => { if (confirm('Allow this number to contribute again? Hidden uploads will stay hidden.')) act(() => unbanMember(b.user_id, pass)); }}>Lift ban</button></div>)}</details>}
  </section>;
}

/* ------------------------------------------------------------- profile */

function ProfileSheet({ profile, onSaved, onClose, firstTime, reason }) {
  const [form, setForm] = useState({
    displayName: profile?.display_name || '',
    student: profile?.student || '',
    releaseOptIn: profile?.release_opt_in === true,
    badgeTextOptIn: profile?.badge_text_opt_in === true,
  });
  const [textsAvailable, setTextsAvailable] = useState(false);
  useEffect(() => { let live=true; fetch('/api/vault-badge-text').then(r=>r.json()).then(r=>{if(live)setTextsAvailable(!!r.available);}).catch(()=>{}); return()=>{live=false;}; }, []);
  const [avatarFile, setAvatarFile] = useState(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  useEffect(() => { if (!avatarFile) { setAvatarPreview(null); return; } const url = URL.createObjectURL(avatarFile); setAvatarPreview(url); return () => URL.revokeObjectURL(url); }, [avatarFile]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (form.displayName.trim().length < 2) { setErr('Add the name you want on your photos.'); return; }
    setBusy(true); setErr('');
    try { const saved = await saveProfile(form); if (avatarFile || removeAvatar) await saveAvatar(avatarFile, removeAvatar); onSaved(saved); }
    catch (ex) { setErr(ex.message || 'Could not save.'); setBusy(false); }
  };
  return (
    <Sheet title={firstTime ? 'Who is this?' : 'Your name and preferences'} onClose={busy ? () => {} : onClose}>
      <form className="stack" onSubmit={submit}>
        {firstTime && <p className="lede">{reason || 'One quick thing so your photos have a name on them.'} Your phone is verified. Choose the name your Amistad family will see.</p>}
        <div className="profile-photo-picker"><Avatar owner={profile?.owner} name={form.displayName} photo={avatarPreview} hidePhoto={removeAvatar} large /><label className="field"><span>Profile photo <i>optional</i></span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" disabled={busy} onChange={e=>{setAvatarFile(e.target.files?.[0] || null);setRemoveAvatar(false);}} /><small>A headshot helps your Amistad family recognize you.</small></label></div>
        {profile && <button type="button" className="btn small ghost" disabled={busy} onClick={()=>{setRemoveAvatar(true);setAvatarFile(null);}}>Use my initials instead{removeAvatar ? ' ✓' : ''}</button>}
        <label className="field">
          <span>Your name</span>
          <input autoFocus value={form.displayName} onChange={set('displayName')} placeholder="Keisha J." maxLength={60} />
        </label>
        <label className="field">
          <span>Student(s) <i>optional</i></span>
          <input value={form.student} onChange={set('student')} placeholder="Jordan, 6th" maxLength={80} />
        </label>
        <label className="release-opt-in"><input type="checkbox" checked={form.badgeTextOptIn} disabled={!textsAvailable && !form.badgeTextOptIn} onChange={e=>setForm(f=>({...f,badgeTextOptIn:e.target.checked}))} /><span><b>Celebrate my milestones by text</b><span>Text me when I earn a new Ami Vault photo badge.</span><small>{textsAvailable ? 'Optional. One text per new badge, up to five photo milestones. Message and data rates may apply. Reply STOP to opt out, or turn this off here anytime.' : 'Milestone texts are being connected. You can still collect and celebrate every badge in the Vault.'}</small></span></label>
        <label className="release-opt-in"><input type="checkbox" checked={form.releaseOptIn} onChange={(e) => setForm((f) => ({ ...f, releaseOptIn: e.target.checked }))} /><span><b>Keep me in the loop</b><span>Text me about future Vault releases.</span><small>Optional. You can change this anytime in My Vault → Edit profile. Message and data rates may apply.</small></span></label>
        {err && <p className="err">{err}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : firstTime ? 'Into the vault' : 'Save'}</button>
      </form>
    </Sheet>
  );
}

/* -------------------------------------------------------------- upload */

function UploadSheet({ event, profile, onClose, onDone }) {
  const [files, setFiles] = useState([]);
  const [state, setState] = useState(null);
  const [err, setErr] = useState('');
  const abort = useRef(null);
  const inputRef = useRef(null);
  const [quality, setQuality] = useState('original');
  const [optimized, setOptimized] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState('');
  const [optimizationNotes, setOptimizationNotes] = useState([]);
  const optimizationAbort = useRef(null);
  useEffect(() => () => optimizationAbort.current?.abort(), []);
  const optimize = async () => {
    const controller = new AbortController();
    optimizationAbort.current = controller;
    setOptimizing(true); setOptimized(null); setOptimizationNotes([]); setErr('');
    const results = [], notes = [];
    try {
      const { optimizeVideo } = await import('./optimize-video.js');
      for (const file of files) {
        controller.signal.throwIfAborted();
        if (!isVideo(file)) { results.push(file); continue; }
        setOptimizationProgress(`Optimizing ${file.name}…`);
        try {
          const result = await optimizeVideo(file, { signal: controller.signal, onProgress: (p) => setOptimizationProgress(`${file.name}: ${Math.round(p * 100)}%`) });
          results.push(result);
          notes.push(`${file.name}: ${fmtBytes(file.size)} → ${fmtBytes(result.size)}${result === file ? ' (original kept; no size saving)' : ''}`);
        } catch (e) {
          if (controller.signal.aborted) throw e;
          results.push(file);
          notes.push(`${file.name}: original kept. ${e.message}`);
        }
      }
      setOptimized(results); setOptimizationNotes(notes);
    } catch (e) { if (!controller.signal.aborted) setErr(e.message); }
    finally { setOptimizing(false); setOptimizationProgress(''); }
  };
  const uploadFiles = quality === 'smaller' && optimized ? optimized : files;

  const pick = (e) => {
    const list = Array.from(e.target.files || []).filter((f) => /^image\//.test(f.type) || /\.(hei[cf]|jpe?g|png|webp)$/i.test(f.name) || isVideo(f));
    if (!list.length) { setErr('Choose photos or MP4, MOV, or WebM videos.'); return; }
    setErr(list.length > MAX_BATCH ? `First ${MAX_BATCH} taken. Add the rest in another round.` : '');
    setFiles(list.slice(0, MAX_BATCH));
    setOptimized(null); setOptimizationNotes([]);
  };

  const start = async () => {
    setErr('');
    abort.current = new AbortController();
    try {
      const final = await uploadBatch(uploadFiles, { event, profile, onProgress: setState, signal: abort.current.signal });
      setState(final);
      if (final.done.length) onDone(final.done);
    } catch (ex) {
      setErr(ex.message || 'Upload failed.');
    }
  };

  const finished = !!state?.finished;
  const pct = state ? Math.round(((state.prepared / (state.total || 1)) * 25) + ((state.bytesTotal ? state.bytesSent / state.bytesTotal : 0) * 75)) : 0;

  return (
    <Sheet title={`Add photos or videos · ${event.title}`} onClose={() => { optimizationAbort.current?.abort(); onClose(); }}>
      {!state ? (
        <div className="stack">
          <p className="lede">Choose photos or videos, up to 50 MB each. MP4, MOV, and WebM videos are supported when your browser can read them. H.264 MP4 works best across devices. Photos keep their originals. Videos use the quality you choose below.</p>
          <input ref={inputRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm,.heic,.heif,.mp4,.mov,.webm" multiple hidden onChange={pick} />
          <button className="btn ghost big" disabled={optimizing} onClick={() => inputRef.current?.click()}>
            {files.length ? `${plural(files.length, 'file')} picked · change` : 'Choose photos or videos'}
          </button>
          {files.length > 0 && (
            <div className="pick-preview">
              {files.slice(0, 12).map((f, i) => <PickThumb key={i} file={f} />)}
              {files.length > 12 && <span className="pick-more">+{files.length - 12}</span>}
            </div>
          )}
          {files.some(isVideo) && <div className="stack">
            <fieldset className="video-quality" disabled={optimizing}>
              <legend>Video quality</legend>
              <label><input type="radio" name="video-quality" checked={quality === 'original'} onChange={() => setQuality('original')} /><span><b>Original quality</b><small>Keep the file exactly as it is.</small></span></label>
              <label><input type="radio" name="video-quality" checked={quality === 'smaller'} onChange={() => setQuality('smaller')} /><span><b>Smaller upload</b><small>Reduce video size on this device. The smaller copy replaces the original in the vault.</small></span></label>
            </fieldset>
            {quality === 'smaller' && <>
              <p className="fine">Up to 1080p for standard video, with sound preserved. Keep this page open. You can review sizes before uploading.</p>
              {!optimized && !optimizing && <button className="btn ghost" onClick={optimize}>Optimize videos</button>}
              {optimizing && <><p role="status">{optimizationProgress}</p><button className="btn ghost" onClick={() => optimizationAbort.current?.abort()}>Cancel optimization</button></>}
              {optimizationNotes.length > 0 && <ul className="optimization-notes">{optimizationNotes.map((note, i) => <li key={i}>{note}</li>)}</ul>}
            </>}
            {!optimizing && <p className="fine">Ready to upload: {fmtBytes(uploadFiles.reduce((n, f) => n + f.size, 0))}. Each file must be 50 MB or smaller.</p>}
          </div>}
          {err && <p className="err">{err}</p>}
          <button className="btn primary" disabled={!files.length || optimizing || (files.some(isVideo) && quality === 'smaller' && !optimized)} onClick={start}>
            Add {files.length ? plural(files.length, 'file') : 'files'} to the vault
          </button>
          <p className="fine">Adding as <b>{profile?.display_name}</b>. Anyone in the house can see, like, comment on, and download what you add.</p>
        </div>
      ) : (
        <div className="stack">
          <div className="bar"><i style={{ width: `${Math.min(100, pct)}%` }} /></div>
          <p className="lede">
            {finished
              ? `${plural(state.done.length, 'file')} added.`
              : state.prepared < state.total
                ? `Preparing ${state.prepared + 1} of ${state.total}…`
                : `Uploading · ${fmtBytes(state.bytesSent)} of ${fmtBytes(state.bytesTotal)}`}
          </p>
          {state.failed.length > 0 && (
            <div className="failed">
              <b>{plural(state.failed.length, 'file')} skipped</b>
              <ul>{state.failed.map((f, i) => <li key={i}>{f.name} <span>{f.error}</span></li>)}</ul>
            </div>
          )}
          {err && <p className="err">{err}</p>}
          {finished
            ? <button className="btn primary" onClick={onClose}>See them in the vault</button>
            : <button className="btn ghost" onClick={() => abort.current?.abort()}>Stop</button>}
          {!finished && <p className="fine">Keep this screen open until it finishes.</p>}
        </div>
      )}
    </Sheet>
  );
}

function PickThumb({ file }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return <span className="pick-thumb">{url && (isVideo(file) ? <span className="picked-video" aria-label="Video">▶</span> : <img src={url} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />)}</span>;
}

/* ------------------------------------------------------------ download */

function DownloadSheet({ event, photos, onClose }) {
  const [which, setWhich] = useState('web');
  const [prog, setProg] = useState(null);
  const [err, setErr] = useState('');
  const est = (w) => photos.reduce((n, p) => n + (w === 'orig' || isVideo(p) ? (p.bytes || 3_500_000) : 350_000), 0);
  const start = async () => {
    setErr('');
    try {
      const pad = String(photos.length).length;
      const entries = photos.map((p, i) => {
        const ext = which === 'orig' || isVideo(p) ? (p.key.split('.').pop() || 'jpg') : 'jpg';
        const who = (p.uploaderName || 'amistad').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        const when = p.takenAt ? p.takenAt.slice(0, 10) : p.createdAt.slice(0, 10);
        return {
          name: `${event.slug}/${String(i + 1).padStart(pad, '0')}-${when}-${who}.${ext}`,
          date: p.takenAt || p.createdAt,
          open: async () => {
            const r = await fetch(mediaUrl(p, isVideo(p) ? 'orig' : which));
            if (!r.ok) throw new Error(`Could not fetch ${p.id}`);
            return r;
          },
        };
      });
      const stream = zipStream(entries, { onProgress: setProg });
      const how = await saveStream(stream, `amistad-${YEAR.start.slice(0, 4)}-${YEAR.end.slice(2, 4)}-${event.slug}${which === 'orig' ? '-originals' : ''}.zip`);
      if (how === 'cancelled') setProg(null);
    } catch (ex) {
      setErr(ex.message || 'Download failed.');
      setProg(null);
    }
  };
  const done = prog?.done;
  return (
    <Sheet title={`Download · ${event.title}`} onClose={onClose}>
      {!prog ? (
        <div className="stack">
          <p className="lede">{plural(photos.length, 'file')} as one zip.</p>
          <div className="choice">
            <button className={which === 'web' ? 'on' : ''} onClick={() => setWhich('web')}>
              <b>Web size</b><span>Smaller photos for screens. Videos stay original size. ~{fmtBytes(est('web'))}</span>
            </button>
            <button className={which === 'orig' ? 'on' : ''} onClick={() => setWhich('orig')}>
              <b>Originals</b><span>Exactly what was uploaded. Full size. ~{fmtBytes(est('orig'))}</span>
            </button>
          </div>
          {which === 'orig' && est('orig') > 1.2e9 && (
            <p className="fine">That is a big one. On a phone it may not finish; use a computer with Chrome, which streams straight to disk.</p>
          )}
          {err && <p className="err">{err}</p>}
          <button className="btn primary" onClick={start}>Start download</button>
        </div>
      ) : (
        <div className="stack">
          <div className="bar"><i style={{ width: `${Math.round((prog.files / photos.length) * 100)}%` }} /></div>
          <p className="lede">{done ? 'Done. Check your downloads.' : `${prog.files} of ${photos.length} · ${fmtBytes(prog.bytes)}`}</p>
          {!done && <p className="fine">Keep this open until it finishes.</p>}
          {done && <button className="btn ghost" onClick={onClose}>Close</button>}
        </div>
      )}
    </Sheet>
  );
}

/* -------------------------------------------------------------- invite */

function InviteSheet({ event, onClose }) {
  const [copied, setCopied] = useState('');
  const url = inviteUrl(event.slug);
  const when = event.ongoing ? 'all year' : fmtRange(event.startsOn, event.endsOn);
  const message = `${event.title}: let's relive the fun! Take a peek at the gallery, then check your camera roll for the smiles, laughs, and unforgettable moments. Add yours and help our Amistad family keep the memories together: ${url}`;

  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); }
    catch { prompt('Copy this', text); }
    setCopied(what);
    setTimeout(() => setCopied(''), 1800);
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: event.title, text: message }); return; } catch { /* cancelled */ } }
    copy(message, 'message');
  };

  return (
    <Sheet title="Invite to upload" onClose={onClose}>
      <div className="stack">
        <p className="lede">Invite our Amistad family to relive <b>{event.title}</b> and add their favorite photos and videos.</p>
        <div className="invite-card">
          <span className="eyebrow">The link</span>
          <code>{url}</code>
          <span className="fine">{when}</span>
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => copy(url, 'link')}>{copied === 'link' ? 'Copied' : 'Copy link'}</button>
          <button className="btn ghost" onClick={() => copy(message, 'message')}>{copied === 'message' ? 'Copied' : 'Copy message'}</button>
          {typeof navigator !== 'undefined' && navigator.share && (
            <button className="btn ghost" onClick={share}>{I.share} Share</button>
          )}
        </div>
        <label className="field">
          <span>The message</span>
          <textarea rows={4} readOnly value={message} onFocus={(e) => e.target.select()} />
        </label>
        <p className="fine">
          The shared preview includes an AMI Vault image with this event’s name, so everyone knows where to add their photos.
          {!event.open && ' Heads up: this event is closed to new photos, so the link will not let anyone add.'}
        </p>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------ lightbox */

function Lightbox({ photos, index, onIndex, onClose, owner, profile, liked, onLike, admin, pass, onHidden, onNeedName, event }) {
  const askReport = useContext(ReportContext);
  const [viewReadyId, setViewReadyId] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [liking, setLiking] = useState(false);
  const p = photos[index];
  const [comments, setComments] = useState(null);
  const [body, setBody] = useState('');
  const [videoError, setVideoError] = useState(false);
  const [busy, setBusy] = useState(false);
  const touch = useRef(null);
  useLockScroll(true);
  useEffect(() => {
    if (viewReadyId !== p.id || (owner && ownsUpload(p.owner)) || admin) return;
    let timer;
    const schedule = () => { clearTimeout(timer); if (document.visibilityState === 'visible') timer = setTimeout(() => recordView(p.id), 1500); };
    schedule(); document.addEventListener('visibilitychange', schedule);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', schedule); };
  }, [p.id, p.owner, viewReadyId, owner, admin]);

  useEffect(() => {
    setComments(null);
    setVideoError(false);
    let alive = true;
    listComments(p.id).then((c) => { if (alive) setComments(c); }).catch(() => setComments([]));
    return () => { alive = false; };
  }, [p.id]);

  useEffect(() => {
    const k = (e) => {
      if (saving) return;
      if (e.key === 'Escape') onClose();
      if (['INPUT', 'TEXTAREA', 'VIDEO'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [index, photos.length, onClose, onIndex, saving]);

  // Preload neighbours so a swipe feels instant.
  useEffect(() => {
    [index + 1, index - 1].forEach((i) => { if (photos[i]) { const im = new Image(); im.src = mediaUrl(photos[i], 'web'); } });
  }, [index, photos]);

  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0 && index < photos.length - 1) onIndex(index + 1);
      if (dx > 0 && index > 0) onIndex(index - 1);
    } else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.6) onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!profile) { onNeedName('Add your name so the house knows who said it.'); return; }
    if (!body.trim()) return;
    setBusy(true);
    try {
      const c = await addComment(p.id, profile.display_name || '', body);
      setComments((cs) => [...(cs || []), c]);
      setBody('');
    } catch (ex) { alert(ex.message); }
    finally { setBusy(false); }
  };

  const share = async () => {
    const url = `${SITE.origin}${SITE.base}#/e/${event.slug}/p/${p.id}`;
    if (navigator.share) { try { await navigator.share({ title: `${event.title} · ${SITE.title}`, url }); return; } catch { /* cancelled */ } }
    try { await navigator.clipboard.writeText(url); alert('Link copied.'); } catch { prompt('Copy this link', url); }
  };

  const mine = owner && ownsUpload(p.owner);
  const when = p.takenAt || p.createdAt;

  return (
    <div className="lb" onTouchStart={saving ? undefined : onTouchStart} onTouchEnd={saving ? undefined : onTouchEnd}>
      <div className="lb-top">
        <button className="icon-btn" onClick={onClose} aria-label="Close">{I.close}</button>
        <span className="lb-count">{index + 1} / {photos.length}</span>
        <div className="lb-top-actions">
          <button className="icon-btn" onClick={share} aria-label="Share">{I.share}</button>
          <button className="icon-btn" onClick={() => setSaving(true)} aria-label="Download or save to Photos">{I.down}</button>
        </div>
      </div>
      <div className="lb-stage" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {index > 0 && <button className="lb-nav prev" onClick={() => onIndex(index - 1)} aria-label="Previous">{I.left}</button>}
        {isVideo(p) ? <video key={p.id} onLoadedData={() => setViewReadyId(p.id)} className="vault-video" onError={() => setVideoError(true)} controls playsInline preload="metadata" poster={mediaUrl(p, 'web')} src={mediaUrl(p, 'orig')} onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
          Your browser cannot play this video. Download the original to watch it.
        </video> : <img key={p.id} onLoad={() => setViewReadyId(p.id)} src={mediaUrl(p, 'web')} alt={p.caption || ''} width={p.width || undefined} height={p.height || undefined} />}
        {index < photos.length - 1 && <button className="lb-nav next" onClick={() => onIndex(index + 1)} aria-label="Next">{I.right}</button>}
      </div>
      <div className="lb-panel">
        <div className="lb-meta">
          <Avatar owner={p.owner} name={p.uploaderName} />
          <div>
            <a className="lb-uploader" href={`#/person/${p.owner}`} onClick={onClose}><b>{p.uploaderName || 'Amistad family'}</b></a>
            <small>{fmtDate(when, { year: 'numeric' })}{p.takenAt ? '' : ' · added'}{p.hidden ? ' · hidden' : ''}</small>
          </div>
        </div>
        <div className="lb-actions" aria-label="Photo actions">
          {mine ? (
            <span className="lb-like-count">{I.heart(false)} {p.likes || 0} {(p.likes || 0) === 1 ? 'like' : 'likes'}</span>
          ) : (
            <button className={`lb-action${liked ? ' on' : ''}`} disabled={liking} onClick={async () => {
              if (!owner || !profile) { onNeedName('Sign in to leave a little love.'); return; }
              setLiking(true); try { await onLike(p); } finally { setLiking(false); }
            }} aria-pressed={liked} aria-label={liked ? 'Unlike photo' : 'Like photo'}>
              {I.heart(liked)}<span>{liked ? 'Liked' : 'Like'}{p.likes > 0 ? ` · ${p.likes}` : ''}</span>
            </button>
          )}
          <div className="lb-manage-actions">
            {!mine && <button className="lb-action" onClick={() => askReport(p)} aria-label="Report a concern">{FLAG}<span>Report</span></button>}
            {(mine || admin) && <button className="lb-action lb-delete" disabled={removing} onClick={async () => {
              if (!confirm('Confirm deletion')) return;
              setRemoving(true);
              try { await removeUpload(p.id, pass); onHidden(p, true); onClose(); }
              catch (e) { alert(e.message); }
              finally { setRemoving(false); }
            }}>{removing ? 'Deleting…' : 'Delete'}</button>}
            {admin && !mine && <button className="lb-action" onClick={async () => { if (!confirm('Ban this uploader’s verified number from contributing?')) return; try { await banUploader(p.id, pass); alert('Contributor banned.'); } catch(e) { alert(e.message); } }}>Ban contributor</button>}
          </div>
        </div>
        {videoError && <p className="fine">This browser cannot play this video. <a href={mediaUrl(p, 'orig')} download target="_blank" rel="noopener">Download the original</a> to watch it.</p>}
        {p.caption && <p className="lb-cap">{p.caption}</p>}
        <div className="lb-comments">
          {comments === null ? <p className="fine">Loading…</p> : comments.length === 0 ? <p className="fine">Be the first to leave a little love.</p> : (
            comments.map((c) => (
              <div key={c.id} className={`cmt${c.hidden ? ' hidden' : ''}`}>
                <b>{c.author || 'Someone'}</b>
                <span>{c.body}</span>
                {(admin || (owner && ownsUpload(c.owner))) && !c.hidden && (
                  <button className="cmt-x" onClick={async () => { try { await hideComment(c.id, pass); setComments((cs) => cs.map((x) => (x.id === c.id ? { ...x, hidden: true } : x))); } catch (ex) { alert(ex.message); } }}>remove</button>
                )}
              </div>
            ))
          )}
        </div>
        <form className="lb-form" onSubmit={submit}>
          <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={profile ? 'Add a comment' : 'Add your name to comment'} maxLength={500}
            onFocus={() => { if (!profile) onNeedName('Add your name so the house knows who said it.'); }} />
          <button className="btn small" disabled={busy || !body.trim()}>Post</button>
        </form>
      </div>
      {saving && <Sheet title={isVideo(p) ? 'Save this video' : 'Save this photo'} onClose={() => setSaving(false)}><SaveMedia key={p.id} photo={p} onClose={() => setSaving(false)} /></Sheet>}
    </div>
  );
}

/* ---------------------------------------------------------------- grid */

function PhotoGrid({ photos, onOpen, likedSet, counts, emptyText, rank = false }) {
  if (!photos.length) return <p className="empty">{emptyText || 'Nothing here yet.'}</p>;
  return (
    <div className="grid">
      {photos.map((p, i) => (
        <div className="tile-wrap" key={p.id}><button className={`tile${p.hidden ? ' hidden' : ''}`} onClick={() => onOpen(i)} aria-label={`${isVideo(p) ? 'Video' : 'Photo'} by ${p.uploaderName || 'a family'}`}>
          <img src={mediaUrl(p, 'thumb')} width={p.width || undefined} height={p.height || undefined} alt="" loading="lazy" decoding="async" />
          {isVideo(p) && <span className="video-badge" aria-hidden="true">▶ Video</span>}
          {rank && i < 3 && <span className="rank">{i + 1}</span>}
          {(p.likes > 0 || (counts && counts.get(p.id))) && (
            <span className="tile-meta">
              {p.likes > 0 && <em className={likedSet?.has(p.id) ? 'on' : ''}>{I.heart(true)}{p.likes}</em>}
              {counts?.get(p.id) > 0 && <em>{I.comment}{counts.get(p.id)}</em>}
            </span>
          )}
        </button></div>
      ))}
    </div>
  );
}

/* --------------------------------------------------------- coming soon */

// Thirty-odd blank cards for events months away buried the handful that
// actually want photos today. Everything ahead folds into one card.
function ComingSoonSheet({ events, onClose, onInvite, admin }) {
  const byMonth = useMemo(() => {
    const m = new Map();
    for (const e of events) {
      const k = monthKey(e.startsOn);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    }
    return [...m.entries()];
  }, [events]);
  return (
    <Sheet title={`Coming up · ${events.length}`} onClose={onClose}>
      <div className="stack">
        <p className="fine">Every event still ahead this year. They open for photos on their own, but you can invite early.</p>
        {byMonth.map(([k, list]) => (
          <div key={k} className="soon-month">
            <h4>{monthLabel(k)}</h4>
            {list.map((e) => (
              <div key={e.id} className="soon-row">
                <a href={`#/e/${e.slug}`} onClick={onClose}>
                  <b>{e.title}</b>
                  <span>{fmtRange(e.startsOn, e.endsOn)} · {(KINDS[e.kind] || KINDS.school).label}</span>
                </a>
                {admin && <button className="link" onClick={() => onInvite(e)}>invite</button>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------- top bar */

function TopBar({ profile, admin, onName, onProfile, route, reportCount }) {
  return (
    <header className="topbar calm-header">
      <div className="shell topbar-in">
        <a href="#/" className="mark" aria-label={SITE.title}>
          <span className="vault-label">AMI VAULT</span>
          <small>{YEAR.label} · {HOUSE.name} House</small>
        </a>
        <nav className="nav">
          <a href="#/" className={`nav-home${route === 'home' ? ' on' : ''}`}>Timeline</a>
          <a href="#/community" className={route === 'community' ? 'on' : ''}>Leaders</a>
          <a href="#/top" className={route === 'top' ? 'on' : ''}>Most loved</a>
          {admin && <a href="#/admin" className={route === 'admin' ? 'on' : ''}>Admin{reportCount > 0 ? ` (${reportCount})` : ''}</a>}
          {profile
            ? <button className={`nav-me${route === 'me' ? ' on' : ''}`} onClick={onProfile} aria-label="My Vault" aria-current={route === 'me' ? 'page' : undefined}><Avatar owner={profile.owner} name={profile.display_name} /><span>My Vault</span></button>
            : <button className="nav-btn" onClick={onName}>Sign in</button>}
          <details className="mobile-nav" onKeyDown={e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary').focus();}}}>
            <summary aria-label="Open navigation menu"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></summary>
            <div className="mobile-nav-links" onClick={e=>{if(e.target.closest('a'))e.currentTarget.closest('details').open=false;}}>
              <a href="#/">Home</a>
              <a href="#/community">Leaders</a>
              <a href="#/top">Most loved</a>
              {admin&&<a href="#/admin">Admin{reportCount>0?` (${reportCount})`:''}</a>}
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
}

function MemoryStrip({ recent, covers, events }) {
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState([]);
  const randomOrder = useRef(new Map());
  const [stripWidth, setStripWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const resize = () => setStripWidth(window.innerWidth);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const photos = useMemo(() => {
    const visibleEvents = new Map(events.filter((e) => !e.hidden).map((e) => [e.id, e]));
    const pool = new Map([...recent, ...Array.from(covers.values()).flat()]
      .filter((p) => !p.hidden && !isVideo(p) && visibleEvents.has(p.eventId)).map((p) => [p.id, p]));
    const groups = new Map();
    for (const p of pool.values()) {
      if (!groups.has(p.eventId)) groups.set(p.eventId, []);
      groups.get(p.eventId).push(p);
    }
    const shuffle = list => list.sort((a, b) => {
      const key = x => Array.isArray(x) ? x[0]?.eventId : x.id;
      for (const x of [a, b]) if (!randomOrder.current.has(key(x))) randomOrder.current.set(key(x), Math.random());
      return randomOrder.current.get(key(a)) - randomOrder.current.get(key(b));
    });
    // Round-robin albums so a large recent upload cannot dominate the strip.
    const albums = shuffle([...groups.values()].map(shuffle));
    const chosen = [];
    while (chosen.length < 16 && albums.some((a) => a.length)) {
      for (const album of albums) { if (album.length && chosen.length < 16) chosen.push(album.pop()); }
    }
    return chosen.map((p) => ({ ...p, event: visibleEvents.get(p.eventId) }));
  }, [recent, covers, events]);
  // Decode first and reserve exact geometry, so loading cannot change the loop width.
  const sources = photos.map(p => `${p.id}:${mediaUrl(p, 'thumb')}`).join('|');
  useEffect(() => {
    let active = true;
    Promise.all(photos.map(async p => {
      const img = new Image();
      img.src = mediaUrl(p, 'thumb');
      try {
        await img.decode();
        return img.naturalWidth && img.naturalHeight ? { ...p, ratio: img.naturalWidth / img.naturalHeight } : null;
      } catch { return null; }
    })).then(items => { if (active) setReady(items.filter(Boolean)); });
    return () => { active = false; };
  }, [sources]);
  if (!ready.length) return null;
  const rowWidth = ready.reduce((n, p) => n + p.ratio * (stripWidth < 680 ? 106.6 : 140.4) + 3, 0);
  const repeats = Math.max(1, Math.ceil(stripWidth / rowWidth));
  const tiles = Array.from({ length: repeats }, () => ready).flat();

  return <section className="memory-strip" aria-label="Moments from our galleries">
    <div className="memory-window">
      <div key={ready.map(p => p.id).join('|')} className={`memory-track${paused ? ' is-paused' : ''}`}>
        {[0, 1].map((copy) => <div className="memory-group" key={copy} aria-hidden={copy === 1 ? true : undefined}>
          {tiles.map((p, i) => <a key={`${p.id}-${i}`} href={`#/e/${p.event.slug}/p/${p.id}`} style={{ aspectRatio: p.ratio }} tabIndex={copy === 1 ? -1 : 0} aria-label={`View photo from ${p.event.title}`}>
            <img src={mediaUrl(p, 'thumb')} width={Math.round(p.ratio * 200)} height={200} alt="" decoding="async" />
          </a>)}
        </div>)}
      </div>
    </div>
    <button className="memory-pause" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>{paused ? 'Play photos' : 'Pause photos'}</button>
  </section>;
}

/* ---------------------------------------------------------------- home */

function EventCard({ e, covers, today, admin, onInvite }) {
  const status = eventStatus(e, today);
  const kind = KINDS[e.kind] || KINDS.school;
  const thumbs = covers.get(e.id) || [];
  return (
    <div className={`ev-wrap${admin ? ' has-invite' : ''}`}>
    <a href={`#/e/${e.slug}`} className={`ev ${status}${e.featured ? ' featured' : ''}${e.kind === 'everyday' ? ' everyday' : ''}`}>
      <div className={`ev-cover n${Math.min(thumbs.length, 4)}`}>
        {thumbs.length ? thumbs.slice(0, 4).map((p) => <img key={p.id} src={mediaUrl(p, 'thumb')} alt="" loading="lazy" />)
          : <img className="ev-placeholder" src={`${SITE.base}brand/empty-gallery.png`} alt="" loading="lazy" />}
        {thumbs.some(isVideo) && <span className="video-badge">▶ Includes video</span>}
      </div>
      <div className="ev-body">
        <span className="ev-date">{e.ongoing ? 'All year' : fmtRange(e.startsOn, e.endsOn)}{e.kind !== 'everyday' && <i> · {kind.label}</i>}</span>
        <h3>{e.title}</h3>
        {e.kind === 'everyday' && <p className="fine">At home, at school, or out together. The little moments belong here, too.</p>}
        <p className="ev-stat">
          {e.photoCount
            ? <>{plural(e.photoCount, 'item')}<span> · {plural(e.contributorCount, 'family', 'families')}</span></>
            : status === 'upcoming' ? <span>Coming up</span> : status === 'today' ? <span>Happening now. Be first.</span> : <span>Be the first to add a photo.</span>}
        </p>
      </div>
    </a>
    {admin && (
      <button className="ev-invite" onClick={(ev) => { ev.preventDefault(); onInvite(e); }}>
        {I.share} Invite to upload
      </button>
    )}
    </div>
  );
}

function Home({ events, requests, recent, covers, totals, onAdd, today, admin, onInvite, onSuggest }) {
  useDocTitle('');
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const openAsks = requests.filter((r) => r.open && (!r.dueOn || r.dueOn >= today)).map((r) => ({ ...r, event: byId.get(r.eventId) })).filter((r) => r.event);
  // Only what has happened, plus anything running now. The rest is a fold:
  // a wall of empty cards for March made the vault look abandoned rather
  // than young.
  const dated = useMemo(() => events.filter((x) => !x.ongoing && x.kind !== 'everyday' && !x.hidden), [events]);
  const upcoming = useMemo(
    () => dated.filter((e) => eventStatus(e, today) === 'upcoming'),
    [dated, today],
  );
  const albums = dated.filter((e) => e.photoCount > 0 && e.startsOn <= today)
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  const emptyEvents = dated.filter((e) => !e.photoCount && (e.endsOn || e.startsOn) < today)
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn));
  const [soon, setSoon] = useState(false);
  // Feature the newest event that has started and still accepts photos.
  // Future events and closed albums must never become a dead-end upload CTA.
  const latestEvent = dated.filter((e) => e.open && e.startsOn <= today)
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0];
  const [choosing, setChoosing] = useState(false);
  const [eventSearch, setEventSearch] = useState('');
  const uploadEvents = events.filter((e) => e.open && !e.hidden && (e.ongoing || e.kind === 'everyday' || (e.endsOn || e.startsOn) < today))
    .sort((a, b) => {
      if (a.kind === 'everyday') return -1;
      if (b.kind === 'everyday') return 1;
      return b.startsOn.localeCompare(a.startsOn);
    })
    .filter((e) => e.title.toLowerCase().includes(eventSearch.toLowerCase()));

  return (
    <>
      <section className="home-intro">
        <div className="shell home-intro-row">
          <div>
            <p className="eyebrow">House of Friendship</p>
            <p className="home-tagline">Our year. All together.</p>
            {!latestEvent && <h1>Add a moment to our year.</h1>}
          </div>
          {!latestEvent && <div className="home-upload">
            <button className="btn primary big" disabled={!totals} onClick={() => setChoosing(true)}>{I.plus} Add photos / videos</button>
            <span>Choose an event to get started</span>
          </div>}
        </div>
      </section>
      {latestEvent && <section className="latest-event shell" aria-labelledby="latest-event-title">
        <div className="latest-event-card">
          <div>
            <p className="eyebrow">Latest event · {fmtRange(latestEvent.startsOn, latestEvent.endsOn)}</p>
            <h1 id="latest-event-title">{latestEvent.title}</h1>
            <p>Were you there? Share photos and videos.</p>
          </div>
          <div className="latest-event-actions">
            <button className="btn" onClick={() => onAdd(latestEvent)}>{I.plus} Add photos / videos</button>
            <a href={`#/e/${latestEvent.slug}`}>View album →</a>
          </div>
        </div>
        <button className="link latest-other" onClick={() => setChoosing(true)}>Photos from another event? Choose an album →</button>
      </section>}
      <section className="shell around-house"><h2>Around the House</h2><p>Some memories don’t need a date on the calendar.</p><div className="activity-tiles">{ACTIVITIES.map(c=>{
        const album=events.find(e=>e.category===c.id&&e.ongoing&&!e.hidden);
        if(!album)return null;
        const thumb=covers.get(album.id)?.[0];
        return <a key={c.id} className="activity-tile" href={`#/activity/${c.id}`}>{thumb?<img src={mediaUrl(thumb,'thumb')} alt=""/>:<span className="activity-symbol" aria-hidden="true">{c.icon}</span>}<div><h3>{c.title}</h3><p>{c.description}</p></div></a>;
      })}</div><button className="link suggest-link" onClick={onSuggest}>Missing an event? Suggest one →</button></section>
      {choosing && <Sheet title="Which event are these from?" onClose={() => setChoosing(false)}>
        <div className="stack">
          <button className="link" onClick={() => {setChoosing(false);onSuggest();}}>Missing an event? Suggest one →</button>
          <p className="lede">Pick an event, or choose Everyday Amistad for moments at home, at school, or out together.</p>
          <label className="field"><span>Find an event</span><input autoFocus type="search" value={eventSearch} onChange={(e) => setEventSearch(e.target.value)} placeholder="Search events" /></label>
          <div className="choice">
            {uploadEvents.map((e) => <button key={e.id} onClick={() => { setChoosing(false); setEventSearch(''); onAdd(e); }}>
              <b>{e.title}</b><span>{e.kind === 'everyday' ? 'At home, at school, or out together' : e.ongoing ? 'Ongoing activity · all year' : fmtRange(e.startsOn, e.endsOn)}</span>
            </button>)}
            {!uploadEvents.length && <p className="fine">No matching open events. Try another name.</p>}
          </div>
        </div>
      </Sheet>}

      <section className="year" id="the-year">
        <div className="shell">
          <div className="family-note">
            <h2>Every child. Every smile. Our family.</h2>
            <p>In the House of Friendship, we look out for one another and capture the joy along the way. When you take a photo, make room for the friends beside your child, too. A moment you share may be a memory another family treasures forever. This is our story, and we get to keep it together.</p>
          </div>
          <div className="album-heading">
            <div><h2>Our albums</h2><p>The latest memories, ready to explore.</p></div>
            {totals && <span>{plural(totals.photos, 'item')} shared</span>}
          </div>
          {!totals ? <p role="status">Loading albums…</p> : albums.length ? <div className="populated-albums">
            {albums.map((e) => <EventCard key={e.id} e={e} covers={covers} today={today} admin={admin} onInvite={onInvite} />)}
            {emptyEvents.slice(0, 2).map((e) => <div className="desktop-empty-album" key={e.id}><EventCard e={e} covers={covers} today={today} admin={admin} onInvite={onInvite} /></div>)}
          </div> : <p className="empty">Your photos will start our first album. Choose an event above to add a memory.</p>}
          {emptyEvents.length > 0 && <details className="missing-albums">
            <summary><span><b>Have photos from another event?</b><small>{plural(emptyEvents.length, 'event')} waiting for a first photo</small></span><span className="missing-toggle">Show events</span></summary>
            <div className="missing-list">{emptyEvents.map((e) => <div className="missing-row" key={e.id}>
              <a href={`#/e/${e.slug}`}><span>{fmtRange(e.startsOn, e.endsOn)}</span><b>{e.title}</b></a>
              {e.open ? <button className="btn small ghost" onClick={() => onAdd(e)}>Add photos / videos</button> : <span className="fine">Uploads closed</span>}
            </div>)}</div>
          </details>}
          {upcoming.length > 0 && (
            <button className="soon-card" onClick={() => setSoon(true)}>
              <span className="eyebrow">Coming soon</span>
              <b>{plural(upcoming.length, 'more event')} this year</b>
              <span className="soon-names">
                {upcoming.slice(0, 3).map((e) => e.title).join(', ')}
                {upcoming.length > 3 ? `, and ${upcoming.length - 3} more` : ''}
              </span>
              <i>See what is ahead</i>
            </button>
          )}
          {soon && (
            <ComingSoonSheet events={upcoming} admin={admin} onClose={() => setSoon(false)}
              onInvite={(e) => { setSoon(false); onInvite(e); }} />
          )}
        </div>
      </section>
    </>
  );
}

/* --------------------------------------------------------------- event */

function EventPage({ event, owner, profile, admin, pass, onAdd, onNeedName, onInvite, refreshEvents, initialPhotoId, today, showToast }) {
  useDocTitle(event?.title);
  const [photos, setPhotos] = useState(null);
  const [liked, setLiked] = useState(new Set());
  const [counts, setCounts] = useState(new Map());
  const [sort, setSort] = useState('time');
  const [open, setOpen] = useState(null);
  const [dl, setDl] = useState(false);

  const load = useCallback(async () => {
    if (!event) return;
    const ps = await listPhotos(event.id);
    setPhotos(ps);
    const ids = ps.map((p) => p.id);
    const [lk, cc] = await Promise.all([myLikes(ids), commentCounts(ids)]);
    setLiked(lk); setCounts(cc);
  }, [event]);

  useEffect(() => { load().catch((e) => showToast(e.message)); }, [load, showToast]);

  const sorted = useMemo(() => {
    if (!photos) return [];
    const list = photos.filter((p) => !p.hidden && !p.removedAt);
    if (sort === 'loved') return [...list].sort((a, b) => b.likes - a.likes || (a.createdAt < b.createdAt ? -1 : 1));
    if (sort === 'new') return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return list;
  }, [photos, sort, admin, owner]);

  // Deep link straight to a photo, once per link.
  const linked = useRef(null);
  useEffect(() => {
    if (!initialPhotoId || !photos || linked.current === initialPhotoId) return;
    const i = sorted.findIndex((p) => p.id === initialPhotoId);
    if (i >= 0) { linked.current = initialPhotoId; setOpen(i); }
  }, [initialPhotoId, photos, sorted]);

  const setIndex = (i) => { setOpen(i); window.history.replaceState(null, '', `#/e/${event.slug}/p/${sorted[i].id}`); };
  const close = () => { setOpen(null); window.history.replaceState(null, '', `#/e/${event.slug}`); };

  const toggleLike = async (p) => {
    const was = liked.has(p.id);
    try { was ? await unlike(p.id) : await like(p.id);
      setLiked((s) => { const n = new Set(s); was ? n.delete(p.id) : n.add(p.id); return n; });
      setPhotos((ps) => ps.map((x) => (x.id === p.id ? { ...x, likes: Math.max(0, x.likes + (was ? -1 : 1)) } : x)));
    }
    catch (e) { showToast(e.message); load(); }
  };

  if (!event) return <div className="shell page"><p className="empty">That event is not in the vault. <a href="#/">Back to the year.</a></p></div>;

  const status = eventStatus(event, today);
  const kind = KINDS[event.kind] || KINDS.school;
  const visible = sorted.filter((p) => !p.hidden);

  return (
    <div className="event">
      <div className="ev-head">
        <div className="shell">
          <a href="#/" className="crumb">← The year</a>
          <span className="ev-date big">{event.ongoing ? 'All year long' : fmtRange(event.startsOn, event.endsOn)} <i>· {kind.label}</i></span>
          <h1>{event.title}</h1><a className="event-leaders" href={`#/community/${event.id}`}>Meet this event’s memory makers →</a>
          {(event.kind === 'everyday' || event.blurb) && <p className="ev-blurb">{event.kind === 'everyday' ? 'At home, at school, or out together. The little moments belong here, too. Share photos and videos from life beyond scheduled events.' : event.blurb}</p>}
          <p className="ev-counts">
            {photos ? <>{plural(visible.length, 'photo')} · {plural(new Set(visible.map((p) => p.owner)).size, 'family', 'families')} · {plural(visible.reduce((n, p) => n + p.likes, 0), 'love')}</> : 'Loading…'}
          </p>
          <div className="ev-actions">
            <div className="ev-share-actions">
            {event.open
              ? <button className="btn primary" onClick={() => onAdd(event)} aria-label="Add photos or videos">{I.plus}<span>Add photos<span className="ev-video-label"> / videos</span></span></button>
              : <span className="closed">Closed to new photos</span>}
            <button className="ev-invite" onClick={() => onInvite(event)} aria-label="Invite to upload">{I.share}<span>Invite</span></button>
            </div>
            {/* Admins only. A whole event as one zip is both the most expensive
                thing the vault can do and the easiest way for a forwarded link
                to become a bulk copy of other people's children. One photo at a
                time stays open to everyone, in the lightbox. */}
            {admin && visible.length > 0 && (
              <button className="btn ghost" onClick={() => setDl(true)}>{I.down} Download all</button>
            )}
            {visible.length > 1 && (
              <div className="sort">
                {[['time', 'In order'], ['loved', 'Most loved'], ['new', 'Newest']].map(([k, l]) => (
                  <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{l}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="shell">
        {photos === null ? <p className="empty">Loading…</p> : (
          <PhotoGrid
            photos={sorted} onOpen={setIndex} likedSet={liked} counts={counts}
            emptyText={status === 'upcoming' ? `Not yet. ${event.title} is ${fmtDate(event.startsOn, { weekday: 'long' })}.` : 'No photos yet. Somebody has to be first.'}
          />
        )}
      </div>
      {event.open && photos && photos.length > 0 && (
        <div className="fab-wrap"><button className="fab" onClick={() => onAdd(event)}>{I.plus} Add photos / videos</button></div>
      )}
      {open !== null && sorted[open] && (
        <Lightbox
          photos={sorted} index={open} onIndex={setIndex} onClose={close} event={event}
          owner={owner} profile={profile} admin={admin} pass={pass}
          liked={liked.has(sorted[open].id)} onLike={toggleLike}
          onNeedName={onNeedName}
          onHidden={(p, hidden) => { setPhotos((ps) => ps.map((x) => (x.id === p.id ? { ...x, hidden } : x))); refreshEvents(); }}
        />
      )}
      {dl && admin && <DownloadSheet event={event} photos={visible} onClose={() => setDl(false)} />}
    </div>
  );
}

/* ----------------------------------------------------------------- top */

function TopPage({ events, owner, profile, onNeedName, showToast }) {
  useDocTitle('Most loved');
  const [photos, setPhotos] = useState(null);
  const [liked, setLiked] = useState(new Set());
  const [open, setOpen] = useState(null);
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  useEffect(() => {
    listTopPhotos(90).then(async (ps) => { setPhotos(ps); setLiked(await myLikes(ps.map((p) => p.id))); }).catch((e) => showToast(e.message));
  }, [showToast]);
  const toggleLike = async (p) => {
    const was = liked.has(p.id);
    try { was ? await unlike(p.id) : await like(p.id);
      setLiked((s) => { const n = new Set(s); was ? n.delete(p.id) : n.add(p.id); return n; });
      setPhotos((ps) => ps.map((x) => (x.id === p.id ? { ...x, likes: Math.max(0, x.likes + (was ? -1 : 1)) } : x)));
    } catch (e) { showToast(e.message); }
  };
  return (
    <div className="shell page">
      <div className="sec-head">
        <span className="eyebrow">Most loved</span>
        <h1 className="page-title">The most loved photos of the year.</h1>
        <p>Ranked by the house, live. Tap the heart on anything and it moves.</p>
      </div>
      {photos === null ? <p className="empty">Loading…</p>
        : <PhotoGrid photos={photos} onOpen={setOpen} likedSet={liked} rank emptyText="No hearts yet. Go love something." />}
      {photos?.some((p) => p.cleanupPending) && <div className="stack"><p>These uploads are hidden, but file cleanup needs another try.</p>{photos.filter((p) => p.cleanupPending).map((p) => <button className="btn small ghost" key={p.id} onClick={async () => { try { await removeUpload(p.id); setPhotos((ps) => ps.filter((x) => x.id !== p.id)); } catch (e) { showToast(e.message); } }}>Finish removing upload</button>)}</div>}
      {open !== null && photos?.[open] && (
        <Lightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)}
          event={byId.get(photos[open].eventId) || { slug: '', title: '' }} owner={owner} profile={profile} admin={false} pass=""
          liked={liked.has(photos[open].id)} onLike={toggleLike} onNeedName={onNeedName} onHidden={(p) => { setPhotos((ps) => ps.filter((x) => x.id !== p.id)); setOpen(null); }} />
      )}
    </div>
  );
}

function ContributorPage({ contributor, events, owner, profile, onNeedName, showToast }) {
  const [gallery, setGallery] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [eventFilter, setEventFilter] = useState('');
  const requestVersion = useRef(0);
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(null);
  const [liked, setLiked] = useState(new Set());
  useDocTitle(gallery ? `${gallery.name}’s memories` : 'Shared memories');
  const load = useCallback(async (start) => {
    const version = ++requestVersion.current;
    setBusy(true); setError('');
    try {
      const result = await listContributorPhotos(contributor, start, eventFilter || null);
      const hearts = await myLikes(result.photos.map(p => p.id));
      if (version !== requestVersion.current) return;
      setGallery(result); setPhotos(ps => start ? [...ps, ...result.photos] : result.photos);
      setLiked(prev => new Set([...prev, ...hearts])); setOffset(start + result.ids.length);
    } catch (e) { if (version === requestVersion.current) setError(e.message); }
    finally { if (version === requestVersion.current) setBusy(false); }
  }, [contributor, eventFilter]);
  useEffect(() => { setPhotos([]); setOffset(0); setOpen(null); load(0); return () => { requestVersion.current++; }; }, [load]);
  const toggleLike = async p => {
    const was = liked.has(p.id);
    try {
      was ? await unlike(p.id) : await like(p.id);
      setLiked(prev => { const n = new Set(prev); was ? n.delete(p.id) : n.add(p.id); return n; });
      setPhotos(ps => ps.map(x => x.id === p.id ? { ...x, likes: Math.max(0, x.likes + (was ? -1 : 1)) } : x));
    } catch (e) { showToast(e.message); }
  };
  return <main className="shell page contributor-gallery">
    <a href="#/community" className="crumb">← Memory makers</a>
    {gallery && <div className="contributor-heading"><Avatar owner={gallery.owner} name={gallery.name} large /><div><h1>{gallery.name}’s memories</h1><p>Photos and videos shared across our year.</p></div></div>}
    {gallery && <label className="field contributor-filter"><span>Filter by event</span><select value={eventFilter} onChange={e => setEventFilter(e.target.value)}><option value="">All events</option>{events.filter(e => gallery.events?.includes(e.id)).sort((a,b) => b.startsOn.localeCompare(a.startsOn)).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>}
    {error && <p className="err">{error} <button className="btn small" onClick={() => load(offset)}>Try again</button></p>}
    {!photos.length && busy ? <p className="empty">Gathering the memories…</p> : gallery && <PhotoGrid photos={photos} onOpen={setOpen} likedSet={liked} emptyText="No shared photos or videos yet." />}
    {gallery && photos.length > 0 && offset < gallery.total && <button className="btn ghost" disabled={busy} onClick={() => load(offset)}>{busy ? 'Loading…' : 'Load more memories'}</button>}
    {open !== null && photos[open] && <Lightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} owner={owner} profile={profile} admin={false} pass=""
      event={events.find(e => e.id === photos[open].eventId) || { slug: '', title: 'Shared memories' }}
      liked={liked.has(photos[open].id)} onLike={toggleLike} onNeedName={onNeedName}
      onHidden={p => { setPhotos(ps => ps.filter(x => x.id !== p.id)); setOffset(n => Math.max(0,n-1)); setGallery(g => ({...g,total:g.total-1})); setOpen(null); }} />}
  </main>;
}

function ActivityPage({category,events,covers,onAdd,onSuggest,today}) {
  const c=ACTIVITIES.find(c=>c.id===category);
  useDocTitle(c?.title||'Around the House');
  if(!c||!events.some(e=>e.category===category&&e.ongoing&&!e.hidden))return <main className="shell page"><h1>This gallery isn’t available right now</h1><a href="#/">Back to the Vault</a></main>;
  const albums=events.filter(e=>e.category===category&&!e.hidden&&(e.ongoing||e.startsOn<=today)).sort((a,b)=>Number(b.ongoing)-Number(a.ongoing)||b.startsOn.localeCompare(a.startsOn));
  const main=albums.find(e=>e.ongoing&&e.open);
  return <main className="shell page"><a href="#/" className="crumb">← Around the House</a><h1>{c.title}</h1><p>{c.description}</p><div className="row">{main&&<button className="btn primary" onClick={()=>onAdd(main)}>{I.plus} Add photos / videos</button>}<button className="link" onClick={onSuggest}>Suggest an event →</button></div><div className="populated-albums activity-albums">{albums.map(e=><EventCard key={e.id} e={e} covers={covers} today={today} admin={false}/>)}</div></main>;
}

/* ------------------------------------------------------------------ me */

function DashboardShare({ events, onAdd, hasUploads, onSuggest }) {
  const [choosing, setChoosing] = useState(false);
  const [search, setSearch] = useState('');
  const today = todayISO();
  const available = events.filter(e => e.open && !e.hidden && (e.ongoing || e.kind === 'everyday' || e.startsOn <= today))
    .sort((a, b) => (b.kind === 'everyday') - (a.kind === 'everyday') || b.startsOn.localeCompare(a.startsOn));
  const latest = available.find(e => !e.ongoing && e.kind !== 'everyday');
  const choices = available.filter(e => e.title.toLowerCase().includes(search.toLowerCase()));
  return <>
    <section className="dashboard-share" aria-labelledby="dashboard-share-title">
      <span className="eyebrow">{hasUploads ? 'There’s more to our story' : 'You’re part of the story'}</span>
      <h2 id="dashboard-share-title">{hasUploads ? 'Keep the memories coming.' : 'Let’s share your first memory.'}</h2>
      <p>A smile you captured could make another family’s day. Share your favorite photos and videos with our Amistad family.</p>
      {latest && <p className="dashboard-latest"><span>Latest event · {fmtRange(latest.startsOn, latest.endsOn)}</span><b>{latest.title}</b></p>}
      <div className="dashboard-share-actions">
        {available.length > 0 ? <button className="btn primary" onClick={() => latest ? onAdd(latest) : setChoosing(true)}>{I.plus} {hasUploads ? 'Share more memories' : 'Start sharing'}</button> : <a className="btn primary" href="#/">Explore our galleries</a>}
        {latest && <button className="link" onClick={() => setChoosing(true)}>Choose another gallery →</button>}
      </div>
      <a className="dashboard-home" href="#/">Explore all galleries →</a>
    </section>
    {choosing && <Sheet title="Where did you make these memories?" onClose={() => setChoosing(false)}>
      <button className="link" onClick={() => {setChoosing(false);onSuggest();}}>Missing an event? Suggest one →</button>
      <div className="stack"><label className="field"><span>Find your gallery</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search events" /></label>
        <div className="choice">{choices.map(e => <button key={e.id} onClick={() => { setChoosing(false); setSearch(''); onAdd(e); }}><b>{e.title}</b><span>{e.kind === 'everyday' ? 'Everyday moments outside scheduled events' : e.ongoing ? 'Ongoing activity · all year' : fmtRange(e.startsOn, e.endsOn)}</span></button>)}{!choices.length && <p>No matching galleries. Try another event name.</p>}</div>
      </div>
    </Sheet>}
  </>;
}

function MePage({ owner, rewardVersion, profile, events, onSuggest, onAdd, onProfile, onSignIn, onSignOut, showToast }) {
  useDocTitle('Me');
  const [activityTab, setActivityTab] = useState('photos');
  const [photos, setPhotos] = useState(null);
  const [open, setOpen] = useState(null);
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  useEffect(() => { if (owner) listMyPhotos().then((ps) => setPhotos(ps.filter((p) => !p.removedAt || p.cleanupPending))).catch((e) => showToast(e.message)); }, [showToast, owner]);
  if (!owner) return <div className="shell page stack"><h1>My Vault</h1><p>Sign in with a texted code to find and manage your memories.</p><button className="btn primary" onClick={onSignIn}>Text me a sign-in code</button></div>;
  return (
    <div className="shell page">
      <div className="me-head">
        <Avatar owner={owner} name={profile?.display_name} large />
        <div>
          <h1 className="page-title">{profile?.display_name || 'You'}</h1>
          <p>{profile?.student ? profile.student : 'Your memories, wherever you sign in.'}</p>
          <div className="row">
            <button className="btn small ghost" onClick={onProfile}>{profile ? 'Edit profile' : 'Add your name'}</button><button className="btn small ghost" onClick={onSignOut}>Sign out</button>
          </div>
        </div>
      </div>
      <DashboardShare onSuggest={onSuggest} events={events} onAdd={onAdd} hasUploads={photos?.some(p => !p.removedAt)} />
      <DashboardStats owner={owner} refresh={photos} />
      <BadgeShelf owner={owner} refresh={rewardVersion} />
      <div className="community-tabs personal-tabs" aria-label="Your activity">{[['photos','My photos & videos'],['likes','My likes'],['comments','My comments']].map(([key,label])=><button key={key} aria-pressed={activityTab===key} className={activityTab===key?'selected':''} onClick={()=>setActivityTab(key)}>{label}</button>)}</div>
      {activityTab !== 'photos' && <MyActivity key={activityTab} kind={activityTab} owner={owner} />}
      {activityTab === 'photos' && <><div className="sec-head"><span className="eyebrow">Your photos</span><p>{photos ? plural(photos.filter((p) => !p.removedAt).length, 'upload') : ''}</p></div>
      {photos === null ? <p className="empty">Loading…</p>
        : <PhotoGrid photos={photos.filter((p) => !p.removedAt)} onOpen={(i) => setOpen(photos.findIndex((p) => p.id === photos.filter((x) => !x.removedAt)[i].id))} emptyText="Your shared memories will appear here." />}</>}
      {photos?.some((p) => p.cleanupPending) && <div className="stack"><p>These uploads are hidden, but file cleanup needs another try.</p>{photos.filter((p) => p.cleanupPending).map((p) => <button className="btn small ghost" key={p.id} onClick={async () => { try { await removeUpload(p.id); setPhotos((ps) => ps.filter((x) => x.id !== p.id)); } catch (e) { showToast(e.message); } }}>Finish removing upload</button>)}</div>}
      {open !== null && photos?.[open] && (
        <Lightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)}
          event={byId.get(photos[open].eventId) || { slug: '', title: '' }} owner={owner} profile={profile} admin={false} pass=""
          liked={false} onLike={() => {}} onNeedName={() => {}}
          onHidden={(p) => { setPhotos((ps) => ps.filter((x) => x.id !== p.id)); setOpen(null); }} />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- admin */

const EMPTY_EVENT = { title: '', slug: '', blurb: '', kind: 'house', startsOn: '', endsOn: '', open: true, featured: false, hidden: false };

function AdminPage({ admin, staffRole, onSignIn, pass, onPass, events, requests, refresh, showToast, storage, onInvite }) {
  useDocTitle('Admin');
  const [editing, setEditing] = useState(null);       // event form
  const [ask, setAsk] = useState(null);               // request form
  const [phones, setPhones] = useState(null);
  const [nudge, setNudge] = useState('');
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const [tryPass, setTryPass] = useState('');
  const [passErr, setPassErr] = useState('');
  if (!admin) {
    return (
      <div className="shell page">
        <form className="stack narrow-form" onSubmit={async (e) => {
          e.preventDefault();
          if (await checkPass(tryPass.trim())) { onPass(tryPass.trim()); setPassErr(''); }
          else setPassErr('That is not it.');
        }}>
          <span className="eyebrow">Back office</span>
<h1 className="page-title">Admin access</h1><button type="button" className="btn primary" onClick={onSignIn}>Sign in as an admin</button><p className="fine">Use your verified phone. The legacy passcode remains available below.</p>
          <label className="field"><span>Admin passcode</span><input type="password" autoFocus value={tryPass} onChange={(e) => setTryPass(e.target.value)} /></label>
          {passErr && <p className="err">{passErr}</p>}
          <button className="btn primary">Open</button>
        </form>
      </div>
    );
  }

  if (staffRole === 'moderator') return <main className="shell page admin"><h1>Moderation</h1><p>Review concerns raised by our family. Uploads appear immediately; reports are reviewed here.</p><ModerationPanel pass={pass} onChanged={refresh} /></main>;
  const saveEv = async (e) => {
    e.preventDefault();
    try { await saveEvent(editing.form, editing.id, pass); setEditing(null); refresh(); showToast('Saved.'); }
    catch (ex) { showToast(ex.message); }
  };
  const saveAsk = async (e) => {
    e.preventDefault();
    try { await saveRequest(ask.form, ask.id, pass); setAsk(null); refresh(); showToast('Saved.'); }
    catch (ex) { showToast(ex.message); }
  };
  const makeNudge = (r) => {
    const ev = byId.get(r.eventId);
    const link = `${SITE.origin}${SITE.base}#/e/${ev.slug}`;
    const due = r.dueOn ? ` by ${fmtDate(r.dueOn, { weekday: 'long' })}` : '';
    setNudge(`Amistad fam: ${ev.title} photos wanted${due}. ${r.message ? `${r.message} ` : ''}Check your camera roll for the smiles, laughs, and moments worth keeping. Add yours and let’s relive the fun: ${link}`);
  };
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); showToast('Copied.'); } catch { prompt('Copy', t); } };

  return (
    <div className="shell page admin">
      <div className="sec-head">
        <span className="eyebrow">Back office</span>
        <h1 className="page-title">Run the vault.</h1>
        <p>Storage: <b>{storage?.mode === 'r2' ? 'Cloudflare R2' : 'Supabase Storage (on-ramp)'}</b>. Events, asks, and the nudge text live here. {staffRole ? <span>You are signed in as {staffRole}. Sign out from My Vault to lock account access.</span> : <button className="link" onClick={() => onPass('')}>Lock</button>}</p>
      </div>

      {staffRole === 'owner' && <StaffPanel />}
      <GalleryVisibility pass={pass} onChanged={refresh} />
      <SuggestionReview events={events} pass={pass} onChanged={refresh} />
      <ModerationPanel pass={pass} onChanged={refresh} />
      <div className="adm-sec">
        <div className="adm-head"><h2>Photos wanted</h2><button className="btn small primary" onClick={() => setAsk({ id: null, form: { eventId: events[0]?.id, message: '', goal: 40, dueOn: '', open: true } })}>New ask</button></div>
        <table className="tbl">
          <thead><tr><th>Event</th><th>Message</th><th>Progress</th><th>Due</th><th></th></tr></thead>
          <tbody>
            {requests.map((r) => {
              const ev = byId.get(r.eventId);
              return (
                <tr key={r.id} className={r.open ? '' : 'off'}>
                  <td>{ev?.title}</td>
                  <td className="wrap">{r.message}</td>
                  <td>{ev?.photoCount} / {r.goal}</td>
                  <td>{r.dueOn ? fmtDate(r.dueOn) : '—'}</td>
                  <td className="acts">
                    <button className="link" onClick={() => makeNudge(r)}>nudge text</button>
                    <button className="link" onClick={() => setAsk({ id: r.id, form: { eventId: r.eventId, message: r.message, goal: r.goal, dueOn: r.dueOn || '', open: r.open } })}>edit</button>
                    <button className="link" onClick={async () => { try { await saveRequest({ eventId: r.eventId, message: r.message, goal: r.goal, dueOn: r.dueOn, open: !r.open }, r.id, pass); refresh(); } catch (ex) { showToast(ex.message); } }}>{r.open ? 'close' : 'reopen'}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {nudge && (
          <div className="nudge">
            <textarea value={nudge} onChange={(e) => setNudge(e.target.value)} rows={4} />
            <div className="row">
              <button className="btn small primary" onClick={() => copy(nudge)}>Copy for Quo</button>
              <button className="btn small ghost" onClick={() => listPhonesForAdmin(pass).then(setPhones).catch((ex) => showToast(ex.message))}>Show numbers</button>
              <span className="fine">{nudge.length} chars</span>
            </div>
            {phones && (
              <div className="phones">
                <p className="fine">{plural(phones.length, 'number')} on file. Paste into a Quo group text.</p>
                <textarea readOnly rows={3} value={phones.map((p) => p.phone).join(', ')} />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="adm-sec">
        <div className="adm-head"><h2>Events</h2><button className="btn small primary" onClick={() => setEditing({ id: null, form: { ...EMPTY_EVENT, startsOn: todayISO() } })}>New event</button></div>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Title</th><th>Kind</th><th>Photos</th><th>Flags</th><th></th></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className={e.hidden ? 'off' : ''}>
                <td>{fmtRange(e.startsOn, e.endsOn)}</td>
                <td><a href={`#/e/${e.slug}`}>{e.title}</a></td>
                <td>{KINDS[e.kind]?.label}</td>
                <td>{e.photoCount}</td>
                <td>{[!e.open && 'closed', e.featured && 'featured', e.hidden && 'hidden'].filter(Boolean).join(' · ') || '—'}</td>
                <td className="acts">
                  <button className="link" onClick={() => setEditing({ id: e.id, form: { title: e.title, slug: e.slug, blurb: e.blurb, kind: e.kind, category: e.category, ongoing: e.ongoing, startsOn: e.startsOn, endsOn: e.endsOn || '', open: e.open, featured: e.featured, hidden: e.hidden } })}>edit</button>
                  <button className="link" onClick={() => onInvite(e)}>invite</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <Sheet title={editing.id ? 'Edit event' : 'New event'} onClose={() => setEditing(null)}>
          <form className="stack" onSubmit={saveEv}>
            <label className="field"><span>Title</span><input required value={editing.form.title} onChange={(e) => setEditing((x) => ({ ...x, form: { ...x.form, title: e.target.value, slug: x.id ? x.form.slug : e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') } }))} /></label>
            <label className="field"><span>Activity category</span><select value={editing.form.category||''} onChange={e=>setEditing(x=>({...x,form:{...x.form,category:e.target.value}}))}><option value="">Event albums</option>{ACTIVITIES.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
            <label className="row"><input type="checkbox" checked={!!editing.form.ongoing} onChange={e=>setEditing(x=>({...x,form:{...x.form,ongoing:e.target.checked}}))}/>Ongoing activity</label>
            <label className="field"><span>Slug (in the link)</span><input required value={editing.form.slug} onChange={(e) => setEditing((x) => ({ ...x, form: { ...x.form, slug: e.target.value } }))} /></label>
            <label className="field"><span>Blurb</span><textarea rows={2} maxLength={400} value={editing.form.blurb} onChange={(e) => setEditing((x) => ({ ...x, form: { ...x.form, blurb: e.target.value } }))} /></label>
            <div className="row">
              <label className="field"><span>Starts</span><input type="date" required value={editing.form.startsOn} onChange={(e) => setEditing((x) => ({ ...x, form: { ...x.form, startsOn: e.target.value } }))} /></label>
              <label className="field"><span>Ends</span><input type="date" value={editing.form.endsOn} onChange={(e) => setEditing((x) => ({ ...x, form: { ...x.form, endsOn: e.target.value } }))} /></label>
              <label className="field"><span>Kind</span>
                <select value={editing.form.kind} onChange={(e) => setEditing((x) => ({ ...x, form: { ...x.form, kind: e.target.value } }))}>
                  {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
            </div>
            <div className="row checks">
              {[['open', 'Accepting photos'], ['featured', 'Featured'], ['hidden', 'Hidden']].map(([k, l]) => (
                <label key={k}><input type="checkbox" checked={!!editing.form[k]} onChange={(e) => setEditing((x) => ({ ...x, form: { ...x.form, [k]: e.target.checked } }))} /> {l}</label>
              ))}
            </div>
            <button className="btn primary">Save</button>
          </form>
        </Sheet>
      )}
      {ask && (
        <Sheet title={ask.id ? 'Edit ask' : 'New ask'} onClose={() => setAsk(null)}>
          <form className="stack" onSubmit={saveAsk}>
            <label className="field"><span>Event</span>
              <select value={ask.form.eventId} onChange={(e) => setAsk((x) => ({ ...x, form: { ...x.form, eventId: e.target.value } }))}>
                {events.map((e) => <option key={e.id} value={e.id}>{fmtDate(e.startsOn)} · {e.title}</option>)}
              </select>
            </label>
            <label className="field"><span>Message</span><textarea rows={2} maxLength={280} value={ask.form.message} onChange={(e) => setAsk((x) => ({ ...x, form: { ...x.form, message: e.target.value } }))} placeholder="Everyone took one at the front door. Drop yours in." /></label>
            <div className="row">
              <label className="field"><span>Goal</span><input type="number" min={1} value={ask.form.goal} onChange={(e) => setAsk((x) => ({ ...x, form: { ...x.form, goal: e.target.value } }))} /></label>
              <label className="field"><span>Due</span><input type="date" value={ask.form.dueOn} onChange={(e) => setAsk((x) => ({ ...x, form: { ...x.form, dueOn: e.target.value } }))} /></label>
            </div>
            <label className="row checks"><input type="checkbox" checked={!!ask.form.open} onChange={(e) => setAsk((x) => ({ ...x, form: { ...x.form, open: e.target.checked } }))} /> Open</label>
            <button className="btn primary">Save</button>
          </form>
        </Sheet>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- app */

export default function App() {
  const hash = useHash();
  const route = useMemo(() => parseRoute(hash), [hash]);
  const today = todayISO();

  const [owner, setOwner] = useState(null);
  const [avatars, setAvatars] = useState({ keys:{}, version:Date.now() });
  const [earned, setEarned] = useState([]);
  const [rewardVersion, setRewardVersion] = useState(0);
  const refreshAvatars = useCallback(() => Promise.all([rewardCall('vault_avatars'),rewardCall('vault_public_badges')]).then(([keys,badges])=>setAvatars({keys,badges,version:Date.now()})).catch(()=>{}), []);
  useEffect(() => { refreshAvatars(); }, [refreshAvatars]);
  const claimBadges = useCallback(() => rewardCall('vault_claim_badges').then(async b=>{if(b.length) {setEarned(b);setRewardVersion(v=>v+1);refreshAvatars();} const headers=await authHeaders(); await fetch('/api/vault-badge-text',{method:'POST',headers,keepalive:true});}).catch(()=>{}), [refreshAvatars]);
  useEffect(() => { if(owner) claimBadges(); }, [owner,claimBadges]);
  const [profile, setProfile] = useState(null);
  const [phoneAsk, setPhoneAsk] = useState(null);
  const [reporting, setReporting] = useState(null);
  const [pass, setPassState] = useState(() => localPass());
  const [admin, setAdmin] = useState(false);
  const [staffRole, setStaffRole] = useState(null);
  const [reportCount, setReportCount] = useState(0);
  const [events, setEvents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [recent, setRecent] = useState([]);
  const [storage, setStorage] = useState(null);
  const [nameAsk, setNameAsk] = useState(null);     // { reason, then } | null
  const [profileOpen, setProfileOpen] = useState(false);
  const [upload, setUpload] = useState(null);       // event | null
  const [suggesting, setSuggesting] = useState(false);
  const [invite, setInvite] = useState(null);      // event | null
  const [toast, showToast] = useToast();

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const o = await syncIdentity(); if (!live) return; setOwner(o);
        const p = o ? await fetchProfile() : null;
        if (live) setProfile(p ? { ...p, release_opt_in: !!p.release_opt_in } : null);
      } catch (e) { if (live) { setOwner(null); setProfile(null); } }
    };
    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { setTimeout(load, 0); });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);

  // Re-check named staff on sign-in and periodically so revocations update the UI.
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const [role, passOK] = await Promise.all([rewardCall('vault_staff_role'), pass ? checkPass(pass) : Promise.resolve(false)]);
        if (active) { setStaffRole(role); setAdmin(!!role || passOK); }
      } catch { if (active) { setStaffRole(null); setAdmin(false); } }
    };
    check(); const timer = setInterval(check, 60000);
    return () => { active = false; clearInterval(timer); };
  }, [pass, owner]);
  const setPass = (p) => { rememberPass(p); setPassState(p); };
  useEffect(() => {
    if (!admin) { setReportCount(0); return; }
    let active = true;
    const check = () => reviewReports(pass).then((r) => { if (active) setReportCount(r.length); }).catch(() => {});
    check(); const timer = setInterval(check, 60000);
    return () => { active = false; clearInterval(timer); };
  }, [admin, pass]);

  const refresh = useCallback(async () => {
    try {
      const [ev, rq, rc, tt] = await Promise.all([listEvents(), listRequests(), listRecentPhotos(24), fetchTotals()]);
      setEvents(ev); setRequests(rq); setRecent(rc); setTotals(tt);
    } catch (e) { showToast(e.message || 'Could not load the vault.'); }
  }, [showToast]);

  useEffect(() => { storageConfig().then((c) => { setStorage(c); refresh(); }); }, [refresh]);

  // Covers: the four most recent thumbs per event, from the recent strip plus
  // one light query for events the strip does not reach.
  const covers = useMemo(() => {
    const m = new Map();
    for (const p of recent) {
      if (!m.has(p.eventId)) m.set(p.eventId, []);
      if (m.get(p.eventId).length < 4) m.get(p.eventId).push(p);
    }
    return m;
  }, [recent]);
  const [extraCovers, setExtraCovers] = useState(new Map());
  useEffect(() => {
    const need = events.filter((e) => e.photoCount > 0 && !covers.has(e.id));
    if (!need.length) return;
    Promise.all(need.map((e) => listPhotos(e.id).then((ps) => [e.id, ps.filter((p) => !p.hidden).slice(-4).reverse()]).catch(() => [e.id, []])))
      .then((pairs) => setExtraCovers(new Map(pairs)));
  }, [events, covers]);
  const allCovers = useMemo(() => new Map([...extraCovers, ...covers]), [covers, extraCovers]);

  const [totals, setTotals] = useState(null);

  const needName = useCallback((reason, then) => {
    if (!owner) setPhoneAsk({ reason, then });
    else setNameAsk({ reason, then });
  }, [owner]);
  const askReport = (photo) => {
    if (!owner) setPhoneAsk({ reason: 'Verify your number to report a concern.', then: () => setReporting(photo) });
    else setReporting(photo);
  };
  const currentEvent = route.name === 'event' ? events.find((e) => e.slug === route.slug) : null;

  const onAdd = async (ev) => {
    if (!ev) return;
    if (route.name !== 'event' || route.slug !== ev.slug) go(`/e/${ev.slug}`);
    if (!owner || !profile) { needName(`Add your name so your ${ev.title} uploads have it.`, () => setUpload(ev)); return; }
    try { await requireContributor(); setUpload(ev); } catch (e) { showToast(e.message); }
  };

  return (
    <AvatarContext.Provider value={avatars}><ReportContext.Provider value={askReport}><div className="vault">
      <TopBar reportCount={reportCount} profile={profile} admin={admin} route={route.name}
        onName={() => setPhoneAsk({ then: () => go('/me') })}
        onProfile={() => go('/me')} />

      {route.name === 'home' && <MemoryStrip recent={recent} covers={allCovers} events={events} />}

      {route.name === 'home' && (
        <Home onSuggest={() => setSuggesting(true)} events={events} requests={requests} recent={recent} covers={allCovers} totals={totals}
          onAdd={onAdd} today={today} admin={admin} onInvite={setInvite} />
      )}
      {route.name === 'event' && (events.length ? (
        <EventPage key={route.slug} event={currentEvent} owner={owner} profile={profile} admin={admin && staffRole !== 'moderator'} pass={pass} onAdd={onAdd}
          onNeedName={needName} onInvite={setInvite} refreshEvents={refresh} initialPhotoId={route.photoId} today={today} showToast={showToast} />
      ) : <div className="shell page"><p className="empty">Loading…</p></div>)}
      {route.name === 'activity' && <ActivityPage category={route.category} events={events} covers={allCovers} today={today} onAdd={onAdd} onSuggest={() => setSuggesting(true)} />}
      {route.name === 'community' && <CommunityPage rewardVersion={rewardVersion} key={route.eventId} events={events} eventId={route.eventId} owner={owner} />}
      {route.name === 'person' && <ContributorPage key={route.owner} contributor={route.owner} events={events} owner={owner} profile={profile} onNeedName={needName} showToast={showToast} />}
      {route.name === 'top' && <TopPage events={events} owner={owner} profile={profile} onNeedName={needName} showToast={showToast} />}
      {route.name === 'me' && <MePage onSuggest={() => setSuggesting(true)} onAdd={onAdd} rewardVersion={rewardVersion} onSignIn={() => setPhoneAsk({})} onSignOut={async () => { await signOut(); setOwner(null); setProfile(null); }} owner={owner} profile={profile} events={events} onProfile={() => setProfileOpen(true)} showToast={showToast} />}
      {route.name === 'admin' && <AdminPage admin={admin} staffRole={staffRole} onSignIn={() => setPhoneAsk({})} pass={pass} onPass={setPass} events={events} requests={requests} refresh={refresh} showToast={showToast} storage={storage} onInvite={setInvite} />}

      {suggesting && <Sheet title="Suggest an event" onClose={() => setSuggesting(false)}><SuggestionForm profile={profile} onSignIn={() => needName('Sign in to suggest an event.')} onDone={() => setSuggesting(false)} /></Sheet>}
      <footer className="foot">
        <div className="shell">
          <p className="foot-mark"><span>AMI</span> VAULT · {YEAR.label}</p>
          <p>{HOUSE.name} means {HOUSE.meaning.toLowerCase()}. The vault is what it looks like.</p>
          <p className="fine">Photos belong to the families who took them and are shared here for the house. Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. {admin ? ADMIN_HINT : ''}</p>
        </div>
      </footer>

      {phoneAsk && <PhoneSheet reason={phoneAsk.reason} onClose={() => setPhoneAsk(null)} onVerified={async () => {
        const o = await syncIdentity(); setOwner(o);
        const p = await fetchProfile();
        const next = phoneAsk; setPhoneAsk(null);
        if (p) { setProfile({ ...p, release_opt_in: !!p.release_opt_in }); next.then?.(); }
        else setNameAsk({ reason: next.reason, then: next.then });
      }} />}
      {reporting && <ReportSheet photo={reporting} onClose={() => setReporting(null)} />}
      {(nameAsk || profileOpen) && (
        <ProfileSheet profile={profile} firstTime={!profile} reason={nameAsk?.reason}
          onSaved={(p) => { refreshAvatars(); setProfile({ ...p, release_opt_in: !!p.release_opt_in }); const then = nameAsk?.then; setNameAsk(null); setProfileOpen(false); if (then) then(); }}
          onClose={() => { setNameAsk(null); setProfileOpen(false); }} />
      )}
      {upload && profile && !nameAsk && (
        <UploadSheet event={upload} profile={profile}
          onClose={() => setUpload(null)}
          onDone={() => { refresh(); claimBadges(); showToast('Added to the vault.'); }} />
      )}
      {invite && <InviteSheet event={invite} onClose={() => setInvite(null)} />}
      <BadgeCelebration milestones={earned} onClose={()=>setEarned([])} /><Toast msg={toast} />
    </div></ReportContext.Provider></AvatarContext.Provider>
  );
}
