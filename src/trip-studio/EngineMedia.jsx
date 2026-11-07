import {useEffect,useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {usesGroups} from '../trip-engine/groups.js';
import {authClient} from './client.js';
export async function engineAdmin(slug,action,payload={}){
 const {data,error}=await authClient().auth.getSession();if(error)throw error;if(!data.session)throw Error('Sign in to manage this trip.');
 const r=await fetch(`/api/trip-engine?trip=${encodeURIComponent(slug)}`,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({action,...payload})});const value=await r.json();if(!r.ok)throw Error(value.error||'Could not update this trip.');return value;
}
const PAGE_SIZE = 24;
const FETCH_SIZE = 100;

export default function EngineMedia({live, groups, onError}) {
 const [photos, setPhotos] = useState([]);
 const [busy, setBusy] = useState(false);
 const [loaded, setLoaded] = useState(false);
 const [revision, refresh] = useState(0);
 const [query, setQuery] = useState('');
 const [state, setState] = useState('visible');
 const [album, setAlbum] = useState('');
 const [page, setPage] = useState(0);
 const [notice, setNotice] = useState('');
 const grouped = usesGroups({slug: live.slug, groups});

 useEffect(() => {
  let active = true;
  async function load() {
   setBusy(true);
   setLoaded(false);
   try {
    const first = await engineAdmin(live.slug, 'moderation', {offset: 0});
    const records = new Map(first.photos.map(photo => [photo.id, photo]));
    for (let offset = FETCH_SIZE; active && offset < first.count; offset += FETCH_SIZE) {
     const result = await engineAdmin(live.slug, 'moderation', {offset});
     result.photos.forEach(photo => records.set(photo.id, photo));
    }
    if (active) {
     setPhotos([...records.values()]);
     setLoaded(true);
    }
   } catch (error) {
    if (active) onError(error.message);
   } finally {
    if (active) setBusy(false);
   }
  }
  load();
  return () => { active = false; };
 }, [live.slug, onError, revision]);

 async function update(action, body, message) {
  setBusy(true);
  setNotice('');
  try {
   await engineAdmin(live.slug, action, body);
   setPhotos(current => current.map(photo => {
    if (photo.id !== body.id) return photo;
    if (action === 'set-group') return {...photo, group: body.group};
    return {...photo, state: body.hidden ? 'hidden' : 'visible'};
   }));
   setNotice(message);
  } catch (error) {
   onError(error.message);
  } finally {
   setBusy(false);
  }
 }

 const search = query.trim().toLowerCase();
 const matching = photos.filter(photo =>
  (!state || photo.state === state) &&
  (!album || photo.album === album) &&
  (!search || photo.contributor?.toLowerCase().includes(search) || photo.id.toLowerCase() === search)
 );
 const currentPage = Math.min(page, Math.max(0, Math.ceil(matching.length / PAGE_SIZE) - 1));
 const start = currentPage * PAGE_SIZE;
 const visible = matching.slice(start, start + PAGE_SIZE);

 function filter(label, value, options, change, disabled = false) {
  return <label>{label}<span className="studio-select">
   <select value={value} disabled={disabled} onChange={event => change(event.target.value)}>
    {options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
   </select>
   <span aria-hidden="true"><ChevronDown size={20}/></span>
  </span></label>;
 }

 return <section className="studio-panel">
  <span className="studio-kicker">THIS TRIP ONLY</span>
  <h2>Gallery moderation {loaded && `· ${photos.length}`}</h2>
  <p className="studio-hint">Remove from gallery hides a photo from families. To bring it back, open Hidden photos and choose Restore photo. The original file stays in storage.</p>
  <div className="studio-moderation-filters">
   <label>Search by contributor or photo ID<input type="search" value={query} placeholder="Search photos" onChange={event => {setQuery(event.target.value); setPage(0);}}/></label>
   {filter('Visibility', state, [['visible','Visible photos'],['hidden','Hidden photos'],['','All photos']], value => {setState(value); setPage(0);})}
   {filter('Album', album, [['','All albums'],['send-off','Send-off'],['the-whole-adventure','Trip album']], value => {setAlbum(value); setPage(0);})}
  </div>
  {notice && <p role="status">{notice}</p>}
  {!loaded && <p role="status">{busy ? 'Loading trip photos…' : 'Could not load photos. Try refreshing.'}</p>}
  {loaded && <p role="status">{matching.length ? `Showing ${start + 1}–${start + visible.length} of ${matching.length} photos` : 'No photos match these filters.'}</p>}
  {loaded && <div className="studio-moderation-grid">
   {visible.map(photo => <article key={photo.id}>
    <a href={photo.web} target="_blank" rel="noreferrer" aria-label={`View photo shared by ${photo.contributor}`}>
     <img src={photo.thumb} alt={`Shared by ${photo.contributor}`} loading="lazy"/>
    </a>
    <b>{photo.contributor}</b>
    <small>{photo.album === 'send-off' ? 'Send-off' : 'Trip album'} · {photo.state}</small>
    {grouped && filter('Photo group', photo.group, [...new Set([...groups, photo.group])].map(group => [group, group]), group => {
     if (!busy) update('set-group', {id: photo.id, group}, 'Photo group updated.');
    }, busy)}
    <button disabled={busy} onClick={() => update('admin-photo', {id: photo.id, hidden: photo.state !== 'hidden'}, photo.state === 'hidden' ? 'Photo restored.' : 'Photo removed from the shared gallery.')}>
     {photo.state === 'hidden' ? 'Restore photo' : 'Remove from gallery'}
    </button>
   </article>)}
  </div>}
  <div className="studio-row">
   <button disabled={busy || currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button>
   <button disabled={busy || start + PAGE_SIZE >= matching.length} onClick={() => setPage(currentPage + 1)}>Next</button>
   <button disabled={busy} onClick={() => refresh(value => value + 1)}>Refresh photos</button>
  </div>
 </section>;
}
