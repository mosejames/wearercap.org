import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Heart, ArrowUpRight, X, Plane, Sparkles, Copy, ChevronLeft, ChevronRight, Download, Check, Trash2, Images } from 'lucide-react';
import { DAYS, VAULT, MAX_BATCH, DESTINATIONS, chapterFor, basePath, ideasFor, tripToday } from './config.js';
import * as db from './data.js';
import TripMap from './TripMap.jsx';
import { uploadBatch } from './upload.js';

function Dialog({ title, close, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const before = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => { dialog.close(); before?.focus?.(); };
  }, []);
  return <dialog ref={ref} className="l-dialog" onCancel={close} onClick={(event) => { if (event.target === ref.current) close(); }}>
    <button className="l-close" aria-label="Close" onClick={close}><X size={22} /></button>
    <h2>{title}</h2>{children}
  </dialog>;
}
export default function App() {
  const [events, setEvents] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [profile, setProfile] = useState(db.localProfile);
  const [album, setAlbum] = useState('all');
  const [group, setGroup] = useState('');
  const [mine, setMine] = useState(false);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const [owner, setOwner] = useState('');
  const [admin, setAdmin] = useState('');
  const [ideaHidden, setIdeaHidden] = useState(() => { try { return sessionStorage.getItem('london-idea-hidden') === 'yes'; } catch { return false; } });
  const [idea, setIdea] = useState(null);
  const [hash, setHash] = useState(window.location.hash);
  async function refresh() {
    try {
      const [albums, images] = await Promise.all([db.listEvents(), db.listPhotos()]);
      setEvents(albums); setPhotos(images); setError('');
    } catch (e) { setError(e.message || 'The photos could not load. Please try again.'); }
    finally { setLoaded(true); }
  }
  useEffect(() => { refresh(); db.getOwner().then(setOwner); const timer = setInterval(refresh, 45000); return () => clearInterval(timer); }, []);
  useEffect(() => { const change = () => setHash(window.location.hash); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change); }, []);
  useEffect(() => { const match = hash.match(/^#\/e\/([a-z0-9-]+)/); if (match) setAlbum(match[1]); else if (!hash || hash === '#/') setAlbum('all'); }, [hash]);
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); } }, [notice]);
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const groups = useMemo(() => [...new Set(photos.map((p) => p.team).filter(Boolean))].sort(), [photos]);
  const shown = photos.filter((p) => (album === 'all' || byId.get(p.eventId)?.slug === album) && (!group || p.team === group) && (!mine || p.owner === owner));
  const contributors = [...new Set(photos.map((p) => p.uploaderName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const currentDay = DAYS.find((d) => d.date === tripToday()) || DAYS[0];
  const suggestionDay = DAYS.find((d) => d.slug === album) || currentDay;
  const chapter = chapterFor(album);
  function pickAlbum(slug) { setAlbum(slug); window.location.hash = slug === 'all' ? '#/' : `#/e/${slug}`; }
  function upload() { setModal({ kind: 'upload' }); }
  function myUploads() { setMine(true); setGroup(''); pickAlbum('all'); setModal(null); document.getElementById('memories')?.scrollIntoView({ behavior: 'smooth' }); }
  async function share() {
    const url = `${window.location.origin}${basePath()}${album === 'all' ? '' : `#/e/${album}`}`;
    try {
      if (navigator.share) await navigator.share({ title: VAULT.name, text: 'A little window into their adventure. Thank you for every moment you share.', url });
      else { await navigator.clipboard.writeText(url); setNotice('Trip link copied.'); }
    } catch (e) { if (e.name !== 'AbortError') setNotice('Could not share the link. Please copy it from your address bar.'); }
  }
  return <div className="london" data-city={chapter.city}>
    <header className="l-top"><a href="#/" onClick={() => { setMine(false); pickAlbum('all'); }} className="l-brand"><img src="/london/ron-clark-academy.png" alt="The Ron Clark Academy" width="520" height="120" /><span>CLASS OF 2028<small>LONDON + PARIS</small></span></a><div className="l-top-actions"><button className="l-text l-my-uploads" onClick={myUploads}><Images size={16} /> My uploads</button><button className="l-button" onClick={upload}><Camera size={16} /> Add photos</button></div></header>
    <main>
      <section className="l-hero">
        <div className="l-hero-copy"><p className="l-eyebrow"><span /> OCTOBER 11–17, 2026 · LONDON + PARIS</p><h1>A Class of 2028<br />Takes <em>London.</em></h1><p className="l-intro">Your photos. Their adventure.<br className="l-desktop" /> A postcard home.</p><p className="l-description">A few favorites from today? Add them here for the families cheering from home.</p><div className="l-hero-actions"><button className="l-button l-large" onClick={upload}><Camera size={20} /> Add photos <ArrowUpRight size={18} /></button><a href="#memories" className="l-text">See the postcards <ArrowUpRight size={17} /></a></div><p className="l-small">Choose photos, tap share, and you’re done. Whenever it fits.</p></div>
        <div className="l-art l-photo-art"><div className="l-stamp">{chapter.route}<br /><span>CLASS OF ’28</span></div><figure className="l-postcard"><img className="l-destination-photo" src={chapter.photo.image} alt={chapter.photo.alt} fetchPriority="high" width="1000" height="800" /><figcaption className="l-postcard-caption">{chapter.greeting}<span>{chapter.place} · destination photograph</span></figcaption><a className="l-photo-credit" href={chapter.photo.source} target="_blank" rel="noreferrer">Photo: {chapter.photo.credit}</a></figure><div className="l-ticket"><Plane size={22} /><span>{chapter.label.toUpperCase()}<small>{chapter.mood}</small></span></div></div>
      </section>
      <TripMap chapter={chapter} pickAlbum={pickAlbum} />
      <section className="l-thanks"><Heart size={24} /><div><h2>To our chaperones: thank you.</h2><p>You’re giving our children the world. When a photo fits into your day, it brings a little of that wonder home to us. Being there with them is already more than enough.</p></div></section>
      <section className="l-daily-chapter"><div><p className="l-eyebrow">{chapter.label.toUpperCase()} · FROM MR. CLARK’S TRIP GUIDE</p><h2>{chapter.day.title === 'The whole adventure' ? 'A new place to wake up to.' : chapter.day.title}</h2><p>{chapter.day.blurb}</p><small>The scenery follows the guide as each new day begins. The moments below are theirs to share.</small></div><button className="l-text" onClick={() => setIdea(chapter.day.slug)}><Sparkles size={17} /> A little inspiration for this chapter <ArrowUpRight size={16} /></button></section>
      <section className="l-memories" id="memories"><div className="l-section-head"><div><p className="l-eyebrow">THE STORY, TOGETHER</p><h2>{mine ? 'Your postcards home' : 'Postcards from their adventure'}</h2></div><span className="l-total">{photos.length} shared {photos.length === 1 ? 'moment' : 'moments'} <Heart size={15} /></span></div>
        <div className="l-albums" aria-label="Trip albums"><button className={album === 'all' ? 'active' : ''} onClick={() => pickAlbum('all')}>The whole trip</button>{DAYS.map((d) => <button key={d.slug} className={album === d.slug ? 'active' : ''} onClick={() => pickAlbum(d.slug)}><img src={chapterFor(d.slug, d.date || '2026-10-09').photo.thumb} alt="" loading="lazy" width="180" height="100" /><span>{d.date && <small>{d.label}</small>}{d.title}</span></button>)}</div>
        {album !== 'all' && <p className="l-album-description">{DAYS.find((d) => d.slug === album)?.blurb}</p>}
        {!ideaHidden && <aside className="l-idea"><Sparkles size={21} /><div><b>A little inspiration, if you’d like</b><p>{ideasFor(suggestionDay.slug)[0]}</p><button className="l-text" onClick={() => setIdea(suggestionDay.slug)}>More ideas <ArrowUpRight size={14} /></button></div><button className="l-dismiss" aria-label="Dismiss photo ideas for this visit" onClick={() => { setIdeaHidden(true); try { sessionStorage.setItem('london-idea-hidden', 'yes'); } catch { /* private mode */ } }}><X size={17} /></button></aside>}
        <div className="l-filter-row"><div className="l-gallery-switch"><button className={`l-text ${!mine ? 'selected' : ''}`} onClick={() => setMine(false)} aria-pressed={!mine}>Everyone’s photos</button><button className={`l-text ${mine ? 'selected' : ''}`} onClick={myUploads} aria-pressed={mine}><Images size={15} /> My uploads</button></div>{groups.length > 0 && <label>Browse by group <select value={group} onChange={(e) => setGroup(e.target.value)}><option value="">Everyone together</option>{groups.map((g) => <option key={g}>{g}</option>)}</select></label>}</div>
        {mine && <p className="l-small l-own-note">Your uploads from this device. Open a photo or tap Remove to take it out of the shared album.</p>}
        {error && <div className="l-error" role="alert">{error} <button onClick={refresh}>Try again</button></div>}
        {!loaded && <p role="status">Opening the trip album…</p>}
        {loaded && !shown.length && !error && <div className="l-empty"><div className="l-empty-icon"><Camera size={33} strokeWidth={1.4} /></div><h3>{mine ? 'Your postcards start here.' : photos.length ? 'A quiet page in the story, for now.' : 'The adventure is just beginning.'}</h3><p>{mine ? 'Photos you share from this device will appear here. You can remove any accidental uploads.' : photos.length ? 'Moments for this album or group will appear here when shared.' : 'When the first moments arrive, this will become a little window into their world.'}</p><button className="l-text" onClick={upload}>Have a moment to share? <ArrowUpRight size={16} /></button></div>}
        <div className="l-grid">{shown.map((p) => <article key={p.id} className="l-photo"><button onClick={() => setModal({ kind: 'photo', id: p.id })} aria-label={`Open ${p.caption || byId.get(p.eventId)?.title || 'trip photo'}`}><img src={db.mediaUrl(p, 'thumb')} alt={p.caption || 'A shared moment from the class trip'} loading="lazy" />{p.kind === 'video' && <span className="l-video">▶ Video</span>}</button><div><small>{byId.get(p.eventId)?.title}</small>{p.caption && <p>{p.caption}</p>}<span>With thanks to {p.uploaderName || 'a trip friend'}{p.team ? ` · ${p.team}` : ''}</span>{p.owner === owner && <button className="l-text l-remove" aria-label={`Remove ${p.caption || 'your photo'} from album`} onClick={() => setModal({ kind: 'photo', id: p.id, remove: true })}><Trash2 size={14} /> Remove</button>}</div></article>)}</div>
        <button className="l-text l-ideas-link" onClick={() => setIdea(suggestionDay.slug)}><Sparkles size={16} /> A few optional photo ideas</button>
      </section>
      {contributors.length > 0 && <section className="l-gratitude"><p className="l-eyebrow">MANY EYES. ONE ADVENTURE.</p><h2>Look what we’re making together.</h2><p>With love and thanks to {contributors.join(', ')} and every adult caring for our children along the way.</p><p className="l-small">Every perspective adds something special.</p></section>}
    </main><footer className="l-footer"><span>RON CLARK ACADEMY · CLASS OF 2028 <Heart size={13} /> LONDON + PARIS</span><p>For our families. With love from the road.</p><button className="l-text" onClick={share}><Copy size={14} /> Share trip link</button><button className="l-text" onClick={() => setModal({ kind: 'profile' })}>{profile ? 'Your sharing details' : 'Add your sharing details'}</button><button className="l-text" onClick={() => setModal({ kind: 'credits' })}>Destination photo credits</button><button className="l-text" onClick={() => setModal({ kind: 'admin' })}>{admin ? 'Admin active' : 'Admin'}</button></footer>
    {modal?.kind === 'upload' && <Upload events={events} initialAlbum={album === 'all' ? currentDay.slug : album} viewUploads={myUploads} profile={profile} setProfile={setProfile} close={() => setModal(null)} done={() => { refresh(); setNotice('Thank you. You brought a little of their adventure home.'); }} />}
    {modal?.kind === 'profile' && <Profile profile={profile} setProfile={setProfile} close={() => setModal(null)} />}
    {modal?.kind === 'photo' && <Photo key={modal.id} initialRemove={modal.remove} photo={photos.find((p) => p.id === modal.id)} photos={shown} owner={owner} admin={admin} close={() => setModal(null)} navigate={(id) => setModal({ kind: 'photo', id })} hidden={() => { setModal(null); refresh(); }} />}
    {modal?.kind === 'credits' && <Dialog title="The places in our story" close={() => setModal(null)}><p className="l-dialog-intro">Destination photographs set the scene. Family and chaperone contributions appear in the shared album.</p><ul className="l-credit-list">{Object.values(DESTINATIONS).map((p) => <li key={p.id}><a href={p.source} target="_blank" rel="noreferrer">{p.alt}<small>{p.credit}</small></a></li>)}</ul><a className="l-text" href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash photography license</a></Dialog>}
    {modal?.kind === 'admin' && <Admin close={() => setModal(null)} setAdmin={setAdmin} />}
    {idea && <Dialog title="A little inspiration" close={() => setIdea(null)}><p className="l-dialog-intro">Ideas for whenever a moment presents itself. Skip any or all of them. There’s no checklist to finish.</p><label className="l-field">Where are you in the adventure?<select value={idea} onChange={(e) => setIdea(e.target.value)}>{DAYS.map((d) => <option key={d.slug} value={d.slug}>{d.title}</option>)}</select></label><ul className="l-idea-list">{ideasFor(idea).map((s) => <li key={s}><Camera size={18} />{s}</li>)}</ul><p className="l-small">Enjoy the moment first. Photos can come later, and only where photography is welcome.</p><button className="l-button" onClick={() => setIdea(null)}>Lovely, thank you</button></Dialog>}
    {notice && <div className="l-toast" role="status"><Check size={18} />{notice}</div>}
  </div>;
}
function Profile({ profile, setProfile, close }) {
  const [name, setName] = useState(profile?.displayName || '');
  const [group, setGroup] = useState(profile?.team || '');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function save(e) { e.preventDefault(); setBusy(true); try { setProfile(await db.saveProfile({ displayName: name, team: group })); close(); } catch (e) { setError(e.message); } finally { setBusy(false); } }
  return <Dialog title="A name to say thank you to" close={close}><p className="l-dialog-intro">Your name travels with the moments you share. Your group is optional and can change as the day does.</p><form onSubmit={save}><label className="l-field">Your name<input required maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label><label className="l-field">Group, if you’d like<input maxLength={40} placeholder="Your assigned group, dinner group, or leave blank" value={group} onChange={(e) => setGroup(e.target.value)} /></label><p className="l-small">Saved on this device. Everyone shares in one class album.</p>{error && <p role="alert" className="l-error">{error}</p>}<button className="l-button" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save details'}</button></form></Dialog>;
}
function Upload({ events, initialAlbum, profile, setProfile, close, done, viewUploads }) {
  const [name, setName] = useState(profile?.displayName || ''); const [group, setGroup] = useState(profile?.team || '');
  const [slug, setSlug] = useState(initialAlbum === 'all' ? 'the-whole-adventure' : initialAlbum);
  const [caption, setCaption] = useState(''); const [files, setFiles] = useState([]); const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); const [error, setError] = useState(''); const [result, setResult] = useState(null);
  const [details, setDetails] = useState(false);
  const abort = useRef(null);
  useEffect(() => () => abort.current?.abort(), []);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(''); setResult(null); abort.current = new AbortController();
    try {
      const event = events.find((e) => e.slug === slug);
      if (!event) throw new Error('This album is still getting ready. Please try again shortly.');
      const saved = await db.saveProfile({ displayName: name, team: group }); setProfile(saved);
      const state = await uploadBatch(files, { event, profile: saved, caption, onProgress: setProgress, signal: abort.current.signal });
      setResult(state); if (state.done.length) done();
      if (!state.failed.length && state.done.length === files.length) { setFiles([]); setCaption(''); }
    } catch (e) { setError(e.message || 'The upload could not finish. Please try again.'); }
    finally { setBusy(false); }
  }
  return <Dialog title={result?.done.length ? 'Postcards delivered. Thank you!' : 'Add today’s photos'} close={() => { if (busy) abort.current?.abort(); close(); }}><p className="l-dialog-intro">A few favorites or the whole day. Share whenever you have a moment.</p><form onSubmit={submit}><fieldset disabled={busy}>
    <label className="l-file"><Camera size={29} /><b>{files.length ? `${files.length} selected. Tap to change` : 'Choose photos or videos'}</b><span>Up to 60 at once. Share in one tap below.</span><input aria-label="Choose photos or videos" type="file" accept="image/*,video/mp4,video/quicktime,video/webm,.heic,.heif" multiple onChange={(e) => { const selected = [...e.target.files]; setFiles(selected.slice(0, MAX_BATCH)); setResult(null); setError(selected.length > MAX_BATCH ? 'The first 60 files are selected. You can add the rest in another batch.' : ''); }} /></label>
    {!profile && <label className="l-field">Your name<input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="So we know who to thank" /></label>}
    <p className="l-upload-summary">{profile ? `Sharing as ${name} · ` : ''}{DAYS.find((d) => d.slug === slug)?.title}<button type="button" className="l-text" onClick={() => setDetails(!details)} aria-expanded={details}>{details ? 'Less detail' : 'Change or add a caption'}</button></p>
    {details && <div className="l-upload-details">{profile && <label className="l-field">Your name<input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>}<label className="l-field">Album<select value={slug} onChange={(e) => setSlug(e.target.value)}>{DAYS.map((d) => <option value={d.slug} key={d.slug}>{d.title}</option>)}</select></label><label className="l-field">Group (optional)<input maxLength={40} value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Or everyone together" /></label><label className="l-field">Caption (optional)<textarea rows={2} maxLength={280} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="A little about today" /></label><p className="l-small">Your caption goes with each selected photo.</p></div>}
    </fieldset>
    {busy && <div role="status" className="l-progress"><progress max={progress?.bytesTotal || 1} value={progress?.bytesSent || 0} /><span>{progress?.prepared < progress?.total ? 'Preparing your moments…' : 'Sharing your moments…'} {progress?.done?.length || 0} saved</span></div>}
    {error && <p role="alert" className="l-error">{error}</p>}
    {result && <div role="status"><p>{result.done.length} {result.done.length === 1 ? 'moment' : 'moments'} saved. Thank you for bringing the adventure home.</p>{result.failed.map((f, i) => <p className="l-error" key={i}>{f.name}: {f.error}</p>)}{result.failed.length > 0 && <p className="l-small">Choose only the files listed above to retry. Your saved moments are already in the album.</p>}</div>}
    <button className="l-button l-wide" disabled={busy || !files.length || !name.trim() || !events.length}>{busy ? 'Sharing…' : files.length ? `Share ${files.length} ${files.length === 1 ? 'photo or video' : 'photos & videos'}` : 'Share photos'}</button>{result?.done.length > 0 && <button type="button" className="l-text l-wide" onClick={viewUploads}>View my uploads <ArrowUpRight size={16} /></button>}<p className="l-small">Uploaded the wrong one? Remove it anytime in My uploads on this device.</p>{busy && <button type="button" className="l-text" onClick={() => abort.current?.abort()}>Stop upload</button>}
  </form></Dialog>;
}
function Photo({ photo, photos, owner, admin, close, navigate, hidden, initialRemove = false }) {
  const [error, setError] = useState(''); const [confirm, setConfirm] = useState(initialRemove); const [busy, setBusy] = useState(false);
  if (!photo) return null;
  const index = photos.findIndex((p) => p.id === photo.id);
  return <Dialog title={photo.caption || 'A postcard from the adventure'} close={close}><div className="l-viewer">{photo.kind === 'video' ? <video src={db.mediaUrl(photo, 'orig')} poster={db.mediaUrl(photo, 'thumb')} controls playsInline /> : <img src={db.mediaUrl(photo)} alt={photo.caption || 'A moment from the class trip'} />}</div><p>With thanks to <b>{photo.uploaderName || 'a trip friend'}</b>{photo.team ? ` · ${photo.team}` : ''}</p><div className="l-viewer-actions"><button className="l-text" disabled={index <= 0} onClick={() => { setConfirm(false); navigate(photos[index - 1].id); }}><ChevronLeft size={19} /> Previous</button><a className="l-text" href={db.mediaUrl(photo, 'orig')} target="_blank" rel="noreferrer"><Download size={17} /> Original</a><button className="l-text" disabled={index < 0 || index >= photos.length - 1} onClick={() => { setConfirm(false); navigate(photos[index + 1].id); }}>Next <ChevronRight size={19} /></button></div>{(photo.owner === owner || admin) && <div className="l-hide">{confirm ? <><p>Remove this photo from the shared album?</p><button className="l-button" disabled={busy} onClick={async () => { setBusy(true); try { await db.hidePhoto(photo.id, admin); hidden(); } catch (e) { setError(e.message); } finally { setBusy(false); } }}>Remove from album</button><button className="l-text" onClick={() => setConfirm(false)}>Keep it visible</button></> : <button className="l-text" onClick={() => setConfirm(true)}><Trash2 size={16} /> Remove from album</button>}</div>}{error && <p className="l-error" role="alert">{error}</p>}</Dialog>;
}
function Admin({ close, setAdmin }) {
  const [pass, setPass] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <Dialog title="Trip album admin" close={close}><form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { if (!await db.checkPass(pass)) throw new Error('That passphrase was not recognized.'); setAdmin(pass); close(); } catch (e) { setError(e.message); } finally { setBusy(false); } }}><label className="l-field">Admin passphrase<input type="password" value={pass} onChange={(e) => setPass(e.target.value)} /></label><p className="l-small">Admins can remove any photo from the shared album. Chaperones can remove their own uploads without an admin passphrase.</p>{error && <p className="l-error" role="alert">{error}</p>}<button className="l-button" disabled={busy || !pass}>Open admin</button></form></Dialog>;
}
