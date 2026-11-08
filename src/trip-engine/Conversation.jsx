import {useEffect,useRef,useState} from 'react';
import {Heart,Smile,MessageCircle} from 'lucide-react';
import {browserToken,request} from './data.js';
const DC_REACTIONS = [
 ['love', '❤️', 'Love it'],
 ['celebrate', '🏛️', 'Monumental'],
 ['thanks', '💙', 'Thank you'],
 ['amazing', '🤩', 'DC wow'],
 ['bravo', '🦅', 'Capital pride'],
];

// A separate instance per photo prevents late responses or drafts leaking to the next photo.
export default function Conversation(props){return <PhotoConversation key={`${props.slug}:${props.photo.id}`} {...props}/>;}
function PhotoConversation({slug,photo,prominent,children}){
 const token=useRef(browserToken(slug)),live=useRef(true),generation=useRef(0),[value,setValue]=useState(null),[name,setName]=useState(''),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{live.current=true;read();return()=>{live.current=false;};},[slug,photo.id]);
 async function read(){const turn=++generation.current;setLoading(true);setError('');try{const v=await request(slug,'conversation',{id:photo.id,token:token.current,operation:'read'});if(live.current&&turn===generation.current)setValue(v);}catch(e){if(live.current&&turn===generation.current)setError(e.message);}finally{if(live.current&&turn===generation.current)setLoading(false);}}
 async function act(operation,values){const turn=++generation.current;setBusy(true);setError('');try{const next=await request(slug,'conversation',{id:photo.id,token:token.current,operation,...values});if(live.current&&turn===generation.current){setValue(next);if(operation==='comment')setBody('');}}catch(e){if(live.current&&turn===generation.current)setError(e.message);}finally{if(live.current&&turn===generation.current)setBusy(false);}}
 function reactionButton(kind, label, icon, emoji) {
  const reaction = value?.reactions.find(item => item.kind === kind);
  const Icon = icon;
  return (
   <button key={kind} type="button" aria-label={label} aria-pressed={Boolean(reaction?.mine)}
    title={reaction?.mine ? `Undo ${label}` : label} disabled={busy || loading || !value}
    onClick={() => act('react', {reaction: kind, active: !reaction?.mine})}>
    {emoji ? <span className="engine-reaction-emoji" aria-hidden="true">{emoji}</span> : <><Icon size={17} aria-hidden="true"/>{label}</>}
    {emoji && <span className="engine-reaction-label">{label}</span>}
    {(reaction?.count > 0 || !prominent) && <span className="engine-reaction-count" aria-label={`${reaction?.count || 0} reactions`}>{reaction?.count || 0}</span>}
   </button>
  );
 }

 return <section className={prominent ? "engine-conversation engine-conversation-prominent" : "engine-conversation"} aria-label="Photo reactions and comments" aria-busy={loading||busy}>
  {prominent && <>
   <h3 className="engine-reaction-prompt">A little love from home</h3>
   <div className="engine-emoji-row" aria-label="React to this photo">
    {DC_REACTIONS.map(([kind, emoji, label]) => reactionButton(kind, label, null, emoji))}
   </div>
  </>}
  <div className="engine-row">
   {!prominent && reactionButton('thanks', 'Thank you', Heart)}
   {reactionButton('mine', 'That’s my child', Smile)}
  </div>{children}{loading&&<p className="engine-conversation-state" role="status">Opening reactions…</p>}{error&&<p role="alert">{error}{!value&&<button className="engine-link" onClick={read} disabled={loading}>Try again</button>}</p>}{value&&<><p className="engine-comment-count" aria-live="polite">{value.comments.length} {value.comments.length===1?'note':'notes'} from home</p>{value.comments.map(c=><article key={c.id}><b>{c.name}</b><p>{c.body}</p>{c.canRemove&&<button className="engine-link" disabled={busy} onClick={()=>act('remove',{commentId:c.id})}>Remove comment</button>}</article>)}<form onSubmit={e=>{e.preventDefault();act('comment',{name:name.trim(),body:body.trim()});}}><details><summary><MessageCircle size={16} style={{marginRight:8}}/>Leave a little love</summary><label>Your name<input value={name} maxLength={60} required disabled={busy} onChange={e=>setName(e.target.value)}/></label><label>A quick note<textarea value={body} maxLength={500} required disabled={busy} onChange={e=>setBody(e.target.value)}/></label><button disabled={busy||!name.trim()||!body.trim()}>{busy?'Saving…':'Add comment'}</button></details></form></>}</section>;
}
