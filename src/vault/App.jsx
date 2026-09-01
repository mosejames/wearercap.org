import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HOUSE, YEAR, SITE, ASK, KINDS, MAX_BATCH, ADMIN_HINT, CONTACT,
  fmtDate, fmtRange, monthKey, monthLabel, todayISO, plural,
} from './config.js';
import {
  getOwner, localProfile, fetchProfile, saveProfile, localPass, rememberPass, checkPass,
  storageConfig, mediaUrl, listEvents, saveEvent,
  listPhotos, listTopPhotos, listRecentPhotos, listMyPhotos, updatePhoto,
  myLikes, like, unlike, listComments, commentCounts, addComment, hideComment,
  listRequests, saveRequest, listPhonesForAdmin, fetchTotals,
} from './data.js';
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
  if (e.kind === 'everyday') return 'open';
  const end = e.endsOn || e.startsOn;
  if (e.startsOn > today) return 'upcoming';
  if (end >= today) return 'today';
  return 'past';
};

const initials = (name) => (name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

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
  useLockScroll(true);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="sheet-back" onClick={onClose}>
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

/* ------------------------------------------------------------- profile */

function ProfileSheet({ profile, onSaved, onClose, firstTime, reason }) {
  const [form, setForm] = useState({
    displayName: profile?.display_name || '',
    student: profile?.student || '',
    phone: profile?.phone || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (form.displayName.trim().length < 2) { setErr('Add the name you want on your photos.'); return; }
    setBusy(true); setErr('');
    try { onSaved(await saveProfile(form)); }
    catch (ex) { setErr(ex.message || 'Could not save.'); setBusy(false); }
  };
  return (
    <Sheet title={firstTime ? 'Who is this?' : 'Your name in the vault'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        {firstTime && <p className="lede">{reason || 'One quick thing so your photos have a name on them.'} No account, no password. This phone remembers you.</p>}
        <label className="field">
          <span>Your name</span>
          <input autoFocus value={form.displayName} onChange={set('displayName')} placeholder="Keisha J." maxLength={60} />
        </label>
        <label className="field">
          <span>Student(s) <i>optional</i></span>
          <input value={form.student} onChange={set('student')} placeholder="Jordan, 6th" maxLength={80} />
        </label>
        <label className="field">
          <span>Mobile <i>optional</i></span>
          <input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="(404) 555-0123" maxLength={24} />
          <small>Only so the house can text you when photos are wanted. Never shown.</small>
        </label>
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

  const pick = (e) => {
    const list = Array.from(e.target.files || []).filter((f) => /^image\//.test(f.type) || /\.(hei[cf]|jpe?g|png|webp)$/i.test(f.name));
    if (!list.length) { setErr('Pick photos (JPG, PNG, HEIC).'); return; }
    setErr(list.length > MAX_BATCH ? `First ${MAX_BATCH} taken. Add the rest in another round.` : '');
    setFiles(list.slice(0, MAX_BATCH));
  };

  const start = async () => {
    setErr('');
    abort.current = new AbortController();
    try {
      const final = await uploadBatch(files, { event, profile, onProgress: setState, signal: abort.current.signal });
      setState(final);
      if (final.done.length) onDone(final.done);
    } catch (ex) {
      setErr(ex.message || 'Upload failed.');
    }
  };

  const finished = !!state?.finished;
  const pct = state ? Math.round(((state.prepared / (state.total || 1)) * 25) + ((state.bytesTotal ? state.bytesSent / state.bytesTotal : 0) * 75)) : 0;

  return (
    <Sheet title={`Add photos · ${event.title}`} onClose={onClose}>
      {!state ? (
        <div className="stack">
          <p className="lede">Pick as many as you like. Originals are kept at full size; a fast copy is made on your phone for the grid.</p>
          <input ref={inputRef} type="file" accept="image/*,.heic,.heif" multiple hidden onChange={pick} />
          <button className="btn ghost big" onClick={() => inputRef.current?.click()}>
            {files.length ? `${plural(files.length, 'photo')} picked · change` : 'Choose photos'}
          </button>
          {files.length > 0 && (
            <div className="pick-preview">
              {files.slice(0, 12).map((f, i) => <PickThumb key={i} file={f} />)}
              {files.length > 12 && <span className="pick-more">+{files.length - 12}</span>}
            </div>
          )}
          {err && <p className="err">{err}</p>}
          <button className="btn primary" disabled={!files.length} onClick={start}>
            Add {files.length ? plural(files.length, 'photo') : 'photos'} to the vault
          </button>
          <p className="fine">Adding as <b>{profile?.display_name}</b>. Anyone in the house can see, like, comment on, and download what you add.</p>
        </div>
      ) : (
        <div className="stack">
          <div className="bar"><i style={{ width: `${Math.min(100, pct)}%` }} /></div>
          <p className="lede">
            {finished
              ? `${plural(state.done.length, 'photo')} added.`
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
  return <span className="pick-thumb">{url && <img src={url} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />}</span>;
}

/* ------------------------------------------------------------ download */

function DownloadSheet({ event, photos, onClose }) {
  const [which, setWhich] = useState('web');
  const [prog, setProg] = useState(null);
  const [err, setErr] = useState('');
  const est = (w) => photos.reduce((n, p) => n + (w === 'orig' ? (p.bytes || 3_500_000) : 350_000), 0);
  const start = async () => {
    setErr('');
    try {
      const pad = String(photos.length).length;
      const entries = photos.map((p, i) => {
        const ext = which === 'orig' ? (p.key.split('.').pop() || 'jpg') : 'jpg';
        const who = (p.uploaderName || 'amistad').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        const when = p.takenAt ? p.takenAt.slice(0, 10) : p.createdAt.slice(0, 10);
        return {
          name: `${event.slug}/${String(i + 1).padStart(pad, '0')}-${when}-${who}.${ext}`,
          date: p.takenAt || p.createdAt,
          open: async () => {
            const r = await fetch(mediaUrl(p, which));
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
          <p className="lede">{plural(photos.length, 'photo')} as one zip.</p>
          <div className="choice">
            <button className={which === 'web' ? 'on' : ''} onClick={() => setWhich('web')}>
              <b>Web size</b><span>Fast. Great on screens, fine for 5×7 prints. ~{fmtBytes(est('web'))}</span>
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

/* ------------------------------------------------------------ lightbox */

function Lightbox({ photos, index, onIndex, onClose, owner, profile, liked, onLike, admin, pass, onHidden, onNeedName, event }) {
  const p = photos[index];
  const [comments, setComments] = useState(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const touch = useRef(null);
  useLockScroll(true);

  useEffect(() => {
    setComments(null);
    let alive = true;
    listComments(p.id).then((c) => { if (alive) setComments(c); }).catch(() => setComments([]));
    return () => { alive = false; };
  }, [p.id]);

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [index, photos.length, onClose, onIndex]);

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

  const mine = owner && p.owner === owner;
  const when = p.takenAt || p.createdAt;

  return (
    <div className="lb" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="lb-top">
        <button className="icon-btn" onClick={onClose} aria-label="Close">{I.close}</button>
        <span className="lb-count">{index + 1} / {photos.length}</span>
        <div className="lb-top-actions">
          <button className="icon-btn" onClick={share} aria-label="Share">{I.share}</button>
          <a className="icon-btn" href={mediaUrl(p, 'orig')} download target="_blank" rel="noopener" aria-label="Download original">{I.down}</a>
        </div>
      </div>
      <div className="lb-stage" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {index > 0 && <button className="lb-nav prev" onClick={() => onIndex(index - 1)} aria-label="Previous">{I.left}</button>}
        <img key={p.id} src={mediaUrl(p, 'web')} alt={p.caption || ''} width={p.width || undefined} height={p.height || undefined} />
        {index < photos.length - 1 && <button className="lb-nav next" onClick={() => onIndex(index + 1)} aria-label="Next">{I.right}</button>}
      </div>
      <div className="lb-panel">
        <div className="lb-meta">
          <span className="avatar">{initials(p.uploaderName)}</span>
          <div>
            <b>{p.uploaderName || 'Amistad family'}</b>
            <small>{fmtDate(when, { year: 'numeric' })}{p.takenAt ? '' : ' · added'}{p.hidden ? ' · hidden' : ''}</small>
          </div>
          <div className="lb-actions">
            <button className={`pill${liked ? ' on' : ''}`} onClick={() => onLike(p)} aria-pressed={liked}>
              {I.heart(liked)}<span>{p.likes || ''}</span>
            </button>
            {(mine || admin) && (
              <button className="pill" onClick={async () => {
                if (!confirm(p.hidden ? 'Show this photo again?' : 'Hide this photo from the vault?')) return;
                try { await updatePhoto(p.id, { hidden: !p.hidden }, pass); } catch (ex) { alert(ex.message); return; }
                onHidden(p, !p.hidden);
              }}>{I.eye}<span>{p.hidden ? 'Show' : 'Hide'}</span></button>
            )}
          </div>
        </div>
        {p.caption && <p className="lb-cap">{p.caption}</p>}
        <div className="lb-comments">
          {comments === null ? <p className="fine">Loading…</p> : comments.length === 0 ? <p className="fine">No comments yet. Say the thing.</p> : (
            comments.map((c) => (
              <div key={c.id} className={`cmt${c.hidden ? ' hidden' : ''}`}>
                <b>{c.author || 'Someone'}</b>
                <span>{c.body}</span>
                {(admin || (owner && c.owner === owner)) && !c.hidden && (
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
    </div>
  );
}

/* ---------------------------------------------------------------- grid */

function PhotoGrid({ photos, onOpen, likedSet, counts, emptyText, rank = false }) {
  if (!photos.length) return <p className="empty">{emptyText || 'Nothing here yet.'}</p>;
  return (
    <div className="grid">
      {photos.map((p, i) => (
        <button key={p.id} className={`tile${p.hidden ? ' hidden' : ''}`} onClick={() => onOpen(i)} aria-label={`Photo by ${p.uploaderName || 'a family'}`}>
          <img src={mediaUrl(p, 'thumb')} alt="" loading="lazy" decoding="async" />
          {rank && i < 3 && <span className="rank">{i + 1}</span>}
          {(p.likes > 0 || (counts && counts.get(p.id))) && (
            <span className="tile-meta">
              {p.likes > 0 && <em className={likedSet?.has(p.id) ? 'on' : ''}>{I.heart(true)}{p.likes}</em>}
              {counts?.get(p.id) > 0 && <em>{I.comment}{counts.get(p.id)}</em>}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- top bar */

function TopBar({ profile, admin, onName, onProfile, route }) {
  return (
    <header className="topbar">
      <div className="shell topbar-in">
        <a href="#/" className="mark" aria-label={SITE.title}>
          <span>AMI</span> VAULT
          <small>{YEAR.label} · {HOUSE.name} House</small>
        </a>
        <nav className="nav">
          <a href="#/" className={route === 'home' ? 'on' : ''}>Timeline</a>
          <a href="#/top" className={route === 'top' ? 'on' : ''}>Favorites</a>
          {profile
            ? <button className="nav-me" onClick={onProfile} aria-label="You"><span className="avatar sm">{initials(profile.display_name)}</span></button>
            : <button className="nav-btn" onClick={onName}>Name</button>}
          {admin && <a href="#/admin" className={route === 'admin' ? 'on' : ''}>Admin</a>}
        </nav>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- home */

function EventCard({ e, covers, today }) {
  const status = eventStatus(e, today);
  const kind = KINDS[e.kind] || KINDS.school;
  const thumbs = covers.get(e.id) || [];
  return (
    <a href={`#/e/${e.slug}`} className={`ev ${status}${e.featured ? ' featured' : ''}${e.kind === 'everyday' ? ' everyday' : ''}`}>
      <div className={`ev-cover n${Math.min(thumbs.length, 4)}`}>
        {thumbs.length ? thumbs.slice(0, 4).map((p) => <img key={p.id} src={mediaUrl(p, 'thumb')} alt="" loading="lazy" />)
          : <span className="ev-blank">{status === 'upcoming' ? fmtDate(e.startsOn) : kind.short}</span>}
      </div>
      <div className="ev-body">
        <span className="ev-date">{e.kind === 'everyday' ? 'All year' : fmtRange(e.startsOn, e.endsOn)}{e.kind !== 'everyday' && <i> · {kind.label}</i>}</span>
        <h3>{e.title}</h3>
        <p className="ev-stat">
          {e.photoCount
            ? <>{plural(e.photoCount, 'photo')}<span> · {plural(e.contributorCount, 'family', 'families')}</span></>
            : status === 'upcoming' ? <span>Coming up</span> : status === 'today' ? <span>Happening now. Be first.</span> : <span>No photos yet. Fix that.</span>}
        </p>
      </div>
    </a>
  );
}

function Home({ events, requests, recent, covers, totals, onAdd, today }) {
  useDocTitle('');
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const openAsks = requests.filter((r) => r.open && (!r.dueOn || r.dueOn >= today)).map((r) => ({ ...r, event: byId.get(r.eventId) })).filter((r) => r.event);
  const months = useMemo(() => {
    const m = new Map();
    for (const e of events.filter((x) => x.kind !== 'everyday' && !x.hidden)) {
      const k = monthKey(e.startsOn);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(e);
    }
    return [...m.entries()];
  }, [events]);
  const everyday = events.find((e) => e.kind === 'everyday');
  const firstOpen = openAsks[0]?.event || events.filter((e) => e.open && eventStatus(e, today) !== 'upcoming').sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1))[0] || everyday;

  return (
    <>
      <section className="hero">
        <div className="shell">
          <p className="kicker">{SITE.kicker}</p>
          <h1>{SITE.titleLead} <span className="ember">{SITE.titleGrad}</span></h1>
          <p className="intro">{SITE.intro}</p>
          <div className="hero-cta">
            <button className="btn primary big" onClick={() => onAdd(firstOpen)}>{I.plus} Add photos</button>
            <a className="btn ghost-light big" href="#the-year">See the year</a>
          </div>
          <dl className="stats">
            <div><dt>{totals.photos}</dt><dd>photos</dd></div>
            <div><dt>{totals.families}</dt><dd>families</dd></div>
            <div><dt>{totals.events}</dt><dd>events with photos</dd></div>
          </dl>
        </div>
      </section>

      <section className="asks">
        <div className="shell">
          <div className="sec-head">
            <span className="eyebrow">{ASK.eyebrow}</span>
            <p>{openAsks.length ? 'Open right now. Every family that adds one makes the record better.' : ASK.none}</p>
          </div>
          {openAsks.length > 0 && (
            <div className="ask-row">
              {openAsks.map((r) => {
                const pct = Math.min(100, Math.round((r.event.photoCount / r.goal) * 100));
                return (
                  <div key={r.id} className="ask">
                    <div className="ask-top">
                      <span className="ask-date">{fmtRange(r.event.startsOn, r.event.endsOn)}</span>
                      {r.dueOn && <span className="ask-due">by {fmtDate(r.dueOn, { weekday: 'short' })}</span>}
                    </div>
                    <h3>{r.event.title}</h3>
                    {r.message && <p>{r.message}</p>}
                    <div className="ask-bar"><i style={{ width: `${pct}%` }} /></div>
                    <div className="ask-foot">
                      <span><b>{r.event.photoCount}</b> of {r.goal} · {plural(r.event.contributorCount, 'family', 'families')}</span>
                      <button className="btn small primary" onClick={() => onAdd(r.event)}>Add mine</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="recent">
          <div className="shell">
            <div className="sec-head">
              <span className="eyebrow">Just added</span>
              <p>The newest photos in the vault, from whoever got there first.</p>
            </div>
          </div>
          <div className="strip">
            {recent.map((p) => {
              const e = byId.get(p.eventId);
              return (
                <a key={p.id} href={`#/e/${e?.slug || ''}/p/${p.id}`} className="strip-item">
                  <img src={mediaUrl(p, 'thumb')} alt="" loading="lazy" />
                  <span>{e?.title}</span>
                </a>
              );
            })}
          </div>
        </section>
      )}

      <section className="year" id="the-year">
        <div className="shell">
          <div className="sec-head">
            <span className="eyebrow">The year</span>
            <p>Every event, in order. Tap one to see it, or to add to it. Past, present and coming up.</p>
          </div>
          {everyday && (
            <div className="ev-month">
              <div className="ev-list one"><EventCard e={everyday} covers={covers} today={today} /></div>
            </div>
          )}
          {months.map(([k, list]) => (
            <div key={k} className="ev-month">
              <h2 className="month">{monthLabel(k)}</h2>
              <div className="ev-list">{list.map((e) => <EventCard key={e.id} e={e} covers={covers} today={today} />)}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

/* --------------------------------------------------------------- event */

function EventPage({ event, owner, profile, admin, pass, onAdd, onNeedName, refreshEvents, initialPhotoId, today, showToast }) {
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
    const list = photos.filter((p) => !p.hidden || admin || p.owner === owner);
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
    setLiked((s) => { const n = new Set(s); was ? n.delete(p.id) : n.add(p.id); return n; });
    setPhotos((ps) => ps.map((x) => (x.id === p.id ? { ...x, likes: Math.max(0, x.likes + (was ? -1 : 1)) } : x)));
    try { was ? await unlike(p.id) : await like(p.id); }
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
          <span className="ev-date big">{event.kind === 'everyday' ? 'All year long' : fmtRange(event.startsOn, event.endsOn)} <i>· {kind.label}</i></span>
          <h1>{event.title}</h1>
          {event.blurb && <p className="ev-blurb">{event.blurb}</p>}
          <p className="ev-counts">
            {photos ? <>{plural(visible.length, 'photo')} · {plural(new Set(visible.map((p) => p.owner)).size, 'family', 'families')} · {plural(visible.reduce((n, p) => n + p.likes, 0), 'love')}</> : 'Loading…'}
          </p>
          <div className="ev-actions">
            {event.open
              ? <button className="btn primary" onClick={() => onAdd(event)}>{I.plus} Add photos</button>
              : <span className="closed">Closed to new photos</span>}
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
        <div className="fab-wrap"><button className="fab" onClick={() => onAdd(event)}>{I.plus} Add photos</button></div>
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
  useDocTitle('Favorites');
  const [photos, setPhotos] = useState(null);
  const [liked, setLiked] = useState(new Set());
  const [open, setOpen] = useState(null);
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  useEffect(() => {
    listTopPhotos(90).then(async (ps) => { setPhotos(ps); setLiked(await myLikes(ps.map((p) => p.id))); }).catch((e) => showToast(e.message));
  }, [showToast]);
  const toggleLike = async (p) => {
    const was = liked.has(p.id);
    setLiked((s) => { const n = new Set(s); was ? n.delete(p.id) : n.add(p.id); return n; });
    setPhotos((ps) => ps.map((x) => (x.id === p.id ? { ...x, likes: Math.max(0, x.likes + (was ? -1 : 1)) } : x)));
    try { was ? await unlike(p.id) : await like(p.id); } catch (e) { showToast(e.message); }
  };
  return (
    <div className="shell page">
      <div className="sec-head">
        <span className="eyebrow">Favorites</span>
        <h1 className="page-title">The most loved photos of the year.</h1>
        <p>Ranked by the house, live. Tap the heart on anything and it moves.</p>
      </div>
      {photos === null ? <p className="empty">Loading…</p>
        : <PhotoGrid photos={photos} onOpen={setOpen} likedSet={liked} rank emptyText="No hearts yet. Go love something." />}
      {open !== null && photos?.[open] && (
        <Lightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)}
          event={byId.get(photos[open].eventId) || { slug: '', title: '' }} owner={owner} profile={profile} admin={false} pass=""
          liked={liked.has(photos[open].id)} onLike={toggleLike} onNeedName={onNeedName} onHidden={() => {}} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ me */

function MePage({ owner, profile, events, onProfile, showToast }) {
  useDocTitle('Me');
  const [photos, setPhotos] = useState(null);
  const [open, setOpen] = useState(null);
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  useEffect(() => { listMyPhotos().then(setPhotos).catch((e) => showToast(e.message)); }, [showToast]);
  return (
    <div className="shell page">
      <div className="me-head">
        <span className="avatar lg">{initials(profile?.display_name)}</span>
        <div>
          <h1 className="page-title">{profile?.display_name || 'You'}</h1>
          <p>{profile?.student ? profile.student : 'This phone remembers you. No account needed.'}</p>
          <div className="row">
            <button className="btn small ghost" onClick={onProfile}>{profile ? 'Edit name' : 'Add your name'}</button>
          </div>
        </div>
      </div>
      <div className="sec-head"><span className="eyebrow">Your photos</span><p>{photos ? plural(photos.length, 'photo') : ''}</p></div>
      {photos === null ? <p className="empty">Loading…</p>
        : <PhotoGrid photos={photos} onOpen={setOpen} emptyText="You have not added anything from this phone yet." />}
      {open !== null && photos?.[open] && (
        <Lightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)}
          event={byId.get(photos[open].eventId) || { slug: '', title: '' }} owner={owner} profile={profile} admin={false} pass=""
          liked={false} onLike={() => {}} onNeedName={() => {}}
          onHidden={(p, hidden) => setPhotos((ps) => ps.map((x) => (x.id === p.id ? { ...x, hidden } : x)))} />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- admin */

const EMPTY_EVENT = { title: '', slug: '', blurb: '', kind: 'house', startsOn: '', endsOn: '', open: true, featured: false, hidden: false };

function AdminPage({ admin, pass, onPass, events, requests, refresh, showToast, storage }) {
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
          <h1 className="page-title">Passcode.</h1>
          <label className="field"><span>Admin passcode</span><input type="password" autoFocus value={tryPass} onChange={(e) => setTryPass(e.target.value)} /></label>
          {passErr && <p className="err">{passErr}</p>}
          <button className="btn primary">Open</button>
        </form>
      </div>
    );
  }

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
    setNudge(`Amistad fam: ${ev.title} photos wanted${due}. ${r.message ? `${r.message} ` : ''}${ev.photoCount} in so far from ${plural(ev.contributorCount, 'family', 'families')}. Add yours here: ${link}`);
  };
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); showToast('Copied.'); } catch { prompt('Copy', t); } };

  return (
    <div className="shell page admin">
      <div className="sec-head">
        <span className="eyebrow">Back office</span>
        <h1 className="page-title">Run the vault.</h1>
        <p>Storage: <b>{storage?.mode === 'r2' ? 'Cloudflare R2' : 'Supabase Storage (on-ramp)'}</b>. Events, asks, and the nudge text live here. <button className="link" onClick={() => onPass('')}>Lock</button></p>
      </div>

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
                  <button className="link" onClick={() => setEditing({ id: e.id, form: { title: e.title, slug: e.slug, blurb: e.blurb, kind: e.kind, startsOn: e.startsOn, endsOn: e.endsOn || '', open: e.open, featured: e.featured, hidden: e.hidden } })}>edit</button>
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
  const [profile, setProfile] = useState(() => localProfile());
  const [pass, setPassState] = useState(() => localPass());
  const [admin, setAdmin] = useState(false);
  const [events, setEvents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [recent, setRecent] = useState([]);
  const [storage, setStorage] = useState(null);
  const [nameAsk, setNameAsk] = useState(null);     // { reason, then } | null
  const [profileOpen, setProfileOpen] = useState(false);
  const [upload, setUpload] = useState(null);       // event | null
  const [toast, showToast] = useToast();

  useEffect(() => {
    getOwner().then(setOwner);
    fetchProfile().then((p) => { if (p) setProfile({ display_name: p.display_name, student: p.student }); }).catch(() => {});
  }, []);

  // Admin passcode is remembered on the device and re-checked on load.
  useEffect(() => {
    if (!pass) { setAdmin(false); return; }
    checkPass(pass).then((ok) => { setAdmin(ok); if (!ok) { rememberPass(''); setPassState(''); } });
  }, [pass]);
  const setPass = (p) => { rememberPass(p); setPassState(p); };

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

  const [totals, setTotals] = useState({ photos: 0, families: 0, events: 0 });

  const needName = useCallback((reason, then) => setNameAsk({ reason, then }), []);
  const currentEvent = route.name === 'event' ? events.find((e) => e.slug === route.slug) : null;

  const onAdd = (ev) => {
    if (!ev) return;
    if (route.name !== 'event' || route.slug !== ev.slug) go(`/e/${ev.slug}`);
    if (!profile) { needName(`Add your name so your ${ev.title} photos have it.`, () => setUpload(ev)); return; }
    setUpload(ev);
  };

  return (
    <div className="vault">
      <TopBar profile={profile} admin={admin} route={route.name}
        onName={() => needName('')}
        onProfile={() => go('/me')} />

      {route.name === 'home' && (
        <Home events={events} requests={requests} recent={recent} covers={allCovers} totals={totals} onAdd={onAdd} today={today} />
      )}
      {route.name === 'event' && (events.length ? (
        <EventPage key={route.slug} event={currentEvent} owner={owner} profile={profile} admin={admin} pass={pass} onAdd={onAdd}
          onNeedName={needName} refreshEvents={refresh} initialPhotoId={route.photoId} today={today} showToast={showToast} />
      ) : <div className="shell page"><p className="empty">Loading…</p></div>)}
      {route.name === 'top' && <TopPage events={events} owner={owner} profile={profile} onNeedName={needName} showToast={showToast} />}
      {route.name === 'me' && <MePage owner={owner} profile={profile} events={events} onProfile={() => setProfileOpen(true)} showToast={showToast} />}
      {route.name === 'admin' && <AdminPage admin={admin} pass={pass} onPass={setPass} events={events} requests={requests} refresh={refresh} showToast={showToast} storage={storage} />}

      <footer className="foot">
        <div className="shell">
          <p className="foot-mark"><span>AMI</span> VAULT · {YEAR.label}</p>
          <p>{HOUSE.name} means {HOUSE.meaning.toLowerCase()}. The vault is what it looks like.</p>
          <p className="fine">Photos belong to the families who took them and are shared here for the house. Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. {admin ? ADMIN_HINT : ''}</p>
        </div>
      </footer>

      {(nameAsk || profileOpen) && (
        <ProfileSheet profile={profile} firstTime={!profile} reason={nameAsk?.reason}
          onSaved={(p) => { setProfile({ display_name: p.display_name, student: p.student }); const then = nameAsk?.then; setNameAsk(null); setProfileOpen(false); if (then) then(); }}
          onClose={() => { setNameAsk(null); setProfileOpen(false); }} />
      )}
      {upload && profile && !nameAsk && (
        <UploadSheet event={upload} profile={profile}
          onClose={() => setUpload(null)}
          onDone={() => { refresh(); showToast('Added to the vault.'); }} />
      )}
      <Toast msg={toast} />
    </div>
  );
}
