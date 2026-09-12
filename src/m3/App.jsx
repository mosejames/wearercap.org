import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  VAULT, DAY, SITE, ASK, SHOT_LIST, MAX_BATCH, CONTACT,
  todayISO, msUntilNextDay, acceptsUploads, fmtDate, fmtTime, fmtWhen, plural, fmtBytes,
} from './config.js';
import * as db from './data.js';
import { uploadBatch } from './upload.js';
import { isVideo } from '../vault/videos.js';
import { useDropGuard, useDropTarget, useWindowDropTarget, DROP_CAP } from '../vault/dnd.js';
import { zipStream, saveStream } from '../vault/zipstream.js';

/* ------------------------------------------------------------- routing */

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const on = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}
const go = (h) => { window.location.hash = h; };

function useToday() {
  const [today, setToday] = useState(todayISO());
  useEffect(() => {
    const t = setTimeout(() => setToday(todayISO()), msUntilNextDay());
    return () => clearTimeout(t);
  }, [today]);
  return today;
}

/* --------------------------------------------------------------- icons */

const I = {
  heart: (p) => <svg viewBox="0 0 24 24" fill={p.on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" {...p}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>,
  chat: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" /></svg>,
  x: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>,
  left: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" {...p}><path d="m15 18-6-6 6-6" /></svg>,
  right: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" {...p}><path d="m9 18 6-6-6-6" /></svg>,
  share: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" /></svg>,
  down: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M21 15v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4M7 10l5 5 5-5M12 15V3" /></svg>,
  plus: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" {...p}><path d="M12 5v14M5 12h14" /></svg>,
  eye: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><path d="M17.9 17.9A10 10 0 0 1 2 12s3-7 10-7a9.7 9.7 0 0 1 5.9 2M22 12s-1 2.3-3.2 4.2M1 1l22 22" /></svg>,
  play: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M8 5v14l11-7z" /></svg>,
};

/* ---------------------------------------------------------------- app */

export default function App() {
  useDropGuard();
  const hash = useHash();
  const today = useToday();
  const [events, setEvents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [totals, setTotals] = useState({ photos: 0, families: 0, events: 0, likes: 0 });
  const [people, setPeople] = useState(new Map());
  const [profile, setProfile] = useState(() => db.localProfile());
  const [admin, setAdmin] = useState(() => db.localPass());
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');
  const [sheet, setSheet] = useState(null);   // {kind, ...}
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [ev, rq, tt, pp] = await Promise.all([db.listEvents(), db.listRequests(), db.fetchTotals(), db.listPeople()]);
      setEvents(ev); setRequests(rq); setTotals(tt); setPeople(pp);
      setErr('');
    } catch (e) { setErr(e.message || 'Could not load the vault.'); }
  }, []);
  useEffect(() => { refresh(); }, [refresh, tick]);
  useEffect(() => { db.fetchProfile().then((p) => { if (p) setProfile(p); }).catch(() => {}); }, []);
  useEffect(() => {
    if (!admin) return;
    db.checkPass(admin).then((ok) => { if (!ok) { setAdmin(''); db.rememberPass(''); } });
  }, [admin]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 2600); return () => clearTimeout(t); }, [toast]);
  const bump = () => setTick((n) => n + 1);

  const ctx = {
    events, requests, totals, people, profile, setProfile, admin, setAdmin, today,
    sheet, setSheet, toast: setToast, bump,
    // Every upload starts here so the name sheet is never skipped.
    startUpload: (event, files = null) => {
      if (!profile?.displayName) setSheet({ kind: 'name', then: { kind: 'upload', event, files } });
      else setSheet({ kind: 'upload', event, files });
    },
  };

  let page;
  const m = hash.match(/^#\/e\/([^/?]+)/);
  if (m) page = <EventPage ctx={ctx} slug={decodeURIComponent(m[1])} />;
  else if (hash.startsWith('#/top')) page = <TopPage ctx={ctx} />;
  else if (hash.startsWith('#/me')) page = <MePage ctx={ctx} />;
  else if (hash.startsWith('#/admin')) page = <AdminPage ctx={ctx} />;
  else page = <Home ctx={ctx} />;

  return (
    <>
      <TopBar ctx={ctx} hash={hash} />
      {err && <div className="shell"><p className="err" style={{ padding: '12px 0' }}>{err}</p></div>}
      {page}
      <Foot />
      {sheet?.kind === 'name' && <NameSheet ctx={ctx} onDone={(p) => { setProfile(p); setSheet(sheet.then || null); }} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'upload' && <UploadSheet ctx={ctx} event={sheet.event} initialFiles={sheet.files} onClose={() => setSheet(null)} />}
      {sheet?.kind === 'download' && <DownloadSheet event={sheet.event} photos={sheet.photos} onClose={() => setSheet(null)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function TopBar({ ctx, hash }) {
  const on = (h) => (hash === h || (h === '#/' && !hash.startsWith('#/'))) ? 'on' : '';
  const initials = (ctx.profile?.displayName || '').split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase();
  return (
    <header className="topbar">
      <div className="shell topbar-in">
        <a className="mark" href="#/"><span>M³</span> Vault<small>CLASS OF 2028 · {DAY.place.toUpperCase()}</small></a>
        <nav className="nav">
          <a className={`nav-home ${on('#/')}`} href="#/">Today</a>
          <a className={on('#/top')} href="#/top">Loved</a>
          {ctx.admin && <a className={on('#/admin')} href="#/admin">Admin</a>}
          {ctx.profile?.displayName
            ? <a className="nav-me" href="#/me" aria-label="Me"><span className="avatar">{initials}</span></a>
            : <button className="nav-btn" onClick={() => ctx.setSheet({ kind: 'name' })}>Add your name</button>}
        </nav>
      </div>
    </header>
  );
}

function Foot() {
  return (
    <footer className="foot">
      <div className="shell">
        <p className="foot-mark">M³ Vault</p>
        <p>{DAY.label}, {DAY.place}. Class of 2028 with {VAULT.host}. Nothing here is ever deleted; your own uploads can be hidden from Me.</p>
        <p className="fine">Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
      </div>
    </footer>
  );
}

/* ---------------------------------------------------------------- home */

function Home({ ctx }) {
  const { events, requests, totals, today } = ctx;
  const [recent, setRecent] = useState([]);
  const isDay = today >= DAY.date;
  const open = requests.filter((r) => r.open);
  const byId = new Map(events.map((e) => [e.id, e]));
  const everyday = events.find((e) => e.kind === 'everyday' && !e.hidden);
  const moments = events.filter((e) => e.kind !== 'everyday' && !e.hidden);

  // The live strip. Polls while the day is on so Dr. J can watch it fill.
  useEffect(() => {
    let alive = true;
    const load = () => db.listRecentPhotos(18).then((p) => alive && setRecent(p)).catch(() => {});
    load();
    const t = isDay ? setInterval(() => { load(); ctx.bump(); }, 45_000) : null;
    return () => { alive = false; if (t) clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDay]);

  const target = everyday && acceptsUploads(everyday, today) ? everyday : null;
  const openMoment = moments.find((e) => acceptsUploads(e, today));

  return (
    <main>
      <section className="hero">
        <div className="shell">
          <p className="kicker">{SITE.kicker}</p>
          <h1>Mall Math<br /><span className="ember">Marathon.</span></h1>
          <p className="intro">{SITE.intro}</p>
          <div className="hero-cta">
            <button className="btn primary big" onClick={() => ctx.startUpload(openMoment || target)} disabled={!openMoment && !target}>
              <I.plus width="18" height="18" /> Add photos
            </button>
            {!isDay && <span className="hero-note">Opens {fmtDate(DAY.date, { weekday: 'long' })} at 12:01am. Around the Mall is open now.</span>}
          </div>
          <dl className="stats">
            <div><dt>{totals.photos}</dt><dd>Photos</dd></div>
            <div><dt>{totals.families}</dt><dd>Chaperones</dd></div>
            <div><dt>{totals.likes}</dt><dd>Loves</dd></div>
          </dl>
        </div>
      </section>

      {open.length > 0 && (
        <section className="asks">
          <div className="shell">
            <div className="sec-head"><span className="eyebrow">{ASK.eyebrow}</span></div>
            <div className="ask-row">
              {open.map((r) => <AskCard key={r.id} r={r} ev={byId.get(r.eventId)} ctx={ctx} />)}
            </div>
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="recent">
          <div className="shell sec-head"><span className="eyebrow">Just added</span></div>
          <div className="strip">
            {recent.map((p) => (
              <a key={p.id} className="strip-item" href={`#/e/${byId.get(p.eventId)?.slug || ''}?p=${p.id}`}>
                <Thumb p={p} />
                <span>{p.uploaderName || 'Someone'}{ctx.people.get(p.owner)?.team ? ` · ${ctx.people.get(p.owner).team}` : ''}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="year">
        <div className="shell">
          <div className="sec-head">
            <span className="eyebrow">The day</span>
            <h2 className="page-title">{DAY.label}</h2>
            <p>Every moment opens at 12:01am on the day and never closes. Missed one? Add it later; it lands in order by when it was taken.</p>
          </div>
          <div className="ev-list">
            {moments.map((e) => <EventCard key={e.id} e={e} ctx={ctx} />)}
          </div>
          {everyday && (
            <div className="everyday-invitation">
              <div>
                <h3>{everyday.title}</h3>
                <p>{everyday.blurb}</p>
              </div>
              <div className="everyday-actions">
                <button className="btn primary" onClick={() => ctx.startUpload(everyday)}>Add photos</button>
                <a href={`#/e/${everyday.slug}`}>{plural(everyday.photoCount, 'photo')} so far</a>
              </div>
            </div>
          )}
          <TeamsStrip ctx={ctx} />
        </div>
      </section>
    </main>
  );
}

function AskCard({ r, ev, ctx }) {
  if (!ev) return null;
  const pct = Math.min(100, Math.round((ev.photoCount / Math.max(1, r.goal)) * 100));
  return (
    <article className="ask">
      <div className="ask-top"><span>{ev.title}</span>{r.dueOn && <span className="ask-due">by {fmtDate(r.dueOn, { weekday: 'short' })}</span>}</div>
      <h3>{r.message || `${ev.title}: photos wanted`}</h3>
      <div className="ask-bar"><i style={{ width: `${pct}%` }} /></div>
      <div className="ask-foot">
        <span><b>{ev.photoCount}</b> of {r.goal} · {plural(ev.contributorCount, 'chaperone')}</span>
        <button className="btn small" onClick={() => ctx.startUpload(ev)} disabled={!acceptsUploads(ev, ctx.today)}>Add yours</button>
      </div>
    </article>
  );
}

function EventCard({ e, ctx }) {
  const [cover, setCover] = useState([]);
  useEffect(() => { if (e.photoCount) db.listCoverPhotos(e.id).then(setCover).catch(() => {}); }, [e.id, e.photoCount]);
  const open = acceptsUploads(e, ctx.today);
  return (
    <div className="ev-wrap">
      <a className={`ev ${open ? '' : 'upcoming'}`} href={`#/e/${e.slug}`}>
        <div className={`ev-cover n${Math.min(4, cover.length) || 1}`}>
          {cover.length ? cover.map((p) => <img key={p.id} src={db.mediaUrl(p, 'thumb')} alt="" loading="lazy" />) : <span className="ev-blank">{e.startsAt ? fmtTime(e.startsAt) : 'M³'}</span>}
        </div>
        <div className="ev-body">
          <span className="ev-date">{e.startsAt ? fmtTime(e.startsAt) : 'Any time'}</span>
          <h3>{e.title}</h3>
          <p className="ev-stat">{e.photoCount ? <>{plural(e.photoCount, 'photo')} <span>from {plural(e.contributorCount, 'chaperone')}</span></> : <span>{open ? 'No photos yet. Be the first.' : 'Opens on the day'}</span>}</p>
        </div>
      </a>
    </div>
  );
}

function TeamsStrip({ ctx }) {
  const [teams, setTeams] = useState([]);
  useEffect(() => { db.listTeams().then(setTeams).catch(() => {}); }, [ctx.totals.photos, ctx.people]);
  if (!teams.length) return null;
  return (
    <div className="teams">
      <div className="sec-head"><span className="eyebrow">Teams</span></div>
      <div className="team-row">
        {teams.map((t) => (
          <div className="team" key={t.team}>
            <b>{t.team}</b>
            <span>{t.chaperones.join(', ')}</span>
            {t.students.length > 0 && <small>{t.students.join(' · ')}</small>}
            <i>{plural(t.photoCount, 'photo')}</i>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- event */

function Thumb({ p, onClick, meta }) {
  const video = db.isVideoPhoto(p);
  const img = <img src={db.mediaUrl(p, 'thumb')} alt={p.caption || ''} loading="lazy" width={p.width || undefined} height={p.height || undefined} />;
  if (!onClick) return <span className="tile">{img}{video && <span className="video-badge"><I.play width="12" height="12" /></span>}</span>;
  return (
    <button className={`tile ${p.hidden ? 'hidden' : ''}`} onClick={onClick}>
      {img}
      {video && <span className="video-badge"><I.play width="12" height="12" /></span>}
      {meta}
    </button>
  );
}

function EventPage({ ctx, slug }) {
  const { events, today, admin } = ctx;
  const event = events.find((e) => e.slug === slug);
  const [photos, setPhotos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [sort, setSort] = useState('order');
  const [team, setTeam] = useState('');
  const [liked, setLiked] = useState(new Set());
  const [ccount, setCcount] = useState(new Map());
  const [open, setOpen] = useState(null);   // photo id in lightbox

  const load = useCallback(async () => {
    if (!event) return;
    const ps = await db.listPhotos(event.id);
    setPhotos(ps); setLoaded(true);
    const ids = ps.map((p) => p.id);
    const [l, c] = await Promise.all([db.myLikes(ids), db.commentCounts(ids)]);
    setLiked(l); setCcount(c);
  }, [event?.id]);
  useEffect(() => { load().catch(() => setLoaded(true)); }, [load, ctx.totals.photos]);

  // Deep link from the Just added strip: #/e/slug?p=<id>
  useEffect(() => {
    const q = window.location.hash.split('?')[1];
    const id = q && new URLSearchParams(q).get('p');
    if (id && photos.some((p) => p.id === id)) setOpen(id);
  }, [photos]);

  const drop = useWindowDropTarget((files) => {
    if (!event || !files.length) return;
    ctx.startUpload(event, files.slice(0, MAX_BATCH));
    if (files.length > MAX_BATCH) ctx.toast(`Kept the first ${MAX_BATCH}. Drop the rest after.`);
  }, !!event && acceptsUploads(event, today) && ctx.sheet == null);

  const teams = useMemo(() => {
    const s = new Set();
    for (const p of photos) { const t = ctx.people.get(p.owner)?.team; if (t) s.add(t); }
    return Array.from(s).sort();
  }, [photos, ctx.people]);

  const shown = useMemo(() => {
    let list = photos.filter((p) => !team || ctx.people.get(p.owner)?.team === team);
    if (sort === 'loved') list = [...list].sort((a, b) => b.likes - a.likes || (a.createdAt < b.createdAt ? 1 : -1));
    else if (sort === 'newest') list = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return list;
  }, [photos, sort, team, ctx.people]);

  if (!event) return <main className="shell page"><p className="empty">{events.length ? 'No such album.' : 'Loading'}</p></main>;
  const can = acceptsUploads(event, today);

  const toggleLike = async (p) => {
    const on = liked.has(p.id);
    setLiked((s) => { const n = new Set(s); on ? n.delete(p.id) : n.add(p.id); return n; });
    setPhotos((ps) => ps.map((x) => (x.id === p.id ? { ...x, likes: Math.max(0, x.likes + (on ? -1 : 1)) } : x)));
    try { on ? await db.unlike(p.id) : await db.like(p.id); } catch (e) { ctx.toast(e.message); }
  };

  return (
    <main className={`event ${drop.over ? 'dropping' : ''}`}>
      <div className="ev-head">
        <div className="shell">
          <a className="crumb" href="#/">← {DAY.label}</a>
          <span className="ev-date big">{event.startsAt ? fmtTime(event.startsAt) : 'Any time'} · {DAY.place}</span>
          <h1>{event.title}</h1>
          {event.blurb && <p className="ev-blurb">{event.blurb}</p>}
          <p className="ev-counts">{plural(event.photoCount, 'photo')} · {plural(event.contributorCount, 'chaperone')} · {plural(event.likeCount, 'love')}</p>
          <div className="ev-actions">
            {can ? <button className="btn primary" onClick={() => ctx.startUpload(event)}><I.plus width="16" height="16" /> Add photos</button>
                 : <span className="closed">Opens {fmtDate(event.startsOn, { weekday: 'long' })} at 12:01am.</span>}
            {admin && photos.length > 0 && <button className="btn ghost" onClick={() => ctx.setSheet({ kind: 'download', event, photos: shown })}><I.down width="16" height="16" /> Download all</button>}
            <div className="sort">
              {[['order', 'In order'], ['loved', 'Most loved'], ['newest', 'Newest']].map(([k, l]) => (
                <button key={k} className={sort === k ? 'on' : ''} onClick={() => setSort(k)}>{l}</button>
              ))}
            </div>
          </div>
          {teams.length > 1 && (
            <div className="chips">
              <button className={!team ? 'on' : ''} onClick={() => setTeam('')}>All teams</button>
              {teams.map((t) => <button key={t} className={team === t ? 'on' : ''} onClick={() => setTeam(t)}>{t}</button>)}
            </div>
          )}
        </div>
      </div>

      <div className="shell">
        {!loaded ? <p className="empty">Loading</p>
          : !shown.length ? <p className="empty">{can ? <>Nothing here yet. <button className="link" onClick={() => ctx.startUpload(event)}>Add the first one.</button></> : 'Opens on the day.'}</p>
          : (
            <div className="grid">
              {shown.map((p) => (
                <div className="tile-wrap" key={p.id}>
                  <Thumb p={p} onClick={() => setOpen(p.id)} meta={
                    <span className="tile-meta">
                      <em className={liked.has(p.id) ? 'on' : ''}><I.heart on={liked.has(p.id)} />{p.likes || ''}</em>
                      {ccount.get(p.id) ? <em><I.chat />{ccount.get(p.id)}</em> : null}
                    </span>
                  } />
                </div>
              ))}
            </div>
          )}
      </div>

      {drop.over && <div className="drop-veil"><b>Drop to add to {event.title}</b></div>}
      {can && (
        <div className="fab-wrap">
          <button className="fab" onClick={() => ctx.startUpload(event)}><I.plus width="18" height="18" /> Add photos</button>
        </div>
      )}
      {open && (
        <Lightbox
          ctx={ctx} photos={shown} startId={open} liked={liked} onLike={toggleLike}
          onClose={() => setOpen(null)}
          onHidden={(id) => { setPhotos((ps) => ps.map((x) => (x.id === id ? { ...x, hidden: true } : x))); }}
          onComment={(id, n) => setCcount((m) => new Map(m).set(id, n))}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------ lightbox */

function Lightbox({ ctx, photos, startId, liked, onLike, onClose, onHidden, onComment }) {
  const [i, setI] = useState(() => Math.max(0, photos.findIndex((p) => p.id === startId)));
  const p = photos[Math.min(i, photos.length - 1)];
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const touch = useRef(null);
  const owner = useRef(null);
  useEffect(() => { db.getOwner().then((o) => { owner.current = o; }); }, []);

  useEffect(() => {
    if (!p) return;
    setComments([]);
    db.listComments(p.id).then(setComments).catch(() => {});
  }, [p?.id]);

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
      if (e.key === 'ArrowRight') setI((n) => Math.min(photos.length - 1, n + 1));
    };
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [photos.length, onClose]);

  useEffect(() => {
    for (const j of [i - 1, i + 1]) { const q = photos[j]; if (q && !db.isVideoPhoto(q)) { const im = new Image(); im.src = db.mediaUrl(q, 'web'); } }
  }, [i, photos]);

  if (!p) return null;
  const video = db.isVideoPhoto(p);
  const who = ctx.people.get(p.owner);
  const mine = owner.current && p.owner === owner.current;
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }; };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    const fast = Date.now() - touch.current.t < 600;
    touch.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && fast) setI((n) => Math.max(0, Math.min(photos.length - 1, n + (dx < 0 ? 1 : -1))));
    else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    if (!ctx.profile?.displayName) { ctx.setSheet({ kind: 'name' }); return; }
    setBusy(true);
    try {
      const c = await db.addComment(p.id, ctx.profile.displayName, body);
      const next = [...comments, c];
      setComments(next); setBody(''); onComment(p.id, next.filter((x) => !x.hidden).length);
    } catch (ex) { ctx.toast(ex.message); } finally { setBusy(false); }
  };
  const share = async () => {
    const url = `${SITE.origin}${SITE.base}#/e/${ctx.events.find((e) => e.id === p.eventId)?.slug || ''}?p=${p.id}`;
    if (navigator.share) { try { await navigator.share({ title: 'M³ Vault', url }); } catch { /* cancelled */ } }
    else { await navigator.clipboard.writeText(url); ctx.toast('Link copied'); }
  };
  const hide = async () => {
    if (!window.confirm('Hide this from the vault? The file stays; only admins can bring it back.')) return;
    try { await db.updatePhoto(p.id, { hidden: true }, ctx.admin); onHidden(p.id); ctx.toast('Hidden'); onClose(); }
    catch (ex) { ctx.toast(ex.message); }
  };

  return (
    <div className="lb" role="dialog" aria-modal="true" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="lb-top">
        <button className="icon-btn" onClick={onClose} aria-label="Close"><I.x width="22" height="22" /></button>
        <span className="lb-count">{i + 1} / {photos.length}</span>
        <div className="lb-top-actions">
          <button className="icon-btn" onClick={share} aria-label="Share"><I.share width="20" height="20" /></button>
          <a className="icon-btn" href={db.mediaUrl(p, 'orig')} download target="_blank" rel="noopener" aria-label="Download original"><I.down width="20" height="20" /></a>
        </div>
      </div>
      <div className="lb-stage">
        {video
          ? <video className="vault-video" src={db.mediaUrl(p, 'orig')} poster={db.mediaUrl(p, 'web')} controls playsInline autoPlay />
          : <img src={db.mediaUrl(p, 'web')} alt={p.caption || ''} />}
        {i > 0 && <button className="lb-nav prev" onClick={() => setI(i - 1)} aria-label="Previous"><I.left width="22" height="22" /></button>}
        {i < photos.length - 1 && <button className="lb-nav next" onClick={() => setI(i + 1)} aria-label="Next"><I.right width="22" height="22" /></button>}
      </div>
      <div className="lb-panel">
        <div className="lb-meta">
          <span className="avatar sm">{(p.uploaderName || '?').slice(0, 2).toUpperCase()}</span>
          <div>
            <b>{p.uploaderName || 'Someone'}{who?.team ? ` · ${who.team}` : ''}</b>
            <small>{p.takenAt ? `Taken ${fmtWhen(p.takenAt)}` : `Added ${fmtWhen(p.createdAt)}`}{p.bytes ? ` · ${fmtBytes(p.bytes)}` : ''}</small>
          </div>
        </div>
        {p.caption && <p className="lb-cap">{p.caption}</p>}
        <div className="lb-actions">
          <button className={`pill ${liked.has(p.id) ? 'on' : ''}`} onClick={() => onLike(p)}><I.heart on={liked.has(p.id)} width="16" height="16" /> {p.likes || 'Love'}</button>
          {(mine || ctx.admin) && <button className="lb-action lb-delete" onClick={hide}><I.eye width="16" height="16" /> Hide</button>}
        </div>
        <div className="lb-comments">
          {comments.filter((c) => !c.hidden).map((c) => (
            <p className="cmt" key={c.id}><b>{c.author || 'Someone'}</b>{c.body}
              {(ctx.admin || c.owner === owner.current) && <button className="cmt-x" onClick={async () => { try { await db.hideComment(c.id, ctx.admin); const next = comments.map((x) => (x.id === c.id ? { ...x, hidden: true } : x)); setComments(next); onComment(p.id, next.filter((x) => !x.hidden).length); } catch (ex) { ctx.toast(ex.message); } }}>hide</button>}
            </p>
          ))}
          {!comments.length && <p className="fine">No comments yet.</p>}
        </div>
        <form className="lb-form" onSubmit={submit}>
          <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Say something" maxLength={500} />
          <button className="btn small" disabled={busy || !body.trim()}>Post</button>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- sheets */

function Sheet({ title, onClose, children, wide }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="sheet-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`sheet ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="sheet-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><I.x width="20" height="20" /></button></div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

function NameSheet({ ctx, onDone, onClose }) {
  const p = ctx.profile || {};
  const [name, setName] = useState(p.displayName || '');
  const [team, setTeam] = useState(p.team || '');
  const [students, setStudents] = useState((p.students || []).join(', '));
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { setErr('Your name, please.'); return; }
    setBusy(true); setErr('');
    try {
      const saved = await db.saveProfile({ displayName: name, team, students: students.split(/[,\n]/), phone });
      onDone(saved);
    } catch (ex) { setErr(ex.message || 'Could not save.'); } finally { setBusy(false); }
  };
  return (
    <Sheet title={p.displayName ? 'Your details' : 'Who is this?'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <p className="lede">Once, on this phone. Your photos carry your name and your team.</p>
        <label className="field"><span>Your name</span><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Keisha J." autoFocus /></label>
        <label className="field"><span>Team name</span><input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Team Sharks" /><small>Whatever your group calls itself today. Spell it the same as your co-chaperone.</small></label>
        <label className="field"><span>Students in your group <i>optional</i></span><input value={students} onChange={(e) => setStudents(e.target.value)} placeholder="Amari, Zoe, Malik" /><small>First names, separated by commas.</small></label>
        <label className="field"><span>Mobile <i>optional</i></span><input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="404 555 0101" /><small>Only {VAULT.host} and the RCAP admin see this. It is for the "photos wanted" text and nothing else.</small></label>
        {err && <p className="err">{err}</p>}
        <button className="btn primary big" disabled={busy}>{busy ? 'Saving' : 'Save and continue'}</button>
      </form>
    </Sheet>
  );
}

function UploadSheet({ ctx, event: initial, initialFiles, onClose }) {
  const { events, today } = ctx;
  const choices = events.filter((e) => acceptsUploads(e, today));
  const [eventId, setEventId] = useState(initial?.id || choices[0]?.id || '');
  const event = events.find((e) => e.id === eventId);
  const [files, setFiles] = useState(initialFiles || []);
  const [caption, setCaption] = useState('');
  const [prog, setProg] = useState(null);
  const [err, setErr] = useState('');
  const abort = useRef(null);
  const input = useRef(null);
  const drop = useDropTarget((fs) => setFiles((cur) => [...cur, ...fs].slice(0, MAX_BATCH)));

  const pick = (e) => { setFiles((cur) => [...cur, ...Array.from(e.target.files || [])].slice(0, MAX_BATCH)); e.target.value = ''; };
  const start = async () => {
    if (!event || !files.length) return;
    setErr(''); abort.current = new AbortController();
    try {
      const s = await uploadBatch(files, { event, profile: ctx.profile, caption, onProgress: setProg, signal: abort.current.signal });
      if (s.done.length) ctx.toast(`${plural(s.done.length, 'photo')} added to ${event.title}`);
      ctx.bump();
      if (!s.failed.length) { onClose(); go(`#/e/${event.slug}`); }
    } catch (ex) { setErr(ex.message || 'Upload failed.'); setProg(null); }
  };
  const pct = prog ? Math.round(((prog.bytesSent || 0) / Math.max(1, prog.bytesTotal)) * 100) : 0;

  return (
    <Sheet title={`Add to ${event?.title || 'the vault'}`} onClose={() => { abort.current?.abort(); onClose(); }}>
      {!prog ? (
        <div className="stack" {...drop.handlers}>
          {choices.length > 1 && (
            <label className="field"><span>Album</span>
              <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
                {choices.map((e) => <option key={e.id} value={e.id}>{e.title}{e.startsAt ? ` · ${fmtTime(e.startsAt)}` : ''}</option>)}
              </select>
            </label>
          )}
          <input ref={input} type="file" accept="image/*,video/*" multiple hidden onChange={pick} />
          <button className={`drop-zone ${drop.over ? 'over' : ''}`} onClick={() => input.current?.click()}>
            <b>{files.length ? `${plural(files.length, 'file')} picked` : 'Choose photos or videos'}</b>
            <span>{files.length ? 'Tap to add more' : `Up to ${MAX_BATCH} at a time. On a computer, drop a folder here.`}</span>
          </button>
          {files.length > 0 && (
            <div className="pick-preview">
              {files.slice(0, 8).map((f, i) => <PickThumb key={`${f.name}-${i}`} file={f} />)}
              {files.length > 8 && <span className="pick-more">+{files.length - 8}</span>}
            </div>
          )}
          <div className="field">
            <span>What is it? <i>optional, applies to this batch</i></span>
            <div className="chips wrap">
              {SHOT_LIST.map((s) => <button key={s} type="button" className={caption === s ? 'on' : ''} onClick={() => setCaption(caption === s ? '' : s)}>{s}</button>)}
            </div>
            <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Or type your own" maxLength={280} />
          </div>
          {err && <p className="err">{err}</p>}
          <button className="btn primary big" onClick={start} disabled={!files.length || !event}>Add {files.length ? plural(files.length, 'file') : 'photos'}</button>
          <p className="fine">Originals are kept full size. Nothing is ever deleted; you can hide your own uploads from Me.</p>
        </div>
      ) : (
        <div className="stack">
          <p className="lede">{prog.finished ? 'Done.' : prog.prepared < prog.total ? `Getting ready ${prog.prepared}/${prog.total}` : `Uploading ${prog.uploaded}/${prog.total}`}</p>
          <div className="bar"><i style={{ width: `${prog.finished ? 100 : pct}%` }} /></div>
          {prog.current && !prog.finished && <p className="fine">{prog.current}</p>}
          {prog.failed.length > 0 && (
            <div className="failed"><b>{plural(prog.failed.length, 'file')} did not make it</b>
              <ul>{prog.failed.map((f, i) => <li key={i}>{f.name} <span>{f.error}</span></li>)}</ul>
            </div>
          )}
          {err && <p className="err">{err}</p>}
          {prog.finished
            ? <button className="btn primary" onClick={() => { onClose(); go(`#/e/${event.slug}`); }}>See the album</button>
            : <button className="btn ghost" onClick={() => abort.current?.abort()}>Stop</button>}
        </div>
      )}
    </Sheet>
  );
}

function PickThumb({ file }) {
  const [url, setUrl] = useState('');
  useEffect(() => { const u = URL.createObjectURL(file); setUrl(u); return () => URL.revokeObjectURL(u); }, [file]);
  return <span className="pick-thumb">{url && (isVideo(file) ? <span className="picked-video">▶</span> : <img src={url} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />)}</span>;
}

function DownloadSheet({ event, photos, onClose }) {
  const [which, setWhich] = useState('web');
  const [prog, setProg] = useState(null);
  const [err, setErr] = useState('');
  const est = (w) => photos.reduce((n, p) => n + (w === 'orig' || db.isVideoPhoto(p) ? (p.bytes || 3_500_000) : 350_000), 0);
  const start = async () => {
    setErr('');
    try {
      const pad = String(photos.length).length;
      const entries = photos.map((p, i) => {
        const v = db.isVideoPhoto(p);
        const ext = which === 'orig' || v ? (p.key.split('.').pop() || 'jpg') : 'jpg';
        const who = (p.uploaderName || 'm3').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        const when = (p.takenAt || p.createdAt).slice(11, 16).replace(':', '');
        return {
          name: `${event.slug}/${String(i + 1).padStart(pad, '0')}-${when}-${who}.${ext}`,
          date: p.takenAt || p.createdAt,
          open: async () => { const r = await fetch(db.mediaUrl(p, v ? 'orig' : which)); if (!r.ok) throw new Error(`Could not fetch ${p.id}`); return r; },
        };
      });
      const how = await saveStream(zipStream(entries, { onProgress: setProg }), `m3-2028-${event.slug}${which === 'orig' ? '-originals' : ''}.zip`);
      if (how === 'cancelled') setProg(null);
    } catch (ex) { setErr(ex.message || 'Download failed.'); setProg(null); }
  };
  return (
    <Sheet title={`Download · ${event.title}`} onClose={onClose}>
      {!prog ? (
        <div className="stack">
          <p className="lede">{plural(photos.length, 'file')} as one zip, in order.</p>
          <div className="choice">
            <button className={which === 'web' ? 'on' : ''} onClick={() => setWhich('web')}><b>Web size</b><span>For screens. Videos stay original. ~{fmtBytes(est('web'))}</span></button>
            <button className={which === 'orig' ? 'on' : ''} onClick={() => setWhich('orig')}><b>Originals</b><span>Exactly what was uploaded. ~{fmtBytes(est('orig'))}</span></button>
          </div>
          {which === 'orig' && est('orig') > 1.2e9 && <p className="fine">Big one. Use a computer with Chrome, which streams straight to disk.</p>}
          {err && <p className="err">{err}</p>}
          <button className="btn primary" onClick={start}>Start download</button>
        </div>
      ) : (
        <div className="stack">
          <div className="bar"><i style={{ width: `${Math.round((prog.files / photos.length) * 100)}%` }} /></div>
          <p className="lede">{prog.done ? 'Done.' : `${prog.files} of ${photos.length} · ${fmtBytes(prog.bytes)}`}</p>
          {prog.done && <button className="btn primary" onClick={onClose}>Close</button>}
        </div>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------ top + me */

function TopPage({ ctx }) {
  const [photos, setPhotos] = useState([]);
  const [open, setOpen] = useState(null);
  const [liked, setLiked] = useState(new Set());
  useEffect(() => { db.listTopPhotos().then(async (ps) => { setPhotos(ps); setLiked(await db.myLikes(ps.map((p) => p.id))); }).catch(() => {}); }, []);
  const toggleLike = async (p) => {
    const on = liked.has(p.id);
    setLiked((s) => { const n = new Set(s); on ? n.delete(p.id) : n.add(p.id); return n; });
    setPhotos((ps) => ps.map((x) => (x.id === p.id ? { ...x, likes: Math.max(0, x.likes + (on ? -1 : 1)) } : x)));
    try { on ? await db.unlike(p.id) : await db.like(p.id); } catch (e) { ctx.toast(e.message); }
  };
  return (
    <main className="shell page">
      <div className="sec-head"><span className="eyebrow">Most loved</span><h1 className="page-title">Favorites</h1><p>Ranked live by loves across the whole day.</p></div>
      {!photos.length ? <p className="empty">No loves yet. Tap a heart.</p> : (
        <div className="grid">
          {photos.map((p, i) => (
            <div className="tile-wrap" key={p.id}>
              <Thumb p={p} onClick={() => setOpen(p.id)} meta={<><span className="rank">{i + 1}</span><span className="tile-meta"><em className={liked.has(p.id) ? 'on' : ''}><I.heart on={liked.has(p.id)} />{p.likes}</em></span></>} />
            </div>
          ))}
        </div>
      )}
      {open && <Lightbox ctx={ctx} photos={photos} startId={open} liked={liked} onLike={toggleLike} onClose={() => setOpen(null)} onHidden={(id) => setPhotos((ps) => ps.filter((x) => x.id !== id))} onComment={() => {}} />}
    </main>
  );
}

function MePage({ ctx }) {
  const [photos, setPhotos] = useState([]);
  const [open, setOpen] = useState(null);
  const p = ctx.profile;
  useEffect(() => { db.listMyPhotos().then(setPhotos).catch(() => {}); }, [ctx.totals.photos]);
  const byId = new Map(ctx.events.map((e) => [e.id, e]));
  return (
    <main className="shell page">
      <div className="me-head">
        <span className="avatar lg">{(p?.displayName || '?').slice(0, 2).toUpperCase()}</span>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{p?.displayName || 'You'}</h1>
          <p>{p?.team || 'No team yet'}{p?.students?.length ? ` · ${p.students.join(', ')}` : ''}</p>
          <button className="btn small ghost" onClick={() => ctx.setSheet({ kind: 'name' })}>Edit details</button>
        </div>
      </div>
      <p className="fine" style={{ marginBottom: 18 }}>Your uploads from this phone. Open one to hide it. Switch phones and you are a new person here; your old photos keep your name.</p>
      {!photos.length ? <p className="empty">Nothing yet.</p> : (
        <div className="grid">
          {photos.map((q) => <div className="tile-wrap" key={q.id}><Thumb p={q} onClick={() => setOpen(q.id)} meta={<span className="tile-meta"><em>{byId.get(q.eventId)?.title}</em></span>} /></div>)}
        </div>
      )}
      {open && <Lightbox ctx={ctx} photos={photos} startId={open} liked={new Set()} onLike={() => {}} onClose={() => setOpen(null)} onHidden={(id) => setPhotos((ps) => ps.filter((x) => x.id !== id))} onComment={() => {}} />}
    </main>
  );
}

/* --------------------------------------------------------------- admin */

function AdminPage({ ctx }) {
  const { admin, setAdmin, events, requests } = ctx;
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(null);   // {kind:'event'|'request', row}
  const [phones, setPhones] = useState(null);
  const [teams, setTeams] = useState([]);
  const [nudge, setNudge] = useState('');
  useEffect(() => { if (admin) db.listTeams().then(setTeams).catch(() => {}); }, [admin, ctx.totals.photos]);

  const login = async (e) => {
    e.preventDefault();
    if (await db.checkPass(pass)) { setAdmin(pass); db.rememberPass(pass); setErr(''); }
    else setErr('Wrong passcode.');
  };
  if (!admin) {
    return (
      <main className="shell page"><div className="narrow-form stack">
        <div className="sec-head"><span className="eyebrow">Admin</span><h1 className="page-title">Passcode</h1></div>
        <form className="stack" onSubmit={login}>
          <label className="field"><span>Passcode</span><input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus /></label>
          {err && <p className="err">{err}</p>}
          <button className="btn primary">Open the back office</button>
        </form>
      </div></main>
    );
  }
  const byId = new Map(events.map((e) => [e.id, e]));
  const makeNudge = (r) => {
    const ev = byId.get(r.eventId);
    const link = `${SITE.origin}${SITE.base}e/${ev.slug}`;
    const count = ev.photoCount ? `${ev.photoCount} in so far from ${plural(ev.contributorCount, 'chaperone')}.` : 'Nothing in yet.';
    setNudge(`M³ chaperones: ${ev.title} photos wanted${r.dueOn ? ` by ${fmtDate(r.dueOn, { weekday: 'long' })}` : ''}. ${count} Add yours here: ${link}`);
  };

  return (
    <main className="shell page admin">
      <div className="sec-head"><span className="eyebrow">Admin</span><h1 className="page-title">Back office</h1>
        <p>Nothing here deletes. Hide, move, open and close asks. <button className="link" onClick={() => { setAdmin(''); db.rememberPass(''); }}>Forget passcode on this phone</button></p></div>

      <section className="adm-sec">
        <div className="adm-head"><h2>Albums</h2><button className="btn small primary" onClick={() => setEditing({ kind: 'event', row: { kind: 'moment', startsOn: DAY.date } })}>New album</button></div>
        <table className="tbl"><thead><tr><th>Time</th><th>Title</th><th>Photos</th><th></th></tr></thead><tbody>
          {events.map((e) => (
            <tr key={e.id} className={e.hidden ? 'off' : ''}>
              <td>{e.startsAt ? fmtTime(e.startsAt) : 'Any'}</td>
              <td><a href={`#/e/${e.slug}`}>{e.title}</a>{e.hidden ? ' (hidden)' : ''}</td>
              <td>{e.photoCount}</td>
              <td className="acts"><button className="link" onClick={() => setEditing({ kind: 'event', row: e })}>Edit</button></td>
            </tr>
          ))}
        </tbody></table>
      </section>

      <section className="adm-sec">
        <div className="adm-head"><h2>Photos wanted</h2><button className="btn small primary" onClick={() => setEditing({ kind: 'request', row: { open: true, goal: 40, eventId: events[0]?.id } })}>New ask</button></div>
        <table className="tbl"><thead><tr><th>Album</th><th>Ask</th><th>Goal</th><th>Due</th><th></th></tr></thead><tbody>
          {requests.map((r) => (
            <tr key={r.id} className={r.open ? '' : 'off'}>
              <td>{byId.get(r.eventId)?.title}</td><td className="wrap">{r.message}</td><td>{byId.get(r.eventId)?.photoCount} / {r.goal}</td><td>{fmtDate(r.dueOn)}</td>
              <td className="acts">
                <button className="link" onClick={() => setEditing({ kind: 'request', row: r })}>Edit</button>
                <button className="link" onClick={() => makeNudge(r)}>Nudge text</button>
                <button className="link" onClick={async () => { await db.saveRequest({ ...r, open: !r.open }, r.id, admin); ctx.bump(); }}>{r.open ? 'Close' : 'Reopen'}</button>
              </td>
            </tr>
          ))}
        </tbody></table>
        {nudge && <div className="nudge"><textarea rows={4} value={nudge} onChange={(e) => setNudge(e.target.value)} /><div className="row"><button className="btn small primary" onClick={async () => { await navigator.clipboard.writeText(nudge); ctx.toast('Copied for Quo'); }}>Copy for Quo</button><button className="btn small ghost" onClick={() => setNudge('')}>Done</button></div></div>}
      </section>

      <section className="adm-sec">
        <div className="adm-head"><h2>Teams</h2></div>
        {!teams.length ? <p className="fine">No teams yet. They appear as chaperones add their names.</p> : (
          <table className="tbl"><thead><tr><th>Team</th><th>Chaperones</th><th>Students</th><th>Photos</th></tr></thead><tbody>
            {teams.map((t) => <tr key={t.team}><td><b>{t.team}</b></td><td>{t.chaperones.join(', ')}</td><td className="wrap">{t.students.join(', ')}</td><td>{t.photoCount}</td></tr>)}
          </tbody></table>
        )}
      </section>

      <section className="adm-sec">
        <div className="adm-head"><h2>Phone numbers</h2><button className="btn small ghost" onClick={async () => setPhones(await db.listPhonesForAdmin(admin))}>Show numbers</button></div>
        {phones && (phones.length
          ? <div className="phones"><textarea rows={Math.min(10, phones.length + 1)} readOnly value={phones.map((p) => `${p.display_name}${p.team ? ` (${p.team})` : ''}: ${p.phone}`).join('\n')} /><p className="fine">Only the people who chose to give one.</p></div>
          : <p className="fine">Nobody has added a number yet.</p>)}
      </section>

      {editing?.kind === 'event' && <EventForm row={editing.row} pass={admin} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); ctx.bump(); }} />}
      {editing?.kind === 'request' && <RequestForm row={editing.row} events={events} pass={admin} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); ctx.bump(); }} />}
    </main>
  );
}

function EventForm({ row, pass, onClose, onSaved }) {
  const [f, setF] = useState({ slug: row.slug || '', title: row.title || '', blurb: row.blurb || '', kind: row.kind || 'moment', startsOn: row.startsOn || DAY.date, startsAt: row.startsAt ? row.startsAt.slice(0, 5) : '', ongoing: !!row.ongoing, hidden: !!row.hidden });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try { await db.saveEvent({ ...f, slug: f.slug || f.title }, row.id || null, pass); onSaved(); } catch (ex) { setErr(ex.message); }
  };
  return (
    <Sheet title={row.id ? 'Edit album' : 'New album'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field"><span>Title</span><input value={f.title} onChange={set('title')} required /></label>
        <label className="field"><span>Slug <i>in the link</i></span><input value={f.slug} onChange={set('slug')} placeholder="from the title if blank" /></label>
        <label className="field"><span>Blurb</span><textarea rows={3} value={f.blurb} onChange={set('blurb')} /></label>
        <div className="row">
          <label className="field"><span>Date</span><input type="date" value={f.startsOn} onChange={set('startsOn')} required /></label>
          <label className="field"><span>Time</span><input type="time" value={f.startsAt} onChange={set('startsAt')} /></label>
        </div>
        <div className="row checks">
          <label><input type="checkbox" checked={f.kind === 'everyday'} onChange={(e) => setF({ ...f, kind: e.target.checked ? 'everyday' : 'moment', ongoing: e.target.checked })} /> Any time album</label>
          <label><input type="checkbox" checked={f.hidden} onChange={set('hidden')} /> Hidden</label>
        </div>
        {err && <p className="err">{err}</p>}
        <button className="btn primary">Save</button>
      </form>
    </Sheet>
  );
}

function RequestForm({ row, events, pass, onClose, onSaved }) {
  const [f, setF] = useState({ eventId: row.eventId || events[0]?.id, message: row.message || '', goal: row.goal || 40, dueOn: row.dueOn || '', open: row.open !== false });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e) => { e.preventDefault(); try { await db.saveRequest(f, row.id || null, pass); onSaved(); } catch (ex) { setErr(ex.message); } };
  return (
    <Sheet title={row.id ? 'Edit ask' : 'New ask'} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        <label className="field"><span>Album</span><select value={f.eventId} onChange={set('eventId')}>{events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
        <label className="field"><span>One line</span><input value={f.message} onChange={set('message')} placeholder="Every team, every mission." /></label>
        <div className="row">
          <label className="field"><span>Goal</span><input type="number" min={1} value={f.goal} onChange={set('goal')} /></label>
          <label className="field"><span>Due</span><input type="date" value={f.dueOn} onChange={set('dueOn')} /></label>
        </div>
        <div className="row checks"><label><input type="checkbox" checked={f.open} onChange={set('open')} /> Open</label></div>
        {err && <p className="err">{err}</p>}
        <button className="btn primary">Save</button>
      </form>
    </Sheet>
  );
}
