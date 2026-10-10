import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Heart, ArrowUpRight, X, Plane, Sparkles, Copy, ChevronLeft, ChevronRight, Download, Check, Trash2, Images, Globe2, Luggage, Landmark, Ticket, Castle, TrainFront, Crown, House } from 'lucide-react';
import { DAYS, PREP, VAULT, MAX_BATCH, DESTINATIONS, chapterFor, basePath, tripToday, INSPIRATIONS } from './config.js';
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
const ALBUM_COVERS = {
  'the-whole-adventure': [Globe2, 'ONE SHARED STORY'],
  'before-the-adventure': [Luggage, 'STARTING AT HOME'],
  'off-we-go': [Plane, 'ATL → LHR'],
  'hello-london': [Landmark, 'HELLO, LONDON'],
  'history-and-six': [Ticket, 'HISTORY + THEATRE'],
  'palaces-and-stones': [Castle, 'A LITTLE MAGIC'],
  'bonjour-paris': [TrainFront, 'LONDON → PARIS'],
  'a-day-to-remember': [Crown, 'A DAY IN FRANCE'],
  'home-with-stories': [House, 'CDG → ATL'],
};
function AlbumCover({ slug }) {
  const [Icon, label] = ALBUM_COVERS[slug];
  return <div className={`l-album-cover l-cover-${slug}`} aria-hidden="true"><Icon size={27} strokeWidth={1.3} /><i>{label}</i></div>;
}
export default function App() {
  const [events, setEvents] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [profile, setProfile] = useState(db.localProfile);
  const [album, setAlbum] = useState('all');
  const [collectionId, setCollectionId] = useState('');
  const [group, setGroup] = useState('');
  const [mine, setMine] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const [owner, setOwner] = useState('');
  const [admin, setAdmin] = useState('');
  const [ideaHidden, setIdeaHidden] = useState(() => { try { return sessionStorage.getItem('london-idea-hidden') === 'yes'; } catch { return false; } });
  const [idea, setIdea] = useState(null);
  const openedShare = useRef('');
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
  useEffect(() => { const match = hash.match(/^#\/e\/([a-z0-9-]+)/); const collection = hash.match(/^#\/c\/([a-z0-9-]+)$/); setCollectionId(collection && INSPIRATIONS.some((c) => c.id === collection[1]) ? collection[1] : ''); if (match) setAlbum(match[1]); else setAlbum('all'); }, [hash]);
  useEffect(() => {
    const match = hash.match(/^#\/e\/([a-z0-9-]+)\/p\/([0-9a-f-]{36})$/i);
    if (!match) { openedShare.current = ''; return; }
    if (!loaded || openedShare.current === hash) return;
    const photo = photos.find((p) => p.id === match[2] && events.find((e) => e.id === p.eventId)?.slug === match[1]);
    if (photo) { openedShare.current = hash; setMine(false); setGroup(''); setModal({kind:'photo',id:photo.id}); }
  }, [hash, loaded, photos, events]);
  useEffect(() => { if (notice) { const timer = setTimeout(() => setNotice(''), 4500); return () => clearTimeout(timer); } }, [notice]);
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const groups = useMemo(() => [...new Set(photos.map((p) => p.team).filter(Boolean))].sort(), [photos]);
  const collection = INSPIRATIONS.find((c) => c.id === collectionId);
  const shown = photos.filter((p) => (!collection || p.inspiration === collection.id) && (album === 'all' || byId.get(p.eventId)?.slug === album) && (!group || p.team === group) && (!mine || p.owner === owner));
  const currentDay = DAYS.find((d) => d.date === tripToday()) || (tripToday() < '2026-10-11' ? PREP : DAYS[0]);
  const familyPhotos = photos.filter((p) => byId.get(p.eventId)?.slug === PREP.slug);
  const suggestionDay = DAYS.find((d) => d.slug === album) || currentDay;
  const chapter = chapterFor(album);
  function categorizedPhoto(id, inspiration) { setPhotos((current) => current.map((photo) => photo.id === id ? {...photo, inspiration} : photo)); }
  function parentTools() { setOrganizing(true); setMine(false); setGroup(''); pickAlbum('all'); setModal(null); document.getElementById('memories')?.scrollIntoView({behavior:'smooth'}); }
  function thankedPhoto(id, thanked) { setPhotos((current) => current.map((photo) => photo.id === id ? {...photo, thanked} : photo)); }
  function pickAlbum(slug) { setCollectionId(''); setAlbum(slug); window.location.hash = slug === 'all' ? '#/' : `#/e/${slug}`; }
  function openCollection(id) { setIdea(null); setModal(null); setCollectionId(id); setAlbum('all'); setMine(false); setGroup(''); window.location.hash = `#/c/${id}`; document.getElementById('memories')?.scrollIntoView({behavior:'smooth'}); }
  function upload() {
    const targetAlbum = collection ? (collection.albums?.includes(currentDay.slug) ? currentDay.slug : collection.album) : undefined;
    setModal({ kind: 'upload', album: targetAlbum, inspiration: collection?.id || '', prompt: collection?.album === PREP.slug ? collection.hint : '' });
  }
  function uploadPrep(prompt = '') { setModal({ kind: 'upload', album: PREP.slug, prompt }); }
  function browsePrep() { setMine(false); setGroup(''); pickAlbum(PREP.slug); document.getElementById('memories')?.scrollIntoView({behavior:'smooth'}); }
  function myUploads() { setMine(true); setGroup(''); pickAlbum('all'); setModal(null); document.getElementById('memories')?.scrollIntoView({ behavior: 'smooth' }); }
  async function share() {
    const url = `${window.location.origin}${basePath()}${album === 'all' ? '' : `e/${album}`}`;
    try {
      if (navigator.share) await navigator.share({ title: VAULT.name, text: 'A little window into their adventure. Thank you for every moment you share.', url });
      else { await navigator.clipboard.writeText(url); setNotice('Trip link copied.'); }
    } catch (e) { if (e.name !== 'AbortError') setNotice('Could not share the link. Please copy it from your address bar.'); }
  }
  async function sharePhoto(photo) {
    const event = byId.get(photo.eventId);
    if (!event) return;
    const url = `${window.location.origin}${basePath()}e/${event.slug}/p/${photo.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${event.title} · Class of 2028`, url });
      else { await navigator.clipboard.writeText(url); setNotice('Photo link copied. Its preview will show this moment.'); }
    } catch (e) { if (e.name !== 'AbortError') setNotice('Could not share this photo. Please try again.'); }
  }
  return <div className="london" data-city={chapter.city}>
    <header className="l-top"><a href="#/" onClick={() => { setMine(false); pickAlbum('all'); }} className="l-brand"><img src="/london/ron-clark-academy.png" alt="The Ron Clark Academy" width="520" height="120" /><span>CLASS OF 2028<small>LONDON + PARIS</small></span></a><div className="l-top-actions"><button className="l-text l-my-uploads" onClick={myUploads}><Images size={16} /> My uploads</button><button className="l-button" onClick={upload}><Camera size={16} /> Share a moment</button></div></header>
    <main>
      <section className="l-hero">
        <div className="l-hero-copy"><p className="l-eyebrow"><span /> OCTOBER 11–17, 2026 · LONDON + PARIS</p><h1>RCA 2028<br />Takes <em>London.</em></h1><p className="l-intro">A little window into their adventure.</p><p className="l-description">Already taking a photo? There’s a place for it here, whenever sharing fits.</p><div className="l-hero-actions"><button className="l-button l-large" onClick={upload}><Camera size={20} /> Share a moment <ArrowUpRight size={18} /></button><a href="#memories" className="l-text">See the postcards <ArrowUpRight size={17} /></a></div><p className="l-small">Choose photos, tap share, and you’re done. Whenever it fits.</p></div>
        <div className="l-art l-photo-art"><div className="l-stamp">{chapter.route}<br /><span>CLASS OF ’28</span></div><figure className="l-postcard"><img className="l-destination-photo" src={chapter.photo.image} alt={chapter.photo.alt} fetchPriority="high" width="1000" height="800" /><figcaption className="l-postcard-caption">{chapter.greeting}<span>{chapter.place} · destination photograph</span></figcaption><a className="l-photo-credit" href={chapter.photo.source} target="_blank" rel="noreferrer">Photo: {chapter.photo.credit}</a></figure><div className="l-ticket"><Plane size={22} /><span>{chapter.label.toUpperCase()}<small>{chapter.mood}</small></span></div></div>
      </section>
      <section className="l-prep" id="before-the-adventure" aria-labelledby="family-postcards-title"><div className="l-prep-heading"><div><p className="l-eyebrow"><Heart size={14} /> BEFORE THE ADVENTURE</p><h2 id="family-postcards-title">First postcards, from home.</h2><p>Packing, countdowns, big dreams. Share a photo or short video of your family getting ready.</p></div><div className="l-prep-actions"><button className="l-button" onClick={() => uploadPrep()}><Camera size={18} /> Add a family postcard</button><div className="l-prep-links"><button className="l-text" onClick={() => setIdea(PREP.slug)}>Need an idea?</button><button className="l-text" onClick={browsePrep}>View postcards{familyPhotos.length ? ` (${familyPhotos.length})` : ''} <ArrowUpRight size={14} /></button></div></div></div></section>
      <TripMap chapter={chapter} pickAlbum={pickAlbum} />
      <section className="l-daily-chapter"><div><p className="l-eyebrow">{chapter.label.toUpperCase()} · {chapter.day.slug === PREP.slug ? 'OUR FAMILIES START THE STORY' : 'RCA 2028 TAKES LONDON'}</p><h2>{chapter.day.title === 'The whole adventure' ? 'A new place to wake up to.' : chapter.day.title}</h2><p>{chapter.day.blurb}</p><small>{chapter.day.slug === PREP.slug ? 'The excitement at home is part of the adventure, too.' : 'A new day, a new part of the adventure. The moments below are theirs to share.'}</small></div><button className="l-text" onClick={() => setIdea(chapter.day.slug)}><Sparkles size={17} /> A little inspiration for this chapter <ArrowUpRight size={16} /></button></section>
      <section className="l-memories" id="memories">{organizing && <aside className="l-parent-tools"><div><b>A little help from home</b><p>Parents can add collection labels after photos arrive. Contributors can simply share their moments.</p></div><button className="l-text" onClick={() => setOrganizing(false)}>Done organizing</button></aside>}<div className="l-section-head"><div><p className="l-eyebrow">THE STORY, TOGETHER</p><h2>{mine ? 'Your postcards home' : collection ? collection.title : 'Postcards from their adventure'}</h2></div><span className="l-total">{collection ? shown.length : photos.length} shared {(collection ? shown.length : photos.length) === 1 ? 'moment' : 'moments'} <Heart size={15} /></span></div>
        {!collection && <div className="l-albums" aria-label="Trip albums"><button className={album === 'all' ? 'active' : ''} onClick={() => pickAlbum('all')}>The whole trip</button>{DAYS.map((d) => <button key={d.slug} className={album === d.slug ? 'active' : ''} onClick={() => pickAlbum(d.slug)}><AlbumCover slug={d.slug} /><span>{d.date && <small>{d.label}</small>}{d.title}</span></button>)}</div>}
        {collection && <div className="l-collection-heading"><p>{collection.hint}<small>One shared collection. Add a photo or video whenever it fits.</small></p><div><button className="l-button" onClick={upload}><Camera size={17} /> Add a moment here</button><button className="l-text" onClick={() => pickAlbum('all')}>Back to all postcards</button></div></div>}
        {album !== 'all' && <p className="l-album-description">{DAYS.find((d) => d.slug === album)?.blurb}</p>}
        {!ideaHidden && !collection && <aside className="l-idea l-inspiration-strip"><Sparkles size={19} /><div><b>A little inspiration, if you’d like</b><div className="l-inspiration-chips">{INSPIRATIONS.filter((c) => c.album === suggestionDay.slug || c.albums?.includes(suggestionDay.slug)).slice(0, 3).map((c) => <button className="l-text" key={c.id} onClick={() => openCollection(c.id)}>{c.title} <ArrowUpRight size={13} /></button>)}<button className="l-text" onClick={() => setIdea(suggestionDay.slug)}>More ideas <ArrowUpRight size={13} /></button></div></div><button className="l-dismiss" aria-label="Dismiss photo ideas for this visit" onClick={() => { setIdeaHidden(true); try { sessionStorage.setItem('london-idea-hidden', 'yes'); } catch { /* private mode */ } }}><X size={17} /></button></aside>}
        <div className="l-filter-row"><div className="l-gallery-switch"><button className={`l-text ${!mine ? 'selected' : ''}`} onClick={() => setMine(false)} aria-pressed={!mine}>Everyone’s photos</button><button className={`l-text ${mine ? 'selected' : ''}`} onClick={myUploads} aria-pressed={mine}><Images size={15} /> My uploads</button></div>{groups.length > 0 && <label>Browse by group <select value={group} onChange={(e) => setGroup(e.target.value)}><option value="">Everyone together</option>{groups.map((g) => <option key={g}>{g}</option>)}</select></label>}</div>
        {mine && <p className="l-small l-own-note">Your uploads from this device. Open a photo or tap Remove to take it out of the shared album.</p>}
        {error && <div className="l-error" role="alert">{error} <button onClick={refresh}>Try again</button></div>}
        {!loaded && <p role="status">Opening the trip album…</p>}
        {loaded && !shown.length && !error && <div className="l-empty"><div className="l-empty-icon"><Camera size={33} strokeWidth={1.4} /></div><h3>{mine ? 'Your postcards start here.' : collection ? 'A little space for this story.' : photos.length ? 'A quiet page in the story, for now.' : 'The adventure is just beginning.'}</h3><p>{mine ? 'Photos you share from this device will appear here. You can remove any accidental uploads.' : collection ? 'Moments shared here will appear together. Enjoy browsing whenever they arrive.' : photos.length ? 'Moments for this album or group will appear here when shared.' : 'When the first moments arrive, this will become a little window into their world.'}</p><button className="l-text" onClick={upload}>Have a moment to share? <ArrowUpRight size={16} /></button></div>}
        <div className="l-grid">{shown.map((p) => <article key={p.id} className="l-photo"><button onClick={() => setModal({ kind: 'photo', id: p.id })} aria-label={`Open ${p.caption || byId.get(p.eventId)?.title || 'trip photo'}`}><img src={db.mediaUrl(p, 'thumb')} alt={p.caption || 'A shared moment from the class trip'} loading="lazy" />{p.kind === 'video' && <span className="l-video">▶ Video</span>}</button><div><small>{byId.get(p.eventId)?.title}</small>{p.caption && <p>{p.caption}</p>}<span>With thanks to {p.uploaderName || 'a trip friend'}{p.team ? ` · ${p.team}` : ''}</span><Thanks key={p.id} photo={p} changed={thankedPhoto} />{organizing && <CollectionEditor photo={p} changed={categorizedPhoto} />}{p.owner === owner && <button className="l-text l-remove" aria-label={`Remove ${p.caption || 'your photo'} from album`} onClick={() => setModal({ kind: 'photo', id: p.id, remove: true })}><Trash2 size={14} /> Remove</button>}</div></article>)}</div>
        <button className="l-text l-ideas-link" onClick={() => setIdea(suggestionDay.slug)}><Sparkles size={16} /> A few optional photo ideas</button>
      </section>
    </main><footer className="l-footer"><span>RON CLARK ACADEMY · CLASS OF 2028 <Heart size={13} /> LONDON + PARIS</span><p>For our families. With love from the road.</p><button className="l-text" onClick={share}><Copy size={14} /> Share trip link</button><button className="l-text" onClick={() => setModal({ kind: 'profile' })}>{profile ? 'Your sharing details' : 'Add your sharing details'}</button><button className="l-text" onClick={() => setModal({ kind: 'credits' })}>Destination photo credits</button><button className="l-text" onClick={parentTools}>Parent tools</button><button className="l-text" onClick={() => setModal({ kind: 'admin' })}>{admin ? 'Admin active' : 'Admin'}</button></footer>
    {modal?.kind === 'upload' && <Upload events={events} initialAlbum={modal.album || (album === 'all' ? currentDay.slug : album)} initialPrompt={modal.prompt || ''} initialInspiration={modal.inspiration || ''} viewUploads={myUploads} profile={profile} setProfile={setProfile} close={() => setModal(null)} done={() => { refresh(); setNotice('Thank you. You brought a little of their adventure home.'); }} />}
    {modal?.kind === 'profile' && <Profile profile={profile} setProfile={setProfile} close={() => setModal(null)} />}
    {modal?.kind === 'photo' && <Photo changed={thankedPhoto} key={modal.id} initialRemove={modal.remove} sharePhoto={sharePhoto} photo={photos.find((p) => p.id === modal.id)} photos={shown} owner={owner} admin={admin} close={() => setModal(null)} navigate={(id) => setModal({ kind: 'photo', id })} hidden={() => { setModal(null); refresh(); }} />}
    {modal?.kind === 'credits' && <Dialog title="The places in our story" close={() => setModal(null)}><p className="l-dialog-intro">Destination photographs set the scene. Family and chaperone contributions appear in the shared album.</p><ul className="l-credit-list">{Object.values(DESTINATIONS).map((p) => <li key={p.id}><a href={p.source} target="_blank" rel="noreferrer">{p.alt}<small>{p.credit}</small></a></li>)}</ul><a className="l-text" href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash photography license</a></Dialog>}
    {modal?.kind === 'admin' && <Admin close={() => setModal(null)} setAdmin={setAdmin} />}
    {idea && <Dialog title="A little inspiration" close={() => setIdea(null)}><p className="l-dialog-intro">A few possibilities from the adventure. Browse moments from each place, or simply enjoy what arrives.</p><label className="l-field">Explore the adventure<select value={idea} onChange={(e) => setIdea(e.target.value)}><option value="all">All ideas</option>{DAYS.map((d) => <option key={d.slug} value={d.slug}>{d.title}</option>)}</select></label><div className="l-inspiration-collections">{DAYS.filter((d) => idea === 'all' || d.slug === idea).map((d) => <section key={d.slug}><h3>{d.title}</h3>{INSPIRATIONS.filter((c) => c.album === d.slug || (idea !== 'all' && c.albums?.includes(d.slug))).map((c) => <button key={c.id} onClick={() => openCollection(c.id)}><span><b>{c.title}</b><small>{c.hint}</small></span><span className="l-collection-count"><Images size={14} /><ArrowUpRight size={15} /></span></button>)}</section>)}</div><p className="l-small">Enjoy the moment first. Photos can come later, and only where photography is welcome.</p></Dialog>}
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
export function Upload({ events, initialAlbum, initialPrompt = '', initialInspiration = '', profile, setProfile, close, done, viewUploads, parentOnly = false }) {
  const [name, setName] = useState(profile?.displayName || ''); const [group, setGroup] = useState(profile?.team || '');
  const [slug, setSlug] = useState(initialAlbum === 'all' ? 'the-whole-adventure' : initialAlbum);
  const [inspiration, setInspiration] = useState(initialInspiration);
  const selectedCollection = INSPIRATIONS.find((c) => c.id === inspiration);
  const [caption, setCaption] = useState(initialPrompt); const [files, setFiles] = useState([]); const [busy, setBusy] = useState(false);
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
      const state = await uploadBatch(files, { event, profile: saved, caption, inspiration, onProgress: setProgress, signal: abort.current.signal });
      setResult(state); if (state.done.length) done();
      if (!state.failed.length && state.done.length === files.length) { setFiles([]); setCaption(''); }
    } catch (e) { setError(e.message || 'The upload could not finish. Please try again.'); }
    finally { setBusy(false); }
  }
  return <Dialog title={result?.done.length ? (parentOnly ? 'Thanks for sharing!' : 'Postcards delivered. Thank you!') : parentOnly ? 'A little of your excitement.' : selectedCollection ? `Add to ${selectedCollection.title}` : slug === PREP.slug ? 'A postcard from home' : 'Add today’s photos'} close={() => { if (busy) abort.current?.abort(); close(); }}><p className="l-dialog-intro">{parentOnly ? 'A photo or a quick video. Whatever feels like you.' : slug === PREP.slug ? 'Packing, a little anticipation, or a question for your child. Photos and short videos are both welcome.' : 'A few favorites or the whole day. Share whenever you have a moment.'}</p>{slug === PREP.slug && initialPrompt && <p className="l-prep-upload-prompt">“{initialPrompt}”<small>{parentOnly ? 'Your question is saved with your moment.' : 'This question is your starting caption. You can change it below.'}</small></p>}<form onSubmit={submit}><fieldset disabled={busy}>
    <label className="l-file"><Camera size={29} /><b>{files.length ? `${files.length} selected. Tap to change` : 'Choose photos or videos'}</b><span>Videos up to 500 MB. Made smaller before sharing.</span><input aria-label="Choose photos or videos" type="file" accept="image/*,video/mp4,video/quicktime,video/webm,.heic,.heif" multiple onChange={(e) => { const selected = [...e.target.files]; setFiles(selected.slice(0, MAX_BATCH)); setResult(null); setError(selected.length > MAX_BATCH ? 'The first 60 files are selected. You can add the rest in another batch.' : ''); }} /></label>
    {!profile && <label className="l-field">Your name<input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="So we know who to thank" /></label>}
    <p className="l-upload-summary">{profile ? `Sharing as ${name} · ` : ''}{!parentOnly && <>{selectedCollection ? `${selectedCollection.title} · ` : ''}{DAYS.find((d) => d.slug === slug)?.title}</>}<button type="button" className="l-text" onClick={() => setDetails(!details)} aria-expanded={details}>{details ? 'Less detail' : 'Change or add a caption'}</button></p>
    {details && <div className="l-upload-details">{profile && <label className="l-field">Your name<input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>}{!parentOnly && <><label className="l-field">Album<select value={slug} onChange={(e) => { setSlug(e.target.value); setInspiration(''); }}>{DAYS.map((d) => <option value={d.slug} key={d.slug}>{d.title}</option>)}</select></label><label className="l-field">Group (optional)<input maxLength={40} value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Or everyone together" /></label></>}<label className="l-field">Caption (optional)<textarea rows={2} maxLength={280} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="A little about today" /></label><p className="l-small">Your caption goes with each selected photo.</p></div>}
    </fieldset>
    {busy && <div role="status" className="l-progress"><progress max={progress?.bytesTotal || 1} value={progress?.bytesSent || 0} /><span>{progress?.optimizing ? `Making your video smaller… ${Math.round((progress.optimizationProgress || 0) * 100)}%` : progress?.prepared < progress?.total ? 'Preparing your moments…' : 'Sharing your moments…'} {progress?.done?.length || 0} saved</span></div>}
    {error && <p role="alert" className="l-error">{error}</p>}
    {result && <div role="status"><p>{result.done.length ? `${result.done.length} ${result.done.length === 1 ? 'moment' : 'moments'} saved. Thank you for bringing the adventure home.` : 'Nothing uploaded yet.'}</p>{result.failed.map((f, i) => <p className="l-error" key={i}>{f.name}: {f.error}</p>)}{result.failed.length > 0 && <p className="l-small">{result.done.length ? 'Choose only the files listed above to retry. Your saved moments are already in the album.' : 'Your original video is still on your device. You can try again or choose a shorter clip.'}</p>}</div>}
    <button className="l-button l-wide" disabled={busy || !files.length || !name.trim() || !events.length}>{busy ? 'Sharing…' : files.length ? `Share ${files.length} ${files.length === 1 ? 'photo or video' : 'photos & videos'}` : 'Share photos'}</button>{result?.done.length > 0 && <button type="button" className="l-text l-wide" onClick={viewUploads}>{parentOnly ? 'View my moments' : 'View my uploads'} <ArrowUpRight size={16} /></button>}<p className="l-small">{parentOnly ? 'Uploaded the wrong one? Remove it from Your moments below on this device.' : 'Uploaded the wrong one? Remove it anytime in My uploads on this device.'}</p>{busy && <button type="button" className="l-text" onClick={() => abort.current?.abort()}>Stop upload</button>}
  </form></Dialog>;
}
function CollectionEditor({ photo, changed }) {
  const [value, setValue] = useState(photo.inspiration || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setValue(photo.inspiration || ''); }, [photo.inspiration]);
  return <div className="l-collection-editor"><label>Collection for {photo.caption || 'this postcard'}<select value={value} disabled={busy} onChange={(e) => setValue(e.target.value)}><option value="">No collection label</option>{DAYS.map((day) => <optgroup key={day.slug} label={day.title}>{INSPIRATIONS.filter((c) => c.album === day.slug).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</optgroup>)}</select></label><button className="l-text" disabled={busy || value === (photo.inspiration || '')} onClick={async () => {
    setBusy(true); setError('');
    try { await db.categorizePhoto(photo.id, value); changed(photo.id, value); }
    catch { setError('The label could not be saved. Please try again.'); }
    finally { setBusy(false); }
  }}>{busy ? 'Saving…' : 'Save label'}</button>{error && <p role="alert" className="l-error">{error}</p>}</div>;
}
function Thanks({ photo, changed }) {
  const [thanked, setThanked] = useState(Boolean(photo.thanked));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setThanked(Boolean(photo.thanked)); }, [photo.thanked]);
  return <><button className="l-text l-photo-thanks" aria-pressed={thanked} disabled={busy} onClick={async () => {
    setBusy(true); setError('');
    try { await db.setThanks(photo.id, !thanked); changed(photo.id, !thanked); setThanked(!thanked); }
    catch { setError('Your thanks could not be saved. Please try again.'); }
    finally { setBusy(false); }
  }}><Heart size={16} fill={thanked ? 'currentColor' : 'none'} />{thanked ? 'Thanks sent' : 'Thanks for sharing'}</button>{error && <p className="l-error" role="alert">{error}</p>}</>;
}
function Photo({ photo, photos, owner, admin, close, navigate, hidden, initialRemove = false, sharePhoto, changed }) {
  const [error, setError] = useState(''); const [confirm, setConfirm] = useState(initialRemove); const [busy, setBusy] = useState(false);
  if (!photo) return null;
  const index = photos.findIndex((p) => p.id === photo.id);
  return <Dialog title={photo.caption || 'A postcard from the adventure'} close={close}><div className="l-viewer">{photo.kind === 'video' ? <video src={db.mediaUrl(photo, 'orig')} poster={db.mediaUrl(photo, 'thumb')} controls playsInline /> : <img src={db.mediaUrl(photo)} alt={photo.caption || 'A moment from the class trip'} />}</div><p>With thanks to <b>{photo.uploaderName || 'a trip friend'}</b>{photo.team ? ` · ${photo.team}` : ''}</p><Thanks key={photo.id} photo={photo} changed={changed} /><button className="l-button l-share-photo" onClick={() => sharePhoto(photo)}><Copy size={17} /> Share this photo</button><div className="l-viewer-actions"><button className="l-text" disabled={index <= 0} onClick={() => { setConfirm(false); navigate(photos[index - 1].id); }}><ChevronLeft size={19} /> Previous</button><a className="l-text" href={db.mediaUrl(photo, 'orig')} target="_blank" rel="noreferrer"><Download size={17} /> Original</a><button className="l-text" disabled={index < 0 || index >= photos.length - 1} onClick={() => { setConfirm(false); navigate(photos[index + 1].id); }}>Next <ChevronRight size={19} /></button></div>{(photo.owner === owner || admin) && <div className="l-hide">{confirm ? <><p>Remove this photo from the shared album?</p><button className="l-button" disabled={busy} onClick={async () => { setBusy(true); try { await db.hidePhoto(photo.id, admin); hidden(); } catch (e) { setError(e.message); } finally { setBusy(false); } }}>Remove from album</button><button className="l-text" onClick={() => setConfirm(false)}>Keep it visible</button></> : <button className="l-text" onClick={() => setConfirm(true)}><Trash2 size={16} /> Remove from album</button>}</div>}{error && <p className="l-error" role="alert">{error}</p>}</Dialog>;
}
function Admin({ close, setAdmin }) {
  const [pass, setPass] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <Dialog title="Trip album admin" close={close}><form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { if (!await db.checkPass(pass)) throw new Error('That passphrase was not recognized.'); setAdmin(pass); close(); } catch (e) { setError(e.message); } finally { setBusy(false); } }}><label className="l-field">Admin passphrase<input type="password" value={pass} onChange={(e) => setPass(e.target.value)} /></label><p className="l-small">Admins can remove any photo from the shared album. Chaperones can remove their own uploads without an admin passphrase.</p>{error && <p className="l-error" role="alert">{error}</p>}<button className="l-button" disabled={busy || !pass}>Open admin</button></form></Dialog>;
}
