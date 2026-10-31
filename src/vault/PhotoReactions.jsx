import {useEffect,useState} from 'react';
import {supabase} from './auth.js';
import './photoReactions.css';
import {reactionOptions} from './reactionOptions.js';
export async function photoReactions(photoId,kind,active){
 const {data,error}=await supabase.rpc('vault_photo_reactions',{p_photo:photoId,p_action:kind?'set':'read',p_reaction:kind||'',p_active:active??true});
 if(error)throw new Error(error.message);
 return data||[];
}
export default function PhotoReactions({photo,owner,profile,liked,onLove,onNeedName,eventSlug}){
 const [value,setValue]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let live=true;setValue(null);setError('');photoReactions(photo.id).then(v=>{if(live)setValue(v);}).catch(()=>{if(live)setError('Couldn’t load reactions. Please try again.');});return()=>{live=false;};},[photo.id,owner,retry]);
 async function react(kind){
  if(!owner||!profile){onNeedName('Sign in to leave a little love.');return;}
  setBusy(true);setError('');
  try{
   if(kind==='love')await onLove(photo);
   else {const saved=await photoReactions(photo.id,kind,!value?.find(v=>v.reaction===kind)?.mine);setValue(saved);window.dispatchEvent(new CustomEvent('vault-photo-reactions',{detail:{photoId:photo.id,reactions:saved}}));}
  }catch(e){setError(e.message||'Couldn’t save your reaction. Please try again.');}finally{setBusy(false);}
 }
 return <section className="photo-reactions" aria-label="Photo reactions"><p>Leave a little love</p><div className="photo-reaction-options">{reactionOptions(eventSlug).map(([kind,emoji,label])=>{const r=value?.find(v=>v.reaction===kind);const mine=kind==='love'?liked:!!r?.mine;const count=kind==='love'?photo.likes:r?.count||0;
 return <button type="button" key={kind} aria-label={label} aria-pressed={mine} title={label} disabled={busy||(kind!=='love'&&value===null)} onClick={()=>react(kind)}><span aria-hidden="true">{emoji}</span><span className="reaction-label">{label}</span><small aria-label={`${count} reactions`}>{count>0?count:''}</small></button>;
 })}</div>{value===null&&!error&&<small role="status">Loading reactions…</small>}{error&&<p role="alert">{error} <button type="button" onClick={()=>setRetry(n=>n+1)}>Try again</button></p>}</section>;
}
