import React, {useEffect, useState} from 'react';
import {supabase, exportActiveListings, listWelcomePending, adminSendWelcome} from './api.js';

// Downloads the published listings with the account email each owner signed up
// with, for the nurture list. Built in the browser from the rows the RPC
// returns, so nothing is stored and no file lives on a server.
function csv(rows) {
 const cols=['name','account_email','business_email','phone','category','venture','house','website','published_at','updated_at'];
 const cell=v=>{const s=v==null?'':String(v);return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
 return [cols.join(','),...rows.map(r=>cols.map(c=>cell(r[c])).join(','))].join('\n');
}

function ExportListings() {
 const [busy,setBusy]=useState(false),[note,setNote]=useState('');
 async function download() {
  setBusy(true);setNote('');
  try {
   const rows=await exportActiveListings();
   if(!rows.length){setNote('No published listings yet.');return;}
   const blob=new Blob([csv(rows)],{type:'text/csv;charset=utf-8'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='rcap-collective-'+new Date().toISOString().slice(0,10)+'.csv';
   document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
   setNote('Downloaded '+rows.length+' published '+(rows.length===1?'listing':'listings')+'.');
  } catch(e) {setNote(e.message || 'Could not build the export.');}
  finally {setBusy(false);}
 }
 return <section className="dir-signin" style={{marginTop:40}}>
  <h2 style={{marginTop:0}}>Export the mailing list</h2>
  <p>Every published listing with the email address its owner signed up with. Opens in Numbers, Excel or Google Sheets.</p>
  <button className="dir-button" type="button" onClick={download} disabled={busy}>{busy?'Building…':'Download CSV'}</button>
  <p role="status">{note}</p>
 </section>;
}

// Listings published before the welcome email worked, or whose send failed.
// One button per listing so each send is deliberate. The function stamps
// welcome_sent_at, so a listing drops off this list once it has been sent.
function WelcomePending() {
 const [rows,setRows]=useState(null),[status,setStatus]=useState({}),[note,setNote]=useState('');
 const load=()=>listWelcomePending().then(setRows).catch(e=>{setRows([]);setNote(e.message||'Could not load the list.');});
 useEffect(()=>{load();},[]);
 async function send(row) {
  setStatus(s=>({...s,[row.id]:'sending'}));
  try {
   const r=await adminSendWelcome(row.id);
   setStatus(s=>({...s,[row.id]:r.sent?'sent':(r.reason||'not sent')}));
  } catch(e) {setStatus(s=>({...s,[row.id]:e.message||'not sent'}));}
 }
 if(rows===null) return null;
 return <section className="dir-signin" style={{marginTop:40}}>
  <h2 style={{marginTop:0}}>Welcome emails not yet sent</h2>
  <p>Published listings whose owners never got the "your listing is live" email. It goes to the address they signed up with.</p>
  {rows.length===0 ? <p>Everyone has been welcomed.</p> : <ul style={{listStyle:'none',padding:0,margin:0}}>
   {rows.map(row=>{const st=status[row.id];return <li key={row.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16,padding:'14px 0',borderTop:'1px solid var(--collective-border)'}}>
    <span><strong>{row.name}</strong><br/><small>{row.account_email}</small></span>
    {st==='sent' ? <span role="status">Sent</span>
     : <button className="dir-button" type="button" disabled={st==='sending'} onClick={()=>send(row)}>{st==='sending'?'Sending…':'Send welcome'}</button>}
    {st && st!=='sent' && st!=='sending' && <small role="status">{st}</small>}
   </li>;})}
  </ul>}
  <p role="status">{note}</p>
 </section>;
}
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
 return <section className="dir-signin"><h1>Directory visibility</h1><p>Choose what visitors see. Hiding a section keeps its listings and information intact.</p><form onSubmit={save}><fieldset disabled={busy} style={{border:0,padding:0}}>{Object.entries(labels).map(([key,label])=><label key={key} style={{display:'flex',alignItems:'center',gap:12,margin:'20px 0'}}><input style={{width:20,height:20}} type="checkbox" checked={Boolean(draft[key])} onChange={e=>setDraft({...draft,[key]:e.target.checked})}/>{label}</label>)}</fieldset><button className="dir-button" disabled={busy}>{busy?'Saving…':'Save visibility'}</button></form><p role="status">{message}</p><WelcomePending /><ExportListings /></section>;
}
