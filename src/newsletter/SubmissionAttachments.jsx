import {attachmentSize} from './attachmentSize';
import React,{useEffect,useRef,useState} from 'react';
import {consoleCall} from './api';
export default function SubmissionAttachments({item}){
 const[urls,setUrls]=useState({}),[busy,setBusy]=useState(null),[error,setError]=useState('');const owned=useRef([]);
 useEffect(()=>()=>{owned.current.forEach(url=>URL.revokeObjectURL(url));},[]);
 async function load(file,download=false){
  setBusy(file.index);setError('');
  try{
   let url=urls[file.index];
   if(!url){const result=await consoleCall('attachment',{id:item.id,index:file.index});const bytes=Uint8Array.from(atob(result.data),c=>c.charCodeAt(0));url=URL.createObjectURL(new Blob([bytes],{type:result.mime}));owned.current.push(url);setUrls(previous=>({...previous,[file.index]:url}));}
   if(download){const a=document.createElement('a');a.href=url;a.download=file.name;a.click();}
  }catch(e){setError(e.message);}finally{setBusy(null);}
 }
 if(!item.attachments?.length)return null;
 return <section aria-label="Submitted attachments"><h4>Attached flyers and photos</h4>{error&&<p role="alert">{error}</p>}<ul className="nc-files">{item.attachments.map(file=><li key={file.index} className="nc-file nc-received-file"><div><strong>{file.name}</strong><small>{attachmentSize(file.size)} · {file.mime==='application/pdf'?'PDF flyer':'Photo'}</small></div><div className="nc-file-actions">{file.mime.startsWith('image/')&&<button disabled={busy!==null} onClick={()=>load(file)}>{busy===file.index?'Loading…':'Preview'}</button>}<button disabled={busy!==null} onClick={()=>load(file,true)}>Download</button></div>{urls[file.index]&&file.mime.startsWith('image/')&&<img className="nc-attachment-preview" src={urls[file.index]} alt={`Submitted attachment: ${file.name}`}/>}</li>)}</ul></section>;
}
