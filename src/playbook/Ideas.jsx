import React,{useEffect,useRef,useState} from 'react';
import {Plus,ArrowUpRight,MessageCircle,X} from 'lucide-react';
import {PS} from './data.js';
export const IDEA_KINDS=['Idea','Question','Lesson','Proposed date','Confirmed date','Recurring reminder'];
export const IDEA_STATUSES=['Open for discussion','Exploring','Ready for a decision','Agreed','Revisit later'];
const day=value=>new Date(value+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
export function IdeaForm({initial,name,setName,isLead,userId,onSubmit,onClose}) {
 const [form,setForm]=useState(()=>({...initial,content:initial?.content||'',kind:!isLead&&initial?.kind==='Confirmed date'?'Proposed date':initial?.kind||'Idea',status:!isLead&&initial?.status==='Agreed'?'Exploring':initial?.status||'Open for discussion',event_date:initial?.event_date||'',timeframe:initial?.timeframe||'',context:initial?.context||'',involve:initial?.involve||'',sections:initial?.sections||[]}));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const field=(key,value)=>setForm(f=>({...f,[key]:value}));
 const own=!initial||initial.author_id===userId;
 return <form className="pb-modal-form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await onSubmit({...form,author_name:name.trim()});onClose();}catch(e){setError(e.message);}finally{setBusy(false);}}}>
 <span className="pb-eyebrow">ROOM FOR WHAT COMES NEXT</span><h2>{initial?'Let this thought grow.':'Capture something.'}</h2><p>A first thought is enough. Add details when they help.</p>
 <label htmlFor="pb-capture-thought">What’s on your mind?<textarea id="pb-capture-thought" required maxLength={3000} rows={4} readOnly={!own} value={form.content} onChange={e=>field('content',e.target.value)} placeholder="An idea, a date to remember, a question worth exploring…"/></label>
 {!own&&<p>The contributor’s words stay intact. Add your perspective in a reply.</p>}
 {!initial&&<label>Your name<input required maxLength={80} autoComplete="name" value={name} onChange={e=>setName(e.target.value)}/></label>}
 <div className="pb-form-row"><label>This is<select value={form.kind} onChange={e=>field('kind',e.target.value)}>{IDEA_KINDS.filter(k=>isLead||k!=='Confirmed date').map(k=><option key={k}>{k}</option>)}</select></label><label>Where are we?<select value={form.status} onChange={e=>field('status',e.target.value)}>{IDEA_STATUSES.filter(s=>isLead||s!=='Agreed').map(s=><option key={s}>{s}</option>)}</select></label></div>
 <details open={Boolean(initial)} className="pb-idea-details"><summary>Add timing, context or connections</summary>
 <label>Timeframe or recurring reminder<input maxLength={300} value={form.timeframe} onChange={e=>field('timeframe',e.target.value)} placeholder="Before next school year, each August, or the first two months…"/></label>
 <label>Specific date, if known<input type="date" required={form.kind==='Confirmed date'} value={form.event_date} onChange={e=>field('event_date',e.target.value)}/></label>
 <label>Why does this matter?<textarea maxLength={2000} rows={2} value={form.context} onChange={e=>field('context',e.target.value)}/></label>
 <label>Who should be part of the conversation?<input maxLength={300} value={form.involve} onChange={e=>field('involve',e.target.value)} placeholder="A role, a team or a person"/></label>
 <fieldset><legend>Connect to the playbook when ready</legend><p>The same item can inform more than one P. It stays connected, without being copied.</p><div className="pb-idea-section-options">{PS.map(p=><label key={p.id}><input type="checkbox" checked={form.sections.includes(p.id)} onChange={e=>field('sections',e.target.checked?[...form.sections,p.id]:form.sections.filter(id=>id!==p.id))}/>{p.name}</label>)}</div></fieldset>
 </details><p>Ideas are open for discussion. A chair or lead records group agreement and confirms dates. Changes to agreed wording or timing reopen the discussion.</p>
 {error&&<p role="alert">{error}</p>}<button className="pb-button" disabled={busy}>{busy?'Saving…':initial?'Save changes':'Save to Ideas & dates'} <Plus size={16}/></button>
 </form>;
}
function IdeaReplies({idea,comments,name,setName,onMutate,onError}) {
 const [open,setOpen]=useState(false),[content,setContent]=useState(''),[busy,setBusy]=useState(false);
 return <div className="pb-thread"><button className="pb-textbutton" aria-expanded={open} onClick={()=>setOpen(!open)}><MessageCircle size={14}/>{comments.length?`${comments.length} ${comments.length===1?'reply':'replies'}`:'Start a conversation'}</button>{open&&<div className="pb-replies">{comments.map(c=><div key={c.id} className="pb-reply"><b>{c.author_name}</b><small>{new Date(c.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</small><p>{c.content}</p></div>)}<form onSubmit={async e=>{e.preventDefault();setBusy(true);try{await onMutate('idea_comment',{idea_id:idea.id,content,author_name:name.trim()});setContent('');}catch(e){onError(e.message);}finally{setBusy(false);}}}><label>Your name<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)}/></label><label>Build on this thought<textarea required maxLength={2000} rows={2} value={content} onChange={e=>setContent(e.target.value)}/></label><button className="pb-textbutton" disabled={busy}>Add reply <ArrowUpRight size={14}/></button></form></div>}</div>;
}
export function IdeasPage({data,name,setName,userId,onMutate,onError,onCapture,onEdit,onAction,focusId,onClearFocus}) {
 const [filter,setFilter]=useState('all');const focus=useRef(null);
 useEffect(()=>{if(focusId){setFilter('all');focus.current?.focus();focus.current?.scrollIntoView?.({block:'center',behavior:'smooth'});}},[focusId,data.ideas]);
 const ideas=data.ideas||[];
 return <main className="pb-record-page pb-ideas-page"><div className="pb-page-intro"><span className="pb-eyebrow">A THOUGHT TODAY. A STRONGER START TOMORROW.</span><h1>Ideas to explore.<br/><em>Dates to remember.</em></h1><p>Capture what comes up throughout the year. Share a possibility, an important date, a question or a lesson. Let the conversation shape what belongs in our playbook.</p><button className="pb-button" onClick={onCapture}>Capture something <Plus size={17}/></button></div>
 <div className="pb-filter-row"><label>Show<select value={filter} onChange={e=>{setFilter(e.target.value);onClearFocus();}}><option value="all">Everything</option><optgroup label="Progress">{IDEA_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</optgroup><optgroup label="Type">{IDEA_KINDS.map(k=><option key={k} value={k}>{k}</option>)}</optgroup></select></label><p>Proposed dates are possibilities. Confirmed dates are recorded by a chair or lead.</p></div>
 <div className="pb-idea-list">{ideas.filter(i=>filter==='all'||i.status===filter||i.kind===filter).map(i=><article key={i.id} id={`idea-${i.id}`} ref={i.id===focusId?focus:null} tabIndex={-1} className={`pb-idea-card ${i.id===focusId?'highlighted':''}`}>
 <div className="pb-idea-meta"><span className="pb-tag">{i.kind}</span><span className={`pb-tag ${i.status==='Agreed'?'agreed':''}`}>{i.status}</span></div><p className="pb-idea-thought">{i.content}</p><p className="pb-idea-author">Shared by <b>{i.author_name}</b> · {new Date(i.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p>
 {(i.event_date||i.timeframe)&&<div className="pb-idea-timing"><b>{i.kind==='Confirmed date'?'Confirmed date':i.kind==='Recurring reminder'?'Recurring reminder':'Timing to explore'}</b>{i.event_date&&<span>{day(i.event_date)}</span>}{i.timeframe&&<span>{i.timeframe}</span>}</div>}
 {i.context&&<div><h3>Why it matters</h3><p>{i.context}</p></div>}{i.involve&&<div><h3>Bring into the conversation</h3><p>{i.involve}</p></div>}
 {i.sections?.length>0&&<p className="pb-idea-connections">Informs {i.sections.map(id=>PS.find(p=>p.id===id)?.name).join(' · ')}</p>}
 <div className="pb-idea-controls">{(i.author_id===userId||data.role==='lead')&&<button className="pb-textbutton" onClick={()=>onEdit(i)}>{i.author_id===userId?'Develop this thought':'Organize this thought'} <ArrowUpRight size={14}/></button>}<button className="pb-textbutton" onClick={()=>onAction(i)}>Add a connected next step <Plus size={14}/></button></div>
 <IdeaReplies idea={i} comments={(data.idea_comments||[]).filter(c=>c.idea_id===i.id)} name={name} setName={setName} onMutate={onMutate} onError={onError}/>
 </article>)}</div>{!ideas.length&&<div className="pb-action-empty"><h2>A good idea doesn’t need a perfect home yet.</h2><p>“Should dues have a defined collection window?” is a useful beginning. Capture the question, explore it together and connect it to Plan or Provision when ready.</p></div>}{ideas.length>0&&!ideas.some(i=>filter==='all'||i.status===filter||i.kind===filter)&&<p>No items match this view yet.</p>}
 </main>;
}
