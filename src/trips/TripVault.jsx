import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Camera, ChevronDown, ChevronLeft, ChevronRight, Heart, Images, MapPin, Plus, Share2, X } from 'lucide-react';
import { dayOf, visiblePhotos } from './config.js';
import { preparePreview } from './preview.js';
import { newestCapturedFirst } from '../london/timeline.js';
function Select({ label, children, ...props }) { return <label className="filter"><span>{label}</span><span className="select-wrap"><select {...props}>{children}</select><i aria-hidden="true"><ChevronDown size={19}/></i></span></label>; }
function Modal({ title, close, children }) {
    const ref = useRef(null), titleId = useId();
    useEffect(() => { const previous = document.activeElement; ref.current.showModal(); return () => { ref.current?.close(); previous?.focus?.(); }; }, []);
    return <dialog ref={ref} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === ref.current)
        close(); }}><button className="close icon" aria-label="Close" onClick={close}><X /></button><h2 id={titleId}>{title}</h2>{children}</dialog>;
}
function Viewer({ photos, id, close, update, trip }) {
    const index = photos.findIndex(p => p.id === id), photo = photos[index], touch = useRef(null);
    const [current, setCurrent] = useState(id), [draft, setDraft] = useState(''), [name, setName] = useState('');
    const pos = photos.findIndex(p => p.id === current), p = photos[pos] || photo;
    function move(delta) { const next = photos[pos + delta]; if (next) {
        setCurrent(next.id);
        setDraft('');
    } }
    useEffect(() => { function key(e) { if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.target.closest('input,textarea,select,video,[contenteditable]'))
        return; if (e.key === 'ArrowRight') {
        e.preventDefault();
        move(1);
    } if (e.key === 'ArrowLeft') {
        e.preventDefault();
        move(-1);
    } } window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [pos, photos]);
    if (!p)
        return null;
    return <Modal title="A little window into their adventure" close={close}><div className="viewer-photo" onTouchStart={e => { touch.current = [e.touches[0].clientX, e.touches[0].clientY]; }} onTouchEnd={e => { if (!touch.current)
        return; const [x, y] = touch.current; touch.current = null; const dx = e.changedTouches[0].clientX - x, dy = e.changedTouches[0].clientY - y; if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5)
        move(dx < 0 ? 1 : -1); }}><img src={p.web} alt={p.caption || 'A locally selected NYC preview photo'}/></div><div className="viewer-nav"><button className="icon" aria-label="Previous photo" disabled={pos <= 0} onClick={() => move(-1)}><ChevronLeft /></button><span>{pos + 1} / {photos.length}</span><button className="icon" aria-label="Next photo" disabled={pos >= photos.length - 1} onClick={() => move(1)}><ChevronRight /></button></div><p>{p.caption}</p><p className="muted">Shared by {p.contributor}{p.scholar ? ` · Scholar: ${p.scholar}` : ''}{p.place ? ` · ${trip.places.find(v => v.id === p.place)?.name}` : ''}</p><a className="text-link" href={p.web} download={`nyc-${p.id}.jpg`}>Download photo</a><div className="reactions">{['❤️ Love', '🎉 Celebrate', '💙 Thanks', '🤩 Amazing', '👏 Bravo'].map(reaction => <button key={reaction} aria-pressed={p.reactions.includes(reaction)} onClick={() => update(p.id, { reactions: p.reactions.includes(reaction) ? p.reactions.filter(r => r !== reaction) : [...p.reactions, reaction] })}>{reaction}</button>)}</div><form onSubmit={e => { e.preventDefault(); if (draft.trim()) {
        update(p.id, { comments: [...p.comments, { name: name.trim() || 'A family from home', text: draft.trim() }] });
        setDraft('');
    } }}><label>Your first name (optional)<input value={name} maxLength={40} onChange={e => setName(e.target.value)}/></label><label>Send a little love<textarea value={draft} maxLength={500} required onChange={e => setDraft(e.target.value)}/></label><div className="chips">{['What a wonderful moment!', 'Thank you for sharing this!'].map(s => <button type="button" key={s} onClick={() => setDraft(s)}>{s}</button>)}</div><button className="primary" type="submit">Add preview comment</button></form><div className="comments">{p.comments.map((c, i) => <p key={i}><strong>{c.name}</strong><br />{c.text}</p>)}</div><p className="muted small">Reactions and comments stay in this preview session.</p></Modal>;
}
export default function TripVault({ trip }) {
    const [photos, setPhotos] = useState([]), [day, setDay] = useState(''), [place, setPlace] = useState(''), [limit, setLimit] = useState(60), [modal, setModal] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
    const [files, setFiles] = useState([]), [contributor, setContributor] = useState(''), [scholar, setScholar] = useState(''), [caption, setCaption] = useState(''), [uploadPlace, setUploadPlace] = useState('');
    const urls = useRef([]);
    useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), []);
    const shown = useMemo(() => visiblePhotos(photos, { day, place }, trip).sort(newestCapturedFirst), [photos, day, place, trip]);
    const days = [...new Set(photos.map(p => dayOf(p, trip)).filter(Boolean))].sort();
    function update(id, values) { setPhotos(all => all.map(p => p.id === id ? { ...p, ...values } : p)); }
    function filterDay(value) { setDay(value); setLimit(60); }
    function filterPlace(value) { setPlace(value); setLimit(60); }
    async function add(e) { e.preventDefault(); setBusy(true); setNotice('Preparing your photos…'); try {
        const { prepareImage } = await import('../vault/images.js');
        const result = await preparePreview(files, photos, { contributor: contributor.trim(), scholar: scholar.trim(), caption: caption.trim(), place: uploadPlace }, prepareImage);
        urls.current.push(...result.photos.flatMap(p => [p.web, p.thumb]));
        setPhotos(all => [...all, ...result.photos]);
        setNotice(`${result.photos.length} photo${result.photos.length === 1 ? '' : 's'} added to this preview. ${result.skipped ? `${result.skipped} duplicate${result.skipped === 1 ? '' : 's'} skipped. ` : ''}${result.errors.join(' ')}`);
        if (result.photos.length) {
            setFiles([]);
            setModal('thanks');
        }
    }
    catch {
        setNotice('The photos could not be prepared. Please try again.');
    }
    finally {
        setBusy(false);
    } }
    return <><div className="preview-bar">DESIGN PREVIEW <span>Photos stay in this tab. Shared uploads are coming.</span></div><header><a href="#" className="brand"><img src="/london/ron-clark-academy.png" alt="Ron Clark Academy"/><span>{trip.grade}<b>NEW YORK CITY</b></span></a><button className="text-link" onClick={() => setModal('invite')}><Share2 size={17}/> Invite families</button></header><main>{photos.length > 0 && <section className="recent"><div className="section-head"><h2>Just shared</h2><a href="#gallery">See all photos <ArrowUpRight size={16}/></a></div><div className="recent-grid">{[...photos].sort(newestCapturedFirst).slice(0, 4).map(p => <button key={p.id} onClick={() => { filterDay(''); filterPlace(''); setModal(p.id); }}><img src={p.thumb} alt={p.caption || 'Recently shared preview photo'}/></button>)}</div></section>}<section className="intro"><p className="eyebrow">{trip.dateLabel} · NEW YORK</p><div className="intro-row"><div><h1>Small moments.<br /><em>Big city.</em></h1><p className="lede">Their adventure. Our postcards.<br />A little window into sixth grade’s New York story.</p></div><div className="intro-actions"><button className="primary" onClick={() => setModal('upload')}><Plus size={20}/> Add photos</button><button className="text-link" onClick={() => setModal('video')}>Have a video? <ArrowUpRight size={17}/></button></div></div></section><section id="gallery"><div className="section-head"><div><p className="eyebrow">ONE TRIP. MANY PERSPECTIVES.</p><h2>The shared album <span className="count">{photos.length}</span></h2></div><Images size={26} strokeWidth={1.2}/></div><div className="filters"><Select label="Day" value={day} onChange={e => filterDay(e.target.value)}><option value="">All days</option>{days.map(d => <option key={d}>{d}</option>)}</Select><Select label="Place" value={place} onChange={e => filterPlace(e.target.value)}><option value="">All places</option>{trip.places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>{(day || place) && <button className="text-link" onClick={() => { filterDay(''); filterPlace(''); }}>Clear filters</button>}</div>{!shown.length ? <div className="empty"><span className="empty-icon"><Camera size={31} strokeWidth={1.3}/></span><h3>{photos.length ? 'No photos match these filters.' : 'The first postcard could be yours.'}</h3><p>{photos.length ? 'Try another day or place.' : 'Airport smiles, city discoveries, the little moments between.'}<br />Capture now. Add photos whenever you have a quiet minute.</p><button className="primary" onClick={() => setModal('upload')}>Try adding photos <ArrowUpRight size={18}/></button><small>Preview only. Selected photos disappear when this tab reloads.</small></div> : <div className="gallery">{shown.slice(0, limit).map((p, i) => <div className="photo-cell" key={p.id}>{(i === 0 || dayOf(p, trip) !== dayOf(shown[i - 1], trip)) && <h3>{dayOf(p, trip) || 'Date unknown'}</h3>}<div className="tile"><button className="open-photo" onClick={() => setModal(p.id)}><img loading="lazy" src={p.thumb} alt={p.caption || `Photo shared by ${p.contributor}`}/></button><button className="heart" aria-label={p.thanks ? 'Undo thanks' : 'Thank this contributor'} aria-pressed={p.thanks} onClick={() => update(p.id, { thanks: !p.thanks })}><Heart size={23} fill={p.thanks ? 'white' : 'none'}/></button></div></div>)}</div>}{shown.length > limit && <button className="primary" onClick={() => setLimit(n => n + 60)}>More photos</button>}</section><section className="places"><MapPin size={20}/><div><h3>A few places in their story</h3><p>{trip.places.map(p => p.name).join(' · ')}</p><small>Reported by a chaperone. The dated itinerary is still to come.</small></div></section><section className="welcome"><h2>Being there is enough.</h2><p>Chaperones, thank you for being with our scholars. A quick photo when it feels right is a gift to families at home. No perfect takes required.</p></section><footer><span>RCA Takes New York · Sixth Grade</span><span>October 21–23, 2026</span></footer></main><div role="status" className={notice ? 'notice' : ''}>{notice}</div>{modal === 'upload' && <Modal title="Share a little of their day" close={() => { if (!busy)
        setModal(''); }}><p>Choose a few photos. Try the flow here before the shared vault opens.</p><form onSubmit={add}><label>Your name<input value={contributor} required maxLength={60} onChange={e => setContributor(e.target.value)}/></label><label>Scholar’s first name (optional)<input value={scholar} maxLength={40} onChange={e => setScholar(e.target.value)}/></label><Select label="Place (optional)" value={uploadPlace} onChange={e => setUploadPlace(e.target.value)}><option value="">Little moments along the way</option>{trip.places.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</Select><label>A few words (optional)<textarea maxLength={500} value={caption} onChange={e => setCaption(e.target.value)}/></label><label className="file-input">Choose photos<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple required onChange={e => setFiles(Array.from(e.target.files).slice(0, 60))}/></label><p className="muted small">Up to 60 photos, 50 MB each. Duplicate files are skipped. Photos stay in this tab and are never uploaded.</p><button className="primary" disabled={busy || !files.length || !contributor.trim()}>{busy ? 'Preparing photos…' : `Add ${files.length || ''} to preview`}</button></form></Modal>}{modal === 'thanks' && <Modal title="A little window, a lot of joy." close={() => setModal('')}><p>Your photos are ready to explore in this preview. Families will be able to browse and send a little love when the shared vault opens.</p><button className="primary" onClick={() => setModal('')}>See the photos</button><p className="muted">Nothing has been uploaded or shared.</p></Modal>}{modal === 'video' && <Modal title="Keep those little videos" close={() => setModal('')}><p>Save the original on your phone for now. The NYC video contribution link is being arranged.</p><p>Short clips are lovely. There’s no need to upload while you’re with the scholars.</p></Modal>}{modal === 'invite' && <Modal title="Bring families into the story" close={() => setModal('')}><p>The NYC vault is in design preview. A shareable family invitation will be available after the vault is approved and published.</p></Modal>}{photos.some(p => p.id === modal) && <Viewer key={modal} photos={shown} id={modal} close={() => setModal('')} update={update} trip={trip}/>}</>;
}
