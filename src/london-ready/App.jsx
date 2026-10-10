import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowUpRight, Check, Trash2 } from 'lucide-react';
const Conversation = lazy(() => import('../london/App.jsx').then(module=>({default:module.Conversation})));
const Upload = lazy(() => import('../london/App.jsx').then(module => ({ default: module.Upload })));
import * as db from '../london/data.js';
import { PREP } from '../london/config.js';
import '../london/london.css';
import './ready.css';
export const IDEAS = [
 { id: 'most-excited', prompt: 'What’s the first thing you want to do in London?' },
 { id: 'packing-bags', prompt: 'What’s going in your suitcase that absolutely has to come?' },
 { id: 'dreaming-of-london', prompt: 'What do you think London will be like?' },
 { id: 'most-excited', prompt: 'What are you most excited to see in Paris?' },
 { id: 'packing-bags', prompt: 'Be honest. Is the bag packed yet?' },
 { id: 'most-excited', prompt: 'Which British or French food would you try first?' },
 { id: 'dreaming-of-london', prompt: 'What do you think Versailles will be like?' },
 { id: 'most-excited', prompt: 'What adventure are you hoping to have with your friends?' },
 { id: 'most-excited', prompt: 'What’s one wish you’d tuck into your traveler’s suitcase?' },
];
export function shuffleIdeas() {
 const deck=[...IDEAS];
 for(let i=deck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
 return deck;
}
export default function Ready() {
 const [deck]=useState(shuffleIdeas); const [page,setPage]=useState(0);
 const [events,setEvents]=useState([]), [profile,setProfile]=useState(db.localProfile), [upload,setUpload]=useState(null), [photos,setPhotos]=useState([]), [owner,setOwner]=useState(''), [error,setError]=useState(''), [notice,setNotice]=useState(''), [removing,setRemoving]=useState(''), [confirming,setConfirming]=useState('');
 async function refresh() { try {const [albums,images,me]=await Promise.all([db.listEvents(),db.listPhotos(),db.getOwner()]);setEvents(albums.filter(e=>e.slug===PREP.slug));setPhotos(images.filter(p=>p.eventId===albums.find(e=>e.slug===PREP.slug)?.id && p.owner===me));setOwner(me);setError('');} catch {setError('We couldn’t open sharing just yet. Please try again.');} }
 useEffect(()=>{refresh();},[]);
 async function remove(p) {setRemoving(p.id);try {await db.hidePhoto(p.id);await refresh();setConfirming('');}catch {setError('That moment could not be removed. Please try again.');}finally{setRemoving('');}}
 return <div className="ready"><header className="ready-header"><img src="/london/ron-clark-academy.png" alt="The Ron Clark Academy" width="520" height="120"/><span>CLASS OF 2028<br/><small>LONDON + PARIS</small></span></header>
 <main><section className="ready-question" aria-labelledby="question-title"><p className="ready-kicker">LONDON IS ALMOST HERE.</p><h1 id="question-title">A little question<br/>for your traveler.</h1><p className="ready-hello">Answer one or all. Start wherever you like.</p><div className="ready-choices">{deck.slice(page*3,page*3+3).map(idea=><button key={idea.prompt} onClick={()=>setUpload({inspiration:idea.id,prompt:idea.prompt})}><span>{idea.prompt}</span><ArrowUpRight size={23}/></button>)}</div><button className="ready-more" onClick={()=>setPage(p=>(p+1)%3)}>Try three more ↻</button><p className="ready-easy">Answer with a photo, a video, or a few words.<br/>No perfect takes. Just a little of the excitement.</p></section>
 {notice&&<p role="status" className="ready-notice"><Check size={18}/>{notice}</p>}{error&&<p role="alert" className="l-error">{error} <button className="l-text" onClick={refresh}>Try again</button></p>}
 {photos.length>0&&<section className="ready-mine" id="my-moments"><p className="ready-kicker">FROM YOUR FAMILY</p><h2>Your moments.</h2><p>A little of your getting-ready excitement. You can remove anything here on this device.</p><div className="ready-mine-grid">{photos.map(p=><article key={p.id}>{p.kind==='video'?<video controls playsInline preload="metadata" poster={db.mediaUrl(p)} src={db.mediaUrl(p,'orig')}/>:<img src={db.mediaUrl(p)} alt={p.caption||'Your getting-ready moment'}/>}<p>{p.caption||'Getting ready for London'}</p><details><summary>React or comment</summary><Suspense fallback={<p>Loading responses…</p>}><Conversation photoId={p.id}/></Suspense></details>{p.owner===owner&&<button className="l-text" disabled={removing===p.id} onClick={()=>confirming===p.id?remove(p):setConfirming(p.id)}><Trash2 size={15}/>{removing===p.id?'Removing…':confirming===p.id?'Confirm removal':'Remove my upload'}</button>}</article>)}</div></section>}
 </main><footer className="ready-footer"><b>RON CLARK ACADEMY · CLASS OF 2028</b><span>A little excitement, shared.</span></footer>
 {upload&&<Suspense fallback={<p role="status" className="ready-notice">Opening sharing…</p>}><Upload parentOnly events={events} initialAlbum={PREP.slug} initialPrompt={upload.prompt||''} initialInspiration={upload.inspiration||''} profile={profile} setProfile={setProfile} close={()=>setUpload(null)} done={()=>{refresh();setNotice('Love it. Thanks for sharing a little of the excitement!');}} viewUploads={()=>{setUpload(null);document.getElementById('my-moments')?.scrollIntoView({behavior:'smooth'});}}/></Suspense>}</div>;
}
