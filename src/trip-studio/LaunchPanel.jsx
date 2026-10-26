import {useEffect,useState} from 'react';
import {Check,ExternalLink,LockKeyhole,Rocket} from 'lucide-react';
import {PHASES,readiness} from './model.js';
export default function LaunchPanel({draft,live,revision,dirty,local,request,onResult,onError,onBusy}){
 const [reviewed,setReviewed]=useState(false),[phase,setPhase]=useState(live?.phase||'Send-off'),[busy,setBusy]=useState(false),[confirmPrivate,setConfirmPrivate]=useState(false);
 useEffect(()=>{if(live?.phase)setPhase(live.phase);},[live?.phase]);
 const missing=readiness(draft),url=live?new URL(`/trips/${live.slug}/`,location.origin).href:'';
 async function action(name,extra={}){
  if(busy||local)return;setBusy(true);onBusy(true);onError('');
  try{const result=await request('POST',{action:name,id:draft.id,revision,version:live?.version||0,...extra});onResult(result.registry);setReviewed(false);setConfirmPrivate(false);}catch(e){onError(e.message);}finally{setBusy(false);onBusy(false);}
 }
 return <section className="studio-panel studio-launch"><span className="studio-kicker">SHARED VAULT ENGINE</span><h2>{live?.published?'Your family link is live.':'Ready when you are.'}</h2>
 {live?.published&&<><div className="studio-row"><span className="studio-badge"><Check size={13}/>Live · {live.phase}</span><span>{live.count.toLocaleString()} visible photos</span></div><p className="studio-link-proposal"><a href={url} target="_blank" rel="noreferrer">{url}<ExternalLink size={15}/></a></p><p className="studio-hint">Your public vault uses its last published settings. Saving draft edits leaves the family experience unchanged until you publish them.</p></>}
 {!live?.published&&<p>Launch one shared gallery with this trip’s branding, groups, photo intake, conversations and exact-photo sharing. London and NYC keep their own apps.</p>}
 {missing.length>0&&<><b>Finish before launch</b><ul className="studio-checklist">{missing.map(m=><li key={m}><span/>{m}</li>)}</ul></>}
 <div className="studio-boundary"><LockKeyhole size={18}/><div><b>{draft.destination||'This trip'} · {draft.cohort?`Class of ${draft.cohort}`:'Cohort needed'}</b><p>{draft.start&&draft.end?`${draft.start} to ${draft.end}`:'Dates needed'} · {draft.timezone||'Timezone needed'}</p></div></div>
 {dirty&&<p className="studio-hint">Save your draft changes before publishing.</p>}
 <label className="studio-check"><input type="checkbox" checked={reviewed} disabled={busy||local||dirty||missing.length>0} onChange={e=>setReviewed(e.target.checked)}/><span>I reviewed the trip details, logo and share preview.</span></label>
 <button className="studio-primary" disabled={busy||local||dirty||!reviewed||missing.length>0} onClick={()=>action('publish')}><Rocket size={17}/>{busy?'Updating…':live?.published?'Publish saved changes':live?'Make trip public again':'Launch trip'}</button>
 {local&&<p className="studio-hint">Launching requires the online administrator workspace. Local drafts cannot publish.</p>}
 {live?.published&&<><div className="studio-rule"/><h3>Move the trip forward</h3><div className="studio-phases">{PHASES.filter(p=>p!=='Draft').map(p=><button key={p} disabled={busy||p==='Send-off'&&!draft.features.sendoff} aria-pressed={phase===p} onClick={()=>setPhase(p)}>{p}</button>)}</div><button disabled={busy||phase===live.phase} onClick={()=>action('phase',{phase})}>Apply {phase.toLowerCase()} phase</button><p className="studio-hint">The family link stays the same. Old send-off links use regular intake after send-off. Archive closes new uploads.</p><button className="studio-quiet" onClick={()=>setConfirmPrivate(!confirmPrivate)}>Make the trip private</button>{confirmPrivate&&<div className="studio-alert"><p>This closes public viewing, uploads and fresh share previews. Photos stay saved for a later relaunch.</p><button disabled={busy} onClick={()=>action('unpublish')}>Confirm private</button><button disabled={busy} onClick={()=>setConfirmPrivate(false)}>Keep it live</button></div>}</>}
 </section>;
}
