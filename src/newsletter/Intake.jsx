import React,{useEffect,useState} from 'react';
import{createRoot}from'react-dom/client';
import './builder.css';
import './console.css';
const MAX_FILES=6,MAX_BYTES=3*1024*1024;
const base64=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('Could not read that file. Please choose it again.'));reader.readAsDataURL(blob);});
async function intakeCall(action,payload={}){
 const r=await fetch('/api/campaign-activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload})});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Error(data.error||'Please try again.');return data;
}
function FilePreview({file,onRemove,disabled}){
 const[url,setUrl]=useState('');
 useEffect(()=>{if(!/^image\/(jpeg|png|webp)$/.test(file.type))return;const preview=URL.createObjectURL(file);setUrl(preview);return()=>URL.revokeObjectURL(preview);},[file]);
 return <li className="nc-file">{url?<img src={url} alt={`Selected attachment: ${file.name}`}/>:<span className="nc-file-symbol" aria-hidden="true">{file.type==='application/pdf'?'PDF':'PHOTO'}</span>}<div><strong>{file.name}</strong><small>{(file.size/1024/1024).toFixed(1)} MB</small></div><button type="button" disabled={disabled} onClick={onRemove} aria-label={`Remove ${file.name}`}>Remove</button></li>;
}
function Intake(){
 const[done,setDone]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[files,setFiles]=useState([]),[progress,setProgress]=useState('');
 function addFiles(e){
  const selected=[...e.target.files];e.target.value='';setError('');
  if(files.length+selected.length>MAX_FILES){setError('You can attach up to six files. Remove a file before adding more.');return;}
  for(const file of selected){
   const photo=/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)||/\.hei[cf]$/i.test(file.name),pdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
   if(!photo&&!pdf){setError('Choose JPG, PNG, WebP, HEIC photos, or PDF flyers.');return;}
   if((pdf&&file.size>MAX_BYTES)||file.size>30*1024*1024){setError(pdf?'PDF flyers must be 3 MB or smaller.':'That photo is too large. Choose a photo under 30 MB.');return;}
  }
  setFiles([...files,...selected]);
 }
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
 return <main className="nb-dash"><p className="nb-kicker">We Are RCAP · The newsletter</p><h1>Something to share?</h1><p>Send an announcement, event, or story for an upcoming newsletter. Include your flyer or favorite photos. Our editors will review it and may contact you for details.</p>{done?<section className="nb-panel"><h2>It’s in the inbox.</h2><p>Your submission and attachments have been received. Thank you for contributing. Submitting an item does not guarantee publication.</p><button onClick={()=>setDone(false)}>Submit another item</button></section>:<form className="nb-panel nc-form" onSubmit={submit}><label>Your name<input name="name" required maxLength={100} disabled={busy}/></label><label>Your email<input name="email" type="email" required maxLength={200} disabled={busy}/></label><label>What are you sharing?<select name="category" disabled={busy}>{['Announcement','Event','Photos or recap','Volunteer opportunity','Other'].map(x=><option key={x}>{x}</option>)}</select></label><label>Headline<input name="title" required maxLength={160} disabled={busy}/></label><label>Requested issue date · optional<input name="requestedDate" type="date" disabled={busy}/></label><label>What should families know?<textarea name="details" required rows={7} maxLength={6000} disabled={busy}/></label><p className="nb-help">Include dates, times, location, deadlines, who can participate, and what you want readers to do.</p><section className="nc-attachments" aria-label="Submission attachments"><h2>Flyers and photos</h2><p className="nb-help">Attach up to six files. JPG, PNG, WebP, HEIC photos, or PDF flyers. PDFs can be up to 3 MB each. Larger phone photos are resized for upload.</p><label>Add flyers or photos<input type="file" name="attachments" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif" disabled={busy} onChange={addFiles}/></label>{files.length>0&&<><ul className="nc-files">{files.map((file,index)=><FilePreview key={index+file.name} file={file} disabled={busy} onRemove={()=>setFiles(files.filter((_,n)=>n!==index))}/>)}</ul><label className="nc-permission"><input type="checkbox" name="permission" required disabled={busy}/> I have permission to share these files with RCAP for newsletter use.</label></>}<p className="nb-help">Attachments are available to newsletter editors. They will not appear publicly unless selected for publication.</p></section><label>Supporting links · optional<textarea name="links" rows={3} maxLength={2000} disabled={busy}/></label><p className="nb-help">Add signup links or a shared folder if you have more files. Make sure editors can open them. Avoid private student information.</p><label style={{display:'none'}} aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off"/></label>{error&&<p role="alert">{error}</p>}{progress&&<p role="status" aria-live="polite">{progress}</p>}<button disabled={busy}>{busy?'Submitting…':'Send to the newsletter inbox'}</button></form>}<p><a href="https://wearercap.org/">We Are RCAP</a></p></main>;
}
createRoot(document.getElementById('root')).render(<Intake/>);
