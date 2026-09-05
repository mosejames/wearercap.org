import { useEffect, useState } from 'react';
import { rewardCall } from './rewards.js';
export const ACTIVITIES = [
 {id:'everyday',title:'Everyday Amistad',icon:'♡',description:'At home, at school, or out together. The little moments belong here, too.'},
 {id:'cheers',title:'House Cheers',icon:'♫',description:'Cheers, chants, and all our house spirit.'},
 {id:'exp',title:'EXP',icon:'✦',description:'Our EXP moments, kept together.'},
 {id:'clubs',title:'Clubs',icon:'✺',description:'Creating, learning, and doing what we love together.'},
 {id:'sports',title:'Sports & Games',icon:'◉',description:'On the court, in the stands, and cheering each other on.'},
];
export function SuggestionForm({profile,onSignIn,onDone}) {
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[date,setDate]=useState(''),[ongoing,setOngoing]=useState(false),[category,setCategory]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
 if(sent)return <div className="stack"><h3>Thank you for the idea!</h3><p>Your suggestion is with the admin team. They’ll create an album or match it with one we already have.</p><button className="btn primary" onClick={onDone}>Back to the memories</button></div>;
 return <form className="stack" onSubmit={async e=>{e.preventDefault();if(!profile){onSignIn();return;}setBusy(true);setError('');try{await rewardCall('vault_suggest_event',{p_title:title,p_description:description,p_date:date||null,p_ongoing:ongoing,p_category:category||null});setSent(true);}catch(ex){setError(ex.message);}finally{setBusy(false);}}}>
 <p>Missing a place for your memories? Tell us your idea. Our admin team will review it before adding a gallery.</p>
 <label className="field"><span>Event or activity name</span><input required minLength={3} maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="For example, Friday basketball game"/></label>
 <label className="row"><input type="checkbox" checked={ongoing} onChange={e=>setOngoing(e.target.checked)}/>Ongoing activity, not one date</label>
 {!ongoing&&<label className="field"><span>Date</span><input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>}
 <label className="field"><span>Where might it fit?</span><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Not sure / another event</option>{ACTIVITIES.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
 <label className="field"><span>A little about it</span><textarea rows={3} maxLength={400} value={description} onChange={e=>setDescription(e.target.value)}/></label>
 {error&&<p className="err">{error}</p>}<button className="btn primary" disabled={busy}>{busy?'Sending…':profile?'Send idea for review':'Sign in to send your idea'}</button></form>;
}
export function SuggestionReview({events,pass,onChanged}) {
 const [items,setItems]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[categories,setCategories]=useState({}),[targets,setTargets]=useState({});
 const load=()=>rewardCall('vault_event_suggestions',{p_pass:pass}).then(setItems).catch(e=>setError(e.message));
 useEffect(()=>{load();},[pass]);
 const review=async(s,action)=>{setBusy(true);setError('');try{await rewardCall('vault_review_event_suggestion',{p_id:s.id,p_action:action,p_event:targets[s.id]||null,p_category:categories[s.id]??s.category??(s.ongoing?'everyday':null),p_pass:pass});await load();onChanged();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="adm-sec"><h2>Suggested events</h2><p>Approve a new album, match an existing gallery, or dismiss an idea. Approved albums appear automatically.</p>{error&&<p className="err">{error}</p>}{!items.length?<p className="fine">No ideas waiting for review.</p>:items.map(s=><article className="suggestion-card stack" key={s.id}><h3>{s.title}</h3><p className="fine">From {s.name} · {s.ongoing?'Ongoing':s.starts_on}</p><p>{s.description}</p><label className="field"><span>Category for new album</span><select value={categories[s.id]??s.category??(s.ongoing?'everyday':'')} onChange={e=>setCategories(c=>({...c,[s.id]:e.target.value}))}>{!s.ongoing&&<option value="">Event albums</option>}{ACTIVITIES.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><div className="row"><button className="btn small primary" disabled={busy} onClick={()=>review(s,'approve')}>Approve new album</button><button className="link" disabled={busy} onClick={()=>review(s,'dismiss')}>Dismiss</button></div><label className="field"><span>Or use an existing gallery</span><select value={targets[s.id]||''} onChange={e=>setTargets(t=>({...t,[s.id]:e.target.value}))}><option value="">Choose gallery</option>{events.filter(e=>!e.hidden).map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label><button className="btn small ghost" disabled={busy||!targets[s.id]} onClick={()=>review(s,'link')}>Match to this gallery</button></article>)}</section>;
}

export function GalleryVisibility({pass,onChanged}) {
 const [galleries,setGalleries]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const load=()=>rewardCall('vault_additional_galleries',{p_pass:pass}).then(setGalleries);
 useEffect(()=>{load().catch(e=>setError(e.message));},[pass]);
 const toggle=async(g)=>{setBusy(true);setError('');try{await rewardCall('vault_set_gallery_visibility',{p_id:g.id,p_visible:g.hidden,p_pass:pass});await load();onChanged();}catch(e){setError(e.message);}finally{setBusy(false);}};
 return <section className="adm-sec"><h2>Additional galleries</h2><p>Choose which ongoing galleries families can see and upload to. Turning one off preserves its photos and videos. Switch it back on whenever you’re ready.</p>{error&&<p className="err" role="alert">{error}</p>}<div className="gallery-switches">{galleries.map(g=><label className="gallery-switch-row" key={g.id}><span><b>{g.title}</b><small>{g.hidden?'Hidden from the Vault':'Visible in the Vault'}</small></span><input type="checkbox" role="switch" aria-label={`Show ${g.title}`} checked={!g.hidden} disabled={busy} onChange={()=>toggle(g)}/></label>)}</div></section>;
}
