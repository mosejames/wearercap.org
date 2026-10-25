import {attachmentSize} from './attachmentSize';
import React,{useEffect,useState} from 'react';
import{createRoot}from'react-dom/client';
import './builder.css';
import './console.css';
import './intake.css';
import {ImagePlus,MessageCircle,Mail,CheckCircle2} from 'lucide-react';
const MAX_FILES=6,MAX_BYTES=3*1024*1024;
const base64=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Could not read that file. Please choose it again.'));reader.readAsDataURL(blob);});
async function intakeCall(action,payload={}){
 const r=await fetch('/api/campaign-activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Please try again.');return data;
}
function FilePreview({file,onRemove,disabled}){
 const[url,setUrl]=useState('');
 useEffect(()=>{if(!/^image\/(jpeg|png|webp)$/.test(file.type))return;const preview=URL.createObjectURL(file);setUrl(preview);return()=>URL.revokeObjectURL(preview);},[file]);
 return <li className="nc-file">{url?<img src={url} alt={`Selected attachment: ${file.name}`}/>:<span className="nc-file-symbol" aria-hidden="true">{file.type==='application/pdf'?'PDF':'PHOTO'}</span>}<div><strong>{file.name}</strong><small>{attachmentSize(file.size)}</small></div><button type="button" disabled={disabled} onClick={onRemove} aria-label={`Remove ${file.name}`}>Remove</button></li>;
}
function Intake(){
 const[done,setDone]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[files,setFiles]=useState([]),[progress,setProgress]=useState('');
 function addSelected(selected){
  setError('');
  if(files.length+selected.length>MAX_FILES){setError('You can attach up to six files. Remove a file before adding more.');return;}
  for(const file of selected){
   const photo=/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)||/\.hei[cf]$/i.test(file.name),pdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
   if(!photo&&!pdf){setError('Choose JPG, PNG, WebP, HEIC photos, or PDF flyers.');return;}
   if((pdf&&file.size>MAX_BYTES)||file.size>30*1024*1024){setError(pdf?'PDF flyers must be 3 MB or smaller.':'That photo is too large. Choose a photo under 30 MB.');return;}
  }
  setFiles([...files,...selected]);
 }
 function addFiles(e){const selected=[...e.target.files];e.target.value='';addSelected(selected);}
 async function submit(e){
  e.preventDefault();const values=Object.fromEntries(new FormData(e.target));delete values.attachments;setBusy(true);setError('');
  try{
   let token;const attachmentIndices=[];
   if(files.length){
    setProgress('Preparing your attachments…');({token}=await intakeCall('uploadSession',{website:values.website}));
    for(let index=0;index<files.length;index++){
     const file=files[index];let blob=file,name=file.name;
     if(file.type!=='application/pdf'&&!/\.pdf$/i.test(name)&&(file.size>MAX_BYTES||/hei[cf]/i.test(file.type)||/\.hei[cf]$/i.test(name))){
      const{prepareImage}=await import('../vault/images');const prepared=await prepareImage(file);blob=prepared.web;name=name.replace(/\.[^.]+$/,'')+'.jpg';
     }
     if(blob.size>MAX_BYTES)throw Error(`${file.name} is still too large. Please choose a smaller version.`);
     setProgress(`Uploading attachment ${index+1} of ${files.length}…`);
     await intakeCall('uploadAttachment',{token,index,name,data:await base64(blob)});attachmentIndices.push(index);
    }
   }
   setProgress('Sending your submission…');await intakeCall('submit',{...values,token,attachmentIndices});setDone(true);setFiles([]);
  }catch(e){setError(e.message);}finally{setBusy(false);setProgress('');}
 }
 return <main className="intake-page"><header className="intake-header"><a href="/" aria-label="We Are RCAP home"><img src="/brand/rcap.svg" alt="RCAP" width="90"/></a><span>The newsletter · Your community, your voice</span></header><section className="intake-intro"><p className="nb-kicker">For parents, staff, students, and our community</p><h1>What should we share?</h1><p>An idea, a great moment, something coming up. Bring what you have. A few sentences is enough.</p></section>{done?<section className="intake-success"><CheckCircle2 size={36}/><h2>Thanks for putting it on our radar.</h2><p>Your suggestion and any attachments are with the newsletter team. We’ll use your contact information if we need more details.</p><p className="intake-muted">Our editors review suggestions for upcoming issues. Submission does not guarantee publication.</p><button onClick={()=>setDone(false)}>Share another suggestion</button></section>:<form className="intake-form" onSubmit={submit}><div className="intake-story"><section className="intake-upload" aria-label="Submission attachments" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy)addSelected([...e.dataTransfer.files]);}}><label className="intake-upload-target" htmlFor="intake-files"><ImagePlus size={29}/><strong>Have a photo or flyer? Add it here.</strong><span>Choose files or drop them here. Optional, up to six.</span></label><input id="intake-files" className="intake-file-input" type="file" name="attachments" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif" disabled={busy} onChange={addFiles}/><details className="intake-file-help"><summary>File types &amp; sizes</summary><p>JPG, PNG, WebP, HEIC photos, or PDF flyers. PDFs up to 3 MB each. Larger phone photos are resized for upload.</p></details>{files.length>0&&<><ul className="nc-files">{files.map((file,index)=><FilePreview key={index+file.name} file={file} disabled={busy} onRemove={()=>setFiles(files.filter((_,n)=>n!==index))}/>)}</ul><label className="intake-permission"><input type="checkbox" name="permission" required disabled={busy}/> I have permission to share these files with RCAP for newsletter use.</label></>}</section><label className="intake-main-label" htmlFor="intake-details"><MessageCircle size={19}/> What would you like us to know?</label><textarea id="intake-details" name="details" required rows={5} maxLength={6000} disabled={busy} placeholder="Tell us your idea, what happened, or what’s coming up. Share the details you have."/><p className="intake-muted">Dates, names, and a little context help. You don’t need to write a finished article.</p><details className="intake-extras"><summary>Add more details <span>Optional</span></summary><label>A short title<input name="title" maxLength={160} disabled={busy} placeholder="We can help with the headline"/></label><div className="intake-pair"><label>What is it about?<select name="category" disabled={busy}><option value="Other">An idea or suggestion</option>{['Announcement','Event','Photos or recap','Volunteer opportunity'].map(x=><option key={x}>{x}</option>)}</select></label><label>A useful date<input name="requestedDate" type="date" disabled={busy}/></label></div><label>Links or anything else that helps<textarea name="links" rows={2} maxLength={2000} disabled={busy} placeholder="A signup link, shared folder, or more information"/></label></details></div><aside className="intake-contact"><div className="intake-contact-heading"><Mail size={20}/><h2>How can we reach you?</h2></div><p>So we can follow up and get the story right.</p><label>Your name<input name="name" required autoComplete="name" maxLength={100} disabled={busy}/></label><label>Email address<input name="email" type="email" required autoComplete="email" maxLength={200} disabled={busy}/></label><label>Phone number <span>Optional</span><input name="phone" type="tel" autoComplete="tel" maxLength={40} disabled={busy}/></label><label>I’m sharing as a <span>Optional</span><select name="relationship" disabled={busy}><option value="">Choose if you’d like</option>{['Parent or family member','Staff member','Student','Community member'].map(x=><option key={x}>{x}</option>)}</select></label><label className="intake-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>{error&&<p role="alert" className="intake-error">{error}</p>}{progress&&<p role="status" aria-live="polite">{progress}</p>}<button className="intake-submit" disabled={busy}>{busy?'Sending…':'Share with the newsletter team'}</button><p className="intake-muted">Contact details stay with the editors. Photos and copy are reviewed before anything is published.</p></aside></form>}<footer className="intake-footer"><a href="/">We Are RCAP</a><span>Built by parents, for our community.</span></footer></main>;

}
createRoot(document.getElementById('root')).render(<Intake/>);
