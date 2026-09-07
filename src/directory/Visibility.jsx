import React, {useState} from 'react';
import {supabase} from './api.js';
export const DEFAULT_VISIBILITY = {partner_heading:false,student_spotlight:false,student_invitation:true,house_filter:false,collaboration:true};
const labels = {partner_heading:'Find your future partners heading',student_spotlight:'Full student spotlight and explore link',student_invitation:'Small invitation to create a student venture',house_filter:'Filter listings by house',collaboration:'Collaboration hub'};
export default function Visibility({settings,onSaved}) {
 const [draft,setDraft]=useState(settings),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function save(e) {
  e.preventDefault();setBusy(true);setMessage('');
  const values=Object.fromEntries(Object.keys(labels).map(key=>[key,Boolean(draft[key])]));
  try {
   const {data,error}=await supabase.from('directory_settings').update(values).eq('id',true).select().single();
   if(error) throw error;
   onSaved(data);setMessage('Saved. These settings apply to everyone visiting the directory.');
  } catch(e) {setMessage(e.message || 'Could not save settings. Please try again.');}
  finally {setBusy(false);}
 }
 return <section className="dir-signin"><h1>Directory visibility</h1><p>Choose what visitors see. Hiding a section keeps its listings and information intact.</p><form onSubmit={save}><fieldset disabled={busy} style={{border:0,padding:0}}>{Object.entries(labels).map(([key,label])=><label key={key} style={{display:'flex',alignItems:'center',gap:12,margin:'20px 0'}}><input style={{width:20,height:20}} type="checkbox" checked={Boolean(draft[key])} onChange={e=>setDraft({...draft,[key]:e.target.checked})}/>{label}</label>)}</fieldset><button className="dir-button" disabled={busy}>{busy?'Saving…':'Save visibility'}</button></form><p role="status">{message}</p></section>;
}
