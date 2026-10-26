import React,{useState} from 'react';
import {consoleCall} from './api';
import {easternDeadline} from './countdown';
import {easternDay,issueStage} from './workspaceModel';
import './lifecycle.css';
const stamp=value=>new Date(value).toLocaleString('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'});
const localNow=()=>easternDay()+'T'+new Date().toLocaleTimeString('en-GB',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit'});
export default function IssueLifecycle({issue,plan={},onChange,disabled=false}){
 const [sending,setSending]=useState(false),[date,setDate]=useState(localNow),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function act(action,payload={}){setBusy(true);setError('');try{const result=await consoleCall(action,{issueId:issue.id,...payload});await onChange?.(result.plan);setSending(false);}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section className="nl-life" aria-label={'Newsletter status for '+issue.title}>
  <p><strong>{issueStage(issue,plan)}</strong>{plan.sentAt&&<> · Email sent {stamp(plan.sentAt)} Eastern</>}</p>
  <p className="nl-note">{plan.isTemplate?'Reusable template. Make a copy to create a newsletter.':plan.archivedAt?'Saved in Archive. You can restore it anytime.':'After you send through Gmail, record it here. Copying or publishing never marks an email sent.'}</p>
  <div className="nl-actions">
   {!plan.isTemplate&&!plan.archivedAt&&!plan.sentAt&&<button disabled={busy||disabled} onClick={()=>{setDate(localNow());setSending(true);}}>Mark as sent</button>}
   {plan.sentAt&&!plan.archivedAt&&<button disabled={busy||disabled} onClick={()=>act('lifecycle',{operation:'unsent'})}>Undo sent status</button>}
   {plan.archivedAt?<button disabled={busy||disabled} onClick={()=>act('lifecycle',{operation:'restore'})}>Restore newsletter</button>:plan.isTemplate?<button disabled={busy||disabled} onClick={()=>act('lifecycle',{operation:'draft'})}>Change template to draft</button>:<>
    <button disabled={busy||disabled} onClick={()=>act('lifecycle',{operation:'archive'})}>Archive newsletter</button>
    {!plan.sentAt&&issue.status!=='published'&&<button disabled={busy||disabled} onClick={()=>act('lifecycle',{operation:'template'})}>Keep as template</button>}
   </>}
  </div>
  {sending&&<form onSubmit={e=>{e.preventDefault();const when=easternDeadline(date);if(!Number.isFinite(when)||when>Date.now()){setError('Choose the time you already sent this email.');return;}act('sent',{sentAt:new Date(when).toISOString()});}}>
   <label>When did you send it? · Eastern<input type="datetime-local" value={date} required onChange={e=>setDate(e.target.value)}/></label>
   <p className="nl-note">This records your Gmail send. It does not send another email.</p>
   <div className="nl-actions"><button disabled={busy||disabled} type="submit">Confirm sent</button><button type="button" disabled={busy} onClick={()=>setSending(false)}>Cancel</button></div>
  </form>}
  {issue.status==='published'&&<p className="nl-note">Website: published. Archiving only tidies this workspace; the web page stays available.</p>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
