import SaveVideo from './SaveVideo.jsx';
import ActivityPanel from './ActivityPanel.jsx';
import {trackActivity} from './activity.js';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Heart, ArrowUpRight, X, Plane, Sparkles, Copy, ChevronLeft, ChevronRight, Download, Check, Trash2, Images, Globe2, Luggage, Landmark, Ticket, Castle, TrainFront, Crown, House, MessageCircle, Share2, PencilLine } from 'lucide-react';
import { DAYS, PREP, VAULT, MAX_BATCH, DESTINATIONS, chapterFor, basePath, tripToday, INSPIRATIONS } from './config.js';
import * as db from './data.js';
import TripMap from './TripMap.jsx';
import PhotoCredit from './PhotoCredit.jsx';
import {distinctStoryMedia} from './instagram.js';
import {photoDay,matchesGalleryFilters} from './galleryFilters.js';
import { captureTime, newestCapturedFirst } from './timeline.js';
import LoginGate,{LoginPanel} from './LoginGate.jsx';
import { uploadBatch } from './upload.js';
import { makeTextCard, THOUGHT_STARTERS } from './textCard.js';

function Dialog({ title, close, children, className = '', onKeyDown }) {
  const ref = useRef(null);
  useEffect(() => {
    const before = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => { dialog.close(); before?.focus?.(); };
  }, []);
  return <dialog ref={ref} className={`l-dialog ${className}`} onKeyDown={onKeyDown} onCancel={close} onClick={(event) => { if (event.target === ref.current) close(); }}>
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
  const [sourceFilter,setSourceFilter]=useState('all');
  const [dayFilter,setDayFilter]=useState('');
  const [placeFilter,setPlaceFilter]=useState('');
  const [visibleCount,setVisibleCount] = useState(60);
  const [album, setAlbum] = useState('all');
  const [collectionId, setCollectionId] = useState('');
  const [group, setGroup] = useState('');
  const [mine, setMine] = useState(false);
  useEffect(()=>setVisibleCount(60),[album,collectionId,group,mine,sourceFilter,dayFilter,placeFilter]);
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
      const [albums, images, me] = await Promise.all([db.listEvents(), db.listPhotos(), db.getOwner()]);
      setEvents(albums); setPhotos(images); setOwner(me); setError('');
    } catch (e) { setError(e.message || 'The photos could not load. Please try again.'); }
    finally { setLoaded(true); }
  }
  useEffect(() => { refresh(); db.getOwner().then(setOwner); const timer = setInterval(refresh, 45000); return () => clearInterval(timer); }, []);
  useEffect(() => { const change = () => setHash(window.location.hash); window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change); }, []);
  useEffect(() => { const match = hash.match(/^#\/e\/([a-z0-9-]+)/); const collection = hash.match(/^#\/c\/([a-z0-9-]+)$/); if (hash === '#/from-their-stories') { setSourceFilter('instagram'); setMine(false); setGroup(''); setDayFilter(''); setPlaceFilter(''); } setCollectionId(collection && INSPIRATIONS.some((c) => c.id === collection[1]) ? collection[1] : ''); if (match) setAlbum(match[1]); else setAlbum('all'); }, [hash]);
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
  const fromStories = sourceFilter === 'instagram';
  const galleryPhotos = distinctStoryMedia(photos);
  const collection = INSPIRATIONS.find((c) => c.id === collectionId);
  const shown = [...galleryPhotos].sort(newestCapturedFirst).filter((p) => (!collection || p.inspiration === collection.id) && (album === 'all' || byId.get(p.eventId)?.slug === album) && (!group || p.team === group) && (!mine || p.owner === owner) && matchesGalleryFilters(p,{source:sourceFilter,day:dayFilter,place:placeFilter}));
  const filterDays=[...new Set(photos.map(photoDay).filter(Boolean))].sort().reverse();
  const filtersActive=sourceFilter!=='all'||dayFilter||placeFilter;
  const visiblePhotos=shown.slice(0,visibleCount);
  const dayLabel=p=>captureTime(p) ? new Intl.DateTimeFormat('en-US',{timeZone:'Europe/London',weekday:'long',month:'short',day:'numeric'}).format(new Date(captureTime(p))) : 'Shared moments';
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
    trackActivity('shares');
    } catch (e) { if (e.name !== 'AbortError') setNotice('Could not share the link. Please copy it from your address bar.'); }
  }
  async function sharePhoto(photo) {
    const event = byId.get(photo.eventId);
    if (!event) return;
    const url = `${window.location.origin}${basePath()}e/${event.slug}/p/${photo.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${event.title} · Class of 2028`, url });
      else { await navigator.clipboard.writeText(url); setNotice('Photo link copied. Its preview will show this moment.'); }
    trackActivity('shares');
    } catch (e) { if (e.name !== 'AbortError') setNotice('Could not share this photo. Please try again.'); }
  }
  return <div className="london" data-city={chapter.city}>
    <header className="l-top"><a href="#/" onClick={() => { setMine(false); pickAlbum('all'); }} className="l-brand"><img src="/london/ron-clark-academy.png" alt="The Ron Clark Academy" width="520" height="120" /><span>CLASS OF 2028<small>LONDON + PARIS</small></span></a><div className="l-top-actions"><button className="l-text l-my-uploads" onClick={myUploads}><Images size={16} /> My uploads</button><button className="l-button" onClick={upload}><Camera size={16} /> Share a moment</button></div></header>
    <main>
      <section className="l-recent" aria-labelledby="recent-title"><div className="l-recent-heading"><div><p className="l-eyebrow">A LITTLE JOY FROM THE ROAD</p><h2 id="recent-title">The latest moments.</h2></div><a className="l-text" href="#memories">See all photos <ArrowUpRight size={16}/></a></div>{!loaded && <p role="status">Opening the trip album…</p>}<div className="l-recent-grid">{[...galleryPhotos].sort(newestCapturedFirst).slice(0,4).map((p,index)=><button key={p.id} onClick={()=>{setMine(false);setGroup('');pickAlbum('all');setModal({kind:'photo',id:p.id});}} aria-label={`Open recent ${p.kind==='video'?'video':'photo'}${p.scholarName?` from ${p.scholarName}`:''}`}><img src={db.mediaUrl(p,'thumb')} alt={p.caption||'A recent moment from the class trip'} loading="eager" fetchPriority={index===0?'high':'auto'}/>{p.kind==='video'&&<span>▶ Video</span>}</button>)}</div>{loaded && !photos.length && <p className="l-small">The first moments are on their way.</p>}</section>
      <section className="l-hero">
        <div className="l-hero-copy"><p className="l-eyebrow"><span /> OCTOBER 11–17, 2026 · LONDON + PARIS</p><h1>RCA 2028<br />Takes <em>London.</em></h1><p className="l-intro">A little window into their adventure.</p><p className="l-description">Already taking a photo? There’s a place for it here, whenever sharing fits.</p><div className="l-hero-actions"><button className="l-button l-large" onClick={upload}><Camera size={20} /> Share a moment <ArrowUpRight size={18} /></button><a href="#memories" className="l-text">See the postcards <ArrowUpRight size={17} /></a></div><p className="l-small">Choose photos, tap share, and you’re done. Whenever it fits.</p></div>
        <div className="l-art l-photo-art" hidden><div className="l-stamp">{chapter.route}<br /><span>CLASS OF ’28</span></div><figure className="l-postcard"><img className="l-destination-photo" src={chapter.photo.image} alt={chapter.photo.alt} fetchPriority="high" width="1000" height="800" /><figcaption className="l-postcard-caption">{chapter.greeting}<span>{chapter.place} · destination photograph</span></figcaption><a className="l-photo-credit" href={chapter.photo.source} target="_blank" rel="noreferrer">Photo: {chapter.photo.credit}</a></figure><div className="l-ticket"><Plane size={22} /><span>{chapter.label.toUpperCase()}<small>{chapter.mood}</small></span></div></div>
      </section>
      <section className="l-prep" hidden id="before-the-adventure" aria-labelledby="family-postcards-title"><div className="l-prep-heading"><div><p className="l-eyebrow"><Heart size={14} /> BEFORE THE ADVENTURE</p><h2 id="family-postcards-title">First postcards, from home.</h2><p>Packing, countdowns, big dreams. Share a photo or short video of your family getting ready.</p></div><div className="l-prep-actions"><button className="l-button" onClick={() => uploadPrep()}><Camera size={18} /> Add a family postcard</button><div className="l-prep-links"><button className="l-text" onClick={() => setIdea(PREP.slug)}>Need an idea?</button><button className="l-text" onClick={browsePrep}>View postcards{familyPhotos.length ? ` (${familyPhotos.length})` : ''} <ArrowUpRight size={14} /></button></div></div></div></section>
      <TripMap chapter={chapter} pickAlbum={pickAlbum} />
      <section className="l-daily-chapter" hidden><div><p className="l-eyebrow">{chapter.label.toUpperCase()} · {chapter.day.slug === PREP.slug ? 'OUR FAMILIES START THE STORY' : 'RCA 2028 TAKES LONDON'}</p><h2>{chapter.day.title === 'The whole adventure' ? 'A new place to wake up to.' : chapter.day.title}</h2><p>{chapter.day.blurb}</p><small>{chapter.day.slug === PREP.slug ? 'The excitement at home is part of the adventure, too.' : 'A new day, a new part of the adventure. The moments below are theirs to share.'}</small></div><button className="l-text" onClick={() => setIdea(chapter.day.slug)}><Sparkles size={17} /> A little inspiration for this chapter <ArrowUpRight size={16} /></button></section>

      <section className="l-memories" id="memories">{organizing && <aside className="l-parent-tools"><div><b>A little help from home</b><p>Parents can add collection labels after photos arrive. Contributors can simply share their moments.</p></div><button className="l-text" onClick={() => setOrganizing(false)}>Done organizing</button></aside>}<div className="l-section-head"><div><p className="l-eyebrow">THE STORY, TOGETHER</p><h2>{mine ? 'Your postcards home' : collection ? collection.title : fromStories ? 'From Their Stories' : 'The latest from their adventure'}</h2></div><span className="l-total">{collection || filtersActive ? shown.length : galleryPhotos.length} shared {(collection || filtersActive ? shown.length : galleryPhotos.length) === 1 ? 'moment' : 'moments'} <Heart size={15} /></span></div>
        <nav className="l-source-nav" aria-label="Memory sources"><a className="l-text" href="#memories" onClick={()=>setSourceFilter('all')}>All moments</a><a className="l-text" href="#/from-their-stories" onClick={()=>document.getElementById('memories')?.scrollIntoView({behavior:'smooth'})}>From Their Stories</a></nav>
        {fromStories && <p className="l-album-description">Trip moments shared on Instagram by our chaperones and RCA<small style={{display:'block'}}>Instagram source times are unverified. Day filters follow the saved records.</small></p>}
        <p className="l-gallery-login">Send a little love. Reactions and comments need no sign-in.</p>
        {!collection && <details className="l-browse-albums"><summary>Browse by day</summary><div className="l-albums" aria-label="Trip albums"><button className={album === 'all' ? 'active' : ''} onClick={() => pickAlbum('all')}>The whole trip</button>{DAYS.map((d) => <button key={d.slug} className={album === d.slug ? 'active' : ''} onClick={() => pickAlbum(d.slug)}><AlbumCover slug={d.slug} /><span>{d.date && <small>{d.label}</small>}{d.title}</span></button>)}</div></details>}
        {collection && <div className="l-collection-heading"><p>{collection.hint}<small>One shared collection. Add a photo or video whenever it fits.</small></p><div><button className="l-button" onClick={upload}><Camera size={17} /> Add a moment here</button><button className="l-text" onClick={() => pickAlbum('all')}>Back to all postcards</button></div></div>}
        {album !== 'all' && <p className="l-album-description">{DAYS.find((d) => d.slug === album)?.blurb}</p>}

        <div className="l-filter-row"><div className="l-gallery-switch"><button className={`l-text ${!mine ? 'selected' : ''}`} onClick={() => setMine(false)} aria-pressed={!mine}>Everyone’s photos</button><button className={`l-text ${mine ? 'selected' : ''}`} onClick={myUploads} aria-pressed={mine}><Images size={15} /> My uploads</button></div>{groups.length > 0 && <label>Browse by group <select value={group} onChange={(e) => setGroup(e.target.value)}><option value="">Everyone together</option>{groups.map((g) => <option key={g}>{g}</option>)}</select></label>}</div>
        <div className="l-gallery-filters" aria-label="Filter gallery"><label>Source<select aria-label="Filter by source" value={sourceFilter} onChange={e=>{setSourceFilter(e.target.value);if(e.target.value==='instagram')window.location.hash='#/from-their-stories';else if(hash==='#/from-their-stories')window.location.hash='#memories';}}><option value="all">All photos</option><option value="instagram">Instagram</option><option value="shared">Family &amp; chaperones</option></select></label><label>Day<select aria-label="Filter by day" value={dayFilter} onChange={e=>{setDayFilter(e.target.value);pickAlbum('all');}}><option value="">Every day</option>{filterDays.map(day=><option key={day} value={day}>{new Intl.DateTimeFormat('en-US',{timeZone:'Europe/London',weekday:'short',month:'short',day:'numeric'}).format(new Date(day+'T12:00:00Z'))}</option>)}</select></label><label>Place<select aria-label="Filter by place" value={placeFilter} onChange={e=>{setPlaceFilter(e.target.value);pickAlbum('all');}}><option value="">Everywhere</option><option value="unassigned">Not sorted yet</option>{INSPIRATIONS.map(place=><option key={place.id} value={place.id}>{place.title}</option>)}</select></label></div>{filtersActive && <div className="l-filter-status"><span role="status">{shown.length} matching {shown.length===1?'moment':'moments'}</span><button className="l-text" onClick={()=>{setSourceFilter('all');setDayFilter('');setPlaceFilter('');}}>Clear filters</button></div>}
        {mine && <p className="l-small l-own-note">Your uploads on this account. Open a photo to take it out of the shared album.</p>}
        {error && <div className="l-error" role="alert">{error} <button onClick={refresh}>Try again</button></div>}
        {!loaded && <p role="status">Opening the trip album…</p>}
        {loaded && !shown.length && !error && <div className="l-empty"><div className="l-empty-icon"><Camera size={33} strokeWidth={1.4} /></div><h3>{mine ? 'Your postcards start here.' : collection ? 'A little space for this story.' : photos.length ? 'A quiet page in the story, for now.' : 'The adventure is just beginning.'}</h3><p>{mine ? 'Photos you share on this account will appear here. You can remove any accidental uploads.' : collection ? 'Moments shared here will appear together. Enjoy browsing whenever they arrive.' : photos.length ? 'Moments for this album or group will appear here when shared.' : 'When the first moments arrive, this will become a little window into their world.'}</p><button className="l-text" onClick={upload}>Have a moment to share? <ArrowUpRight size={16} /></button></div>}
        <div className="l-grid l-thumbnail-grid">{visiblePhotos.map((p,index) => <Fragment key={p.id}>{(index===0 || dayLabel(p)!==dayLabel(visiblePhotos[index-1])) && <h3 className="l-gallery-day">{dayLabel(p)}</h3>}<article key={p.id} className="l-photo l-thumbnail"><button className="l-thumbnail-open" onClick={() => setModal({kind:'photo',id:p.id})} aria-label={`Open ${p.caption || byId.get(p.eventId)?.title || 'trip photo'}`}><img src={db.mediaUrl(p,'thumb')} alt={p.caption || 'A shared moment from the class trip'} loading="lazy" decoding="async"/>{p.kind==='video' && <span className="l-video" aria-label="Video">▶<span className="l-sr-only"> Video</span></span>}</button>{p.uploaderName?.startsWith('Shared on Instagram by @') && <span className="l-thumbnail-instagram" title={p.uploaderName}>Instagram</span>}<Thanks photo={p} changed={thankedPhoto} compact onOpen={()=>setModal({kind:'photo',id:p.id})}/>{organizing && <CollectionEditor photo={p} changed={categorizedPhoto}/>}</article></Fragment>)}</div>{shown.length>visibleCount && <button className="l-button l-load-more" onClick={()=>setVisibleCount(n=>n+60)}>Show more photos ({shown.length-visibleCount} more)</button>}
        {!ideaHidden && !collection && <aside className="l-idea l-inspiration-strip"><Sparkles size={19} /><div><b>A little inspiration, if you’d like</b><div className="l-inspiration-chips">{INSPIRATIONS.filter((c) => c.album === suggestionDay.slug || c.albums?.includes(suggestionDay.slug)).slice(0, 3).map((c) => <button className="l-text" key={c.id} onClick={() => openCollection(c.id)}>{c.title} <ArrowUpRight size={13} /></button>)}<button className="l-text" onClick={() => setIdea(suggestionDay.slug)}>More ideas <ArrowUpRight size={13} /></button></div></div><button className="l-dismiss" aria-label="Dismiss photo ideas for this visit" onClick={() => { setIdeaHidden(true); try { sessionStorage.setItem('london-idea-hidden', 'yes'); } catch { /* private mode */ } }}><X size={17} /></button></aside>}
        <button className="l-text l-ideas-link" onClick={() => setIdea(suggestionDay.slug)}><Sparkles size={16} /> A few optional photo ideas</button>
      </section>

    </main><footer className="l-footer"><span>RON CLARK ACADEMY · CLASS OF 2028 <Heart size={13} /> LONDON + PARIS</span><p>For our families. With love from the road.</p><button className="l-text" onClick={share}><Copy size={14} /> Share trip link</button><button className="l-text" onClick={()=>setModal({kind:'account'})}>Sharing account</button><button className="l-text" onClick={() => setModal({ kind: 'profile' })}>{profile ? 'Your sharing details' : 'Add your sharing details'}</button><button className="l-text" onClick={() => setModal({ kind: 'credits' })}>Destination photo credits</button><button className="l-text" onClick={parentTools}>Parent tools</button>{admin && <button className="l-text" onClick={()=>setModal({kind:'activity'})}>Activity</button>}<button className="l-text" onClick={() => setModal({ kind: 'admin' })}>{admin ? 'Admin active' : 'Admin'}</button></footer>
    {modal?.kind === 'upload' && <Upload events={events} initialAlbum={modal.album || (album === 'all' ? currentDay.slug : album)} initialPrompt={modal.prompt || ''} initialInspiration={modal.inspiration || ''} viewUploads={myUploads} profile={profile} setProfile={setProfile} close={() => setModal(null)} done={() => { refresh(); setNotice('Thank you. You brought a little of their adventure home.'); }} />}
    {modal?.kind === 'account' && <Dialog title="Your sharing account" close={()=>setModal(null)}><LoginPanel settings onReady={()=>setModal(null)}/></Dialog>}
    {modal?.kind === 'profile' && <Profile profile={profile} setProfile={setProfile} close={() => setModal(null)} />}
    {modal?.kind === 'photo' && <Photo onUpload={upload} changed={thankedPhoto} key={modal.id} initialRemove={modal.remove} sharePhoto={sharePhoto} photo={photos.find((p) => p.id === modal.id)} photos={shown} owner={owner} admin={admin} close={() => setModal(null)} navigate={(id) => setModal({ kind: 'photo', id })} hidden={() => { setModal(null); refresh(); }} />}
    {modal?.kind === 'credits' && <Dialog title="The places in our story" close={() => setModal(null)}><p className="l-dialog-intro">Destination photographs set the scene. Family and chaperone contributions appear in the shared album.</p><ul className="l-credit-list">{Object.values(DESTINATIONS).map((p) => <li key={p.id}><a href={p.source} target="_blank" rel="noreferrer">{p.alt}<small>{p.credit}</small></a></li>)}</ul><a className="l-text" href="https://unsplash.com/license" target="_blank" rel="noreferrer">Unsplash photography license</a></Dialog>}
    {modal?.kind === 'activity' && admin && <Dialog title="London activity" close={()=>setModal(null)}><ActivityPanel pass={admin}/></Dialog>}
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
  return <Dialog title="A name to say thank you to" close={close}><p className="l-dialog-intro">Your name travels with the moments you share. Your group is optional and can change as the day does.</p><form onSubmit={save}><label className="l-field">Your name<input required maxLength={60} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label><label className="l-field">Group, if you’d like<input maxLength={40} placeholder="Your assigned group, dinner group, or leave blank" value={group} onChange={(e) => setGroup(e.target.value)} /></label><p className="l-small">Your name stays with your account. Everyone shares in one class album.</p>{error && <p role="alert" className="l-error">{error}</p>}<button className="l-button" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save details'}</button></form></Dialog>;
}
export function ShareThanks({ parentOnly = false, again, close, viewUploads, skipped = 0 }) {
  const [notice,setNotice]=useState('');
  const url=new URL(parentOnly ? '/2028-london-ready/' : '/2028-london/',window.location.origin).href;
  const text=parentOnly ? 'We shared a little of our getting-ready excitement! Add a photo, a quick video, or a few words from your traveler. Answer one or all!' : 'A little window into our class adventure. Come share a moment with us!';
  async function invite() {
    try {
      if(navigator.share) await navigator.share({title:parentOnly ? 'Getting ready · RCA 2028' : VAULT.name,text,url});
      else {await navigator.clipboard.writeText(`${text}\n${url}`);setNotice('Invite copied. Paste it into your group chat or Messages.');}
    } catch(e) {
      if(e.name!=='AbortError') setNotice('Couldn’t open sharing. Copy the invite below.');
    }
  }
  return <div className="l-share-thanks">{skipped>0 && <p className="l-small">{skipped} already in the album. Extra copies were skipped.</p>}<div className="l-thanks-postcard"><div className="l-thanks-stamp"><Plane size={24}/><span>RCA<br/>2028</span></div><p className="l-thanks-kicker">LONDON + PARIS · STARTING WITH US</p><h3>One little moment.<br/>A story we’re making together.</h3><p>Yours is in. Thank you! Who’s next?</p><div className="l-thanks-hearts" aria-label="With love from every house">💙 🖤 ❤️ 💚</div></div><div className="l-invite-preview"><span>PASS THE EXCITEMENT ON</span><p>{parentOnly ? 'Suitcases, big hopes, and a few happy nerves. What’s happening at your house?' : 'A new place. A new story. Come share a little of the adventure.'}</p><small>RCA CLASS OF 2028</small></div><button type="button" className="l-button l-wide" onClick={invite}><Share2 size={19}/>Bring the group chat along <ArrowUpRight size={19}/></button><p className="l-small">Send a little nudge through Messages or your favorite chat.</p>{notice&&<div role="status"><p>{notice}</p><textarea aria-label="Invitation to copy" readOnly rows={4} value={`${text}\n${url}`}/></div>}<div className="l-thanks-actions"><button type="button" className="l-text" onClick={again}>One more moment?</button><button type="button" className="l-text" onClick={viewUploads}>See mine</button><button type="button" className="l-text" onClick={close}>All done</button></div></div>;

}
export function Upload(props){return <LoginGate modal close={props.close}><UploadForm {...props}/></LoginGate>;}
function UploadForm({ events, initialAlbum, initialPrompt = '', initialInspiration = '', profile, setProfile, close, done, viewUploads, parentOnly = false, writingEnabled = false }) {
  const [name, setName] = useState(db.localProfile()?.displayName || profile?.displayName || ''); const [group, setGroup] = useState(db.localProfile()?.team || profile?.team || '');
  const [slug, setSlug] = useState(initialAlbum === 'all' ? 'the-whole-adventure' : initialAlbum);
  const [inspiration, setInspiration] = useState(initialInspiration);
  const selectedCollection = INSPIRATIONS.find((c) => c.id === inspiration);
  const [caption, setCaption] = useState(initialPrompt); const [files, setFiles] = useState([]); const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); const [error, setError] = useState(''); const [result, setResult] = useState(null);
  const [details, setDetails] = useState(false);
  const [mode, setMode] = useState('media'); const [words,setWords] = useState(''); const [speaker,setSpeaker] = useState(()=>db.localScholar?.() || ''); const [starter,setStarter] = useState(THOUGHT_STARTERS[0]);
  const abort = useRef(null);
  useEffect(() => () => abort.current?.abort(), []);
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(''); setResult(null); abort.current = new AbortController();
    try {
      if (parentOnly && !speaker.trim()) throw new Error('Add the scholar’s first name.');
      db.saveScholar?.(speaker.trim());
      const event = events.find((e) => e.slug === slug);
      if (!event) throw new Error('This album is still getting ready. Please try again shortly.');
      const saved = await db.saveProfile({ displayName: name, team: group }); setProfile(saved);
      const written = mode !== 'media' ? await makeTextCard({mode:mode==='comment' && speaker.trim() ? 'quote' : mode,text:words,speaker,starter,prompt:initialPrompt}) : null;
      const items = written ? [written.file] : files;
      const state = await uploadBatch(items, { event, profile: saved, caption: written ? written.caption : caption, scholarName: speaker.trim(), inspiration, onProgress: setProgress, signal: abort.current.signal });
      setResult(state); if (state.done.length) {trackActivity('uploads');done();}
      if (!state.failed.length && state.done.length === items.length) { setFiles([]); setCaption(''); setWords(''); }
    } catch (e) { setError(e.message || 'The upload could not finish. Please try again.'); }
    finally { setBusy(false); }
  }
  if(result?.done.length && !result.failed.length) return <Dialog className="l-compose" title="That’s a memory worth keeping." close={close}><ShareThanks skipped={result.skipped?.length||0} parentOnly={parentOnly} close={close} viewUploads={viewUploads} again={()=>{setResult(null);setProgress(null);setError('');}}/></Dialog>;
  return <Dialog className="l-compose" title={result?.done.length ? 'A little moment, saved.' : initialPrompt || (parentOnly ? 'What’s your London mood?' : selectedCollection ? `What’s happening at ${selectedCollection.title}?` : 'What would you like to share?')} close={() => { if (busy) abort.current?.abort(); close(); }}><p className="l-dialog-intro">{'Choose your photos to share.'}</p><form onSubmit={submit}><fieldset disabled={busy}>
    {parentOnly && writingEnabled && <div className="l-share-choices" role="tablist" aria-label="Ways to share">{[
      ['media','Upload photo','A photo from your phone',Camera],
      ['comment','Write a response','Your words or theirs',MessageCircle],
      ['thought','Finish a thought','Pick a sentence starter',PencilLine],
    ].map(([id,label,hint,Icon])=><button key={id} id={`share-tab-${id}`} type="button" role="tab" aria-selected={mode===id} tabIndex={mode===id?0:-1} onKeyDown={e=>{const ids=['media','comment','thought'];const i=ids.indexOf(id);const next=e.key==='ArrowRight'?ids[(i+1)%3]:e.key==='ArrowLeft'?ids[(i+2)%3]:e.key==='Home'?ids[0]:e.key==='End'?ids[2]:null;if(next){e.preventDefault();setMode(next);setResult(null);setError('');document.getElementById(`share-tab-${next}`)?.focus();}}} aria-controls="share-panel" onClick={()=>{setMode(id);setResult(null);setError('');}}><Icon size={26}/><span><b>{label}</b><small>{hint}</small></span>{mode===id ? <Check size={18}/> : <ArrowUpRight size={18}/>}</button>)}</div>}
    <div id="share-panel" role="tabpanel" aria-labelledby={parentOnly && writingEnabled?`share-tab-${mode}`:undefined}>
    {parentOnly && <div className={`l-share-example l-example-${mode}`}><span className="l-example-label">Example</span>{mode==='media' && inspiration==='airport-hellos' ? <p>A goodbye hug, your scholar with friends, or one last family photo before takeoff.</p> : mode==='media' ? <><img src="/london/packing-example.jpg" alt="Clothes and sunglasses packed in an open suitcase"/><span>A suitcase photo.<br/>A little of the excitement.<a href="https://www.pexels.com/photo/clothes-and-sunglasses-in-an-open-suitcase-on-a-rug-8933565/" target="_blank" rel="noreferrer">Stock photo · Pexels</a></span></> : <p>{mode==='comment' ? '“I’m packing extra room for the snacks I bring back!”' : mode==='thought' ? '“I imagine Paris will feel like stepping into a movie.”' : '“The suitcase is open. The excitement is real.”'}</p>}</div>}
    {mode === 'media' ? <label className="l-file"><Camera size={29} /><b>{files.length ? `${files.length} selected. Tap to change` : 'Upload photo'}</b><span>Choose photos from your phone. We handle the sizing.</span><input aria-label="Upload photo" type="file" accept="image/*,.heic,.heif" multiple onChange={(e) => { const selected = [...e.target.files]; setFiles(selected.slice(0, MAX_BATCH)); setResult(null); setError(selected.length > MAX_BATCH ? 'The first 60 files are selected. You can add the rest in another batch.' : ''); }} /></label>
    : <div className="l-written-moment">{mode==='thought'&&<label className="l-field">Pick a beginning<select value={starter} onChange={e=>setStarter(e.target.value)}>{THOUGHT_STARTERS.map(value=><option key={value} value={value}>{value}</option>)}</select></label>}<label className="l-field">{mode==='thought'?'Finish it your way':'Your response'}<textarea rows={2} maxLength={220} value={words} onChange={e=>setWords(e.target.value)} placeholder={mode==='thought'?'The rest is yours…':'Type your answer or something your child said…'}/></label><p className="l-small">{words.length}/220</p></div>}
    </div>
    {mode === 'media' && <div className="l-video-drop"><a className="l-button l-wide" href="https://www.dropbox.com/request/nbzcr0efh4stygrdkprb" target="_blank" rel="noreferrer">Send a video <ArrowUpRight size={18} /></a><p className="l-small">Have a video? Send it through Dropbox. We’ll prepare it and add it to the album later.</p></div>}
    <label className="l-field">{parentOnly ? 'Scholar’s first name' : 'Scholar names (optional)'}<input required={parentOnly} maxLength={40} value={speaker} onChange={e=>setSpeaker(e.target.value)} placeholder="Mosie, or names for a group moment"/><small>{parentOnly ? 'Who is this moment or response from?' : 'Add a name if you’d like, or just share.'}</small></label>
    {!profile && <label className="l-field">Your name<input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="First and last name" /></label>}
    <p className="l-upload-summary">{profile ? `Sharing as ${name} · ` : ''}{!parentOnly && <>{selectedCollection ? `${selectedCollection.title} · ` : ''}{DAYS.find((d) => d.slug === slug)?.title}</>}{(!parentOnly || profile || mode==='media') && <button type="button" className="l-text" onClick={() => setDetails(!details)} aria-expanded={details} aria-controls="sharing-details">{details ? 'Close options' : parentOnly ? mode==='media' ? profile ? 'Add a caption or change name' : 'Add a caption' : 'Change name' : mode==='media' ? 'Change or add a caption' : 'Sharing details'}</button>}</p>
    {details && (!parentOnly || profile || mode==='media') && <div id="sharing-details" className="l-upload-details">{profile && <label className="l-field">Your name<input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>}{!parentOnly && <><label className="l-field">Album<select value={slug} onChange={(e) => { setSlug(e.target.value); setInspiration(''); }}>{DAYS.map((d) => <option value={d.slug} key={d.slug}>{d.title}</option>)}</select></label><label className="l-field">Group (optional)<input maxLength={40} value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Or everyone together" /></label></>}{mode==='media' && <><label className="l-field">Caption (optional)<textarea rows={2} maxLength={280} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="A little about today" /></label><p className="l-small">Your caption goes with each selected photo.</p></>}</div>}
    </fieldset>
    {busy && <div role="status" className="l-progress"><progress max={progress?.bytesTotal || 1} value={progress?.bytesSent || 0} /><span>{progress?.optimizing ? `Making your video smaller… ${Math.round((progress.optimizationProgress || 0) * 100)}%` : progress?.prepared < progress?.total ? 'Preparing your moments…' : 'Sharing your moments…'} {progress?.done?.length || 0} saved</span></div>}
    {error && <p role="alert" className="l-error">{error}</p>}
    {result && <div role="status"><p>{result.done.length ? `${result.done.length} ${result.done.length === 1 ? 'moment' : 'moments'} saved. Thank you for bringing the adventure home.` : result.skipped?.length ? 'These photos are already in the album. No extra copies were added.' : 'Nothing uploaded yet.'}</p>{result.skipped?.length>0 && result.done.length>0 && <p className="l-small">{result.skipped.length} already in the album. Extra copies were skipped.</p>}{result.failed.map((f, i) => <p className="l-error" key={i}>{f.name}: {f.error}</p>)}{result.failed.length > 0 && <p className="l-small">{result.done.length ? 'Choose only the files listed above to retry. Your saved moments are already in the album.' : mode==='media' ? 'Your selected files are still on your device. You can try again.' : 'Your words are still here. Please try sharing again.'}</p>}</div>}
    <button className="l-button l-wide" disabled={busy || (mode==='media' ? !files.length : !words.trim()) || !name.trim() || (parentOnly && !speaker.trim()) || !events.length}>{busy ? 'Sharing…' : mode!=='media' ? 'Share your words' : files.length ? `Share ${files.length} ${files.length === 1 ? 'photo' : 'photos'}` : 'Share photos'}</button>{result?.done.length > 0 && <button type="button" className="l-text l-wide" onClick={viewUploads}>{parentOnly ? 'View my moments' : 'View my uploads'} <ArrowUpRight size={16} /></button>}<p className="l-small">{parentOnly ? 'Remove anything later in Your moments.' : 'Remove anything later in My uploads.'}</p>{busy && <button type="button" className="l-text" onClick={() => abort.current?.abort()}>Stop upload</button>}
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
function Thanks({ photo, changed, compact = false, onOpen }) {
  const [thanked, setThanked] = useState(Boolean(photo.thanked));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setThanked(Boolean(photo.thanked)); }, [photo.thanked]);
  return <><button className={`l-text l-photo-thanks ${compact ? 'l-thumbnail-heart' : ''}`} aria-label={thanked ? 'Remove thanks' : 'Send thanks'} aria-pressed={thanked} disabled={busy} onClick={async () => {
    setBusy(true); setError('');
    try { await db.setThanks(photo.id, !thanked); trackActivity('reactions'); changed(photo.id, !thanked); setThanked(!thanked); }
    catch { setError('Your thanks could not be saved. Please try again.'); }
    finally { setBusy(false); }
  }}><Heart size={16} fill={thanked ? 'currentColor' : 'none'} />{!compact && (thanked ? 'Thanks sent' : 'Thanks for sharing')}</button>{error && <p className="l-error" role="alert">{error}</p>}</>;
}
const LOVE_REACTIONS=[['love','❤️','Love'],['celebrate','🎉','Celebrate'],['thanks','💙','Thank you'],['amazing','🤩','Amazing'],['bravo','👏','Bravo']];
const COMMENT_IDEAS=[['Those smiles 💙','Look at those smiles! 💙'],['Thank you!','Thank you for sharing this moment!'],['Cheering you on!','We’re cheering you on from home!'],['Making memories','Making memories they’ll never forget.'],['Our scholars 💙','Thank you for taking care of our scholars!']];
function commentName(){try{return localStorage.getItem('london-comment-name')||db.localProfile()?.displayName||'';}catch{return db.localProfile()?.displayName||'';}}
export function Conversation({photoId,sharePhoto,onUpload}) {
 const [thread,setThread]=useState({reactions:[],comments:[]});const [name,setName]=useState(commentName);const [body,setBody]=useState('');const [composing,setComposing]=useState(false);const [expanded,setExpanded]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [loading,setLoading]=useState(true);const input=useRef(null);
 useEffect(()=>{let active=true;setLoading(true);db.conversation(photoId).then(data=>{if(active)setThread(data);}).catch(()=>{if(active)setError('Couldn’t load responses. Try again.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[photoId]);
 async function actOn(action,values={}){setBusy(true);setError('');try{setThread(await db.conversation(photoId,action,values));if(action==='comment'){trackActivity('comments');setBody('');setComposing(false);try{if(name.trim())localStorage.setItem('london-comment-name',name.trim());}catch{}}if(action==='react')trackActivity('reactions');}catch{setError('Couldn’t save that response. Your words are still here. Please try again.');}finally{setBusy(false);}}
 function chooseIdea(text){setBody(text);setComposing(true);input.current?.focus();}
 function idea([label,text]){return <button type="button" key={label} disabled={busy} onClick={()=>chooseIdea(text)}>{label}</button>;}
 const comments=expanded?thread.comments:thread.comments.slice(-2);
 return <section className="l-conversation l-compact-conversation" aria-label="Reactions and comments">
  <div className="l-love-heading"><h3>A little love from home</h3>{sharePhoto&&<button type="button" className="l-text" aria-label="Share gallery link" title="Share gallery link" onClick={sharePhoto}><Share2 size={18}/><span>Share link</span></button>}</div>
  <div className="l-positive-reactions">{LOVE_REACTIONS.map(([id,emoji,label])=>{const reaction=thread.reactions.find(r=>r.reaction===id);return <button type="button" key={id} aria-label={label} title={label} aria-pressed={Boolean(reaction?.mine)} disabled={busy||loading} onClick={()=>actOn('react',{p_reaction:id})}><span aria-hidden="true">{emoji}</span>{reaction?.count>0&&<small>{reaction.count>=1000?`${Math.floor(reaction.count/1000)}k`:reaction.count}</small>}</button>;})}</div>
  <form onSubmit={e=>{e.preventDefault();if(body.trim())actOn('comment',{p_body:body.trim(),p_name:name.trim()||'A family from home'});}}>
   <div className="l-comment-suggestions" aria-label="Comment suggestions">{COMMENT_IDEAS.slice(0,2).map(idea)}<details><summary>More ideas</summary><div>{COMMENT_IDEAS.slice(2).map(idea)}</div></details></div>
   <textarea ref={input} aria-label="Leave a kind word" rows={composing?2:1} maxLength={500} placeholder="Leave a kind word…" value={body} onFocus={()=>setComposing(true)} onChange={e=>setBody(e.target.value)}/>
   {(composing||body)&&<div className="l-comment-send"><input aria-label="Your name (optional)" maxLength={60} value={name} onChange={e=>setName(e.target.value)} autoComplete="given-name" placeholder="First name (optional)"/><button type="submit" className="l-button" disabled={busy||loading||!body.trim()}>{busy?'Sending…':'Send love'}</button></div>}
  </form>
  {loading&&<p className="l-small" role="status">Loading responses…</p>}
  {!!comments.length&&<div className={`l-comment-list ${expanded?'is-expanded':''}`}>{comments.map(c=><article key={c.id}><b>{c.author_name}</b><p>{c.body}</p>{c.mine&&<button type="button" className="l-text" disabled={busy} onClick={()=>actOn('remove',{p_comment:c.id})}>Remove my comment</button>}</article>)}{(thread.comments.length>2||comments.some(c=>c.body.length>120))&&<button type="button" className="l-text" onClick={()=>setExpanded(!expanded)}>{expanded?'Show less':`Read all comments (${thread.comments.length})`}</button>}</div>}
  {error&&<p className="l-error" role="alert">{error}<button type="button" className="l-text" onClick={()=>actOn('read')}>Try again</button></p>}
  {onUpload&&<button type="button" className="l-text l-own-memory" onClick={onUpload}><Camera size={16}/> Share your own memory</button>}
 </section>;
}
function Photo({ photo, photos, owner, admin, close, navigate, hidden, initialRemove = false, sharePhoto, changed, onUpload }) {
  const [error, setError] = useState(''); const [confirm, setConfirm] = useState(initialRemove); const [busy, setBusy] = useState(false);
  const trackedPhoto=useRef(null);
  useEffect(()=>{if(photo?.id && trackedPhoto.current!==photo.id){trackedPhoto.current=photo.id;trackActivity('photoViews');}},[photo?.id]);
  const swipeStart = useRef(null);
  const viewer = useRef(null);
  useEffect(() => { viewer.current?.scrollIntoView?.({ block: 'nearest' }); }, [photo?.id]);
  if (!photo) return null;
  const index = photos.findIndex((p) => p.id === photo.id);
  const move = (step) => {
    const next = photos[index + step];
    if (index < 0 || !next) return;
    setConfirm(false); setError(''); navigate(next.id);
  };
  return <Dialog title={photo.caption || 'A postcard from the adventure'} close={close} onKeyDown={(event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), video, audio, [role="slider"]')) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    move(event.key === 'ArrowRight' ? 1 : -1);
  }}><div className="l-viewer" ref={viewer} onTouchStart={(e) => {
    if (photo.kind === 'video' || e.touches.length !== 1) { swipeStart.current = null; return; }
    swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }} onTouchCancel={() => { swipeStart.current = null; }} onTouchEnd={(e) => {
    const start = swipeStart.current; swipeStart.current = null;
    if (!start || !e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
  }}>{photo.kind === 'video' ? <video key={photo.id} src={db.mediaUrl(photo, 'playback')} preload="metadata" poster={db.mediaUrl(photo, 'thumb')} controls playsInline onPlay={()=>trackActivity('videoPlays')} /> : <img src={db.mediaUrl(photo)} alt={photo.caption || 'A moment from the class trip'} />}</div><nav className="l-photo-navigation" aria-label="Browse gallery"><button type="button" disabled={index <= 0} onClick={() => move(-1)}><ChevronLeft size={20}/> Previous</button><span aria-live="polite">{index >= 0 ? `${index + 1} of ${photos.length}` : ''}</span><button type="button" disabled={index < 0 || index >= photos.length - 1} onClick={() => move(1)}>Next <ChevronRight size={20}/></button></nav>{photo.kind==='video'?<SaveVideo key={photo.id} id={photo.id} url={db.mediaUrl(photo,'playback')}/>:<a className="l-text l-original-link" href={db.mediaUrl(photo, 'orig')} target="_blank" rel="noreferrer"><Download size={17}/> Original</a>}{photo.scholarName && <p className="l-scholar-credit">From <b>{photo.scholarName}</b></p>}<PhotoCredit photo={photo}/><Conversation key={photo.id} photoId={photo.id} sharePhoto={()=>sharePhoto(photo)} onUpload={onUpload} />{(photo.owner === owner || admin) && <div className="l-hide">{confirm ? <><p>Remove this photo from the shared album?</p><button className="l-button" disabled={busy} onClick={async () => { setBusy(true); try { await db.hidePhoto(photo.id, admin); hidden(); } catch (e) { setError(e.message); } finally { setBusy(false); } }}>Remove from album</button><button className="l-text" onClick={() => setConfirm(false)}>Keep it visible</button></> : <button className="l-text" onClick={() => setConfirm(true)}><Trash2 size={16} /> Remove from album</button>}</div>}{error && <p className="l-error" role="alert">{error}</p>}</Dialog>;
}
function Admin({ close, setAdmin }) {
  const [pass, setPass] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  return <Dialog title="Trip album admin" close={close}><form onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { if (!await db.checkPass(pass)) throw new Error('That passphrase was not recognized.'); setAdmin(pass); close(); } catch (e) { setError(e.message); } finally { setBusy(false); } }}><label className="l-field">Admin passphrase<input type="password" value={pass} onChange={(e) => setPass(e.target.value)} /></label><p className="l-small">Admins can remove any photo from the shared album. Chaperones can remove their own uploads without an admin passphrase.</p>{error && <p className="l-error" role="alert">{error}</p>}<button className="l-button" disabled={busy || !pass}>Open admin</button></form></Dialog>;
}
