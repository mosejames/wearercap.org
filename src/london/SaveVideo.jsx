import {useEffect,useRef,useState} from 'react';
import {Download} from 'lucide-react';
import {canSaveVideoFile,loadVideoFile,saveVideoFile,downloadVideoFile} from './saveVideo.js';
export default function SaveVideo({id,url}) {
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[fallback,setFallback]=useState(false);
 const file=useRef(null),pending=useRef(null),controller=useRef(null),alive=useRef(true);
 function prepare(){
  if(file.current)return Promise.resolve(file.current);if(pending.current)return pending.current;
  const abort=new AbortController();controller.current=abort;setBusy(true);setError('');
  const task=loadVideoFile(url,id,{signal:abort.signal}).then(value=>{if(alive.current&&!abort.signal.aborted)file.current=value;return value;}).finally(()=>{if(pending.current===task){pending.current=null;if(alive.current)setBusy(false);}});pending.current=task;return task;
 }
 useEffect(()=>{
  alive.current=true;
  // Only the opened clip is prepared on devices with native file sharing. This keeps
  // the file ready before the tap, preserving Safari's user activation requirement.
  if(canSaveVideoFile())prepare().catch(e=>{if(alive.current&&e.name!=='AbortError')setError(e.message);});
  return()=>{alive.current=false;controller.current?.abort();pending.current=null;file.current=null;};
 },[id,url]);
 async function save(){
  setError('');setNotice('');setFallback(false);let prepared=file.current;
  try{
   if(!prepared){prepared=await prepare();if(!alive.current)return;
    if(canSaveVideoFile(prepared) && navigator.userActivation?.isActive===false){setNotice('Ready. Tap Save video to open the save menu.');return;}
   }
   setBusy(true);
   const result=await saveVideoFile(prepared);
   if(alive.current)setNotice(result==='downloaded'?'Video download started.':'');
  }catch(e){
   if(!alive.current||e.name==='AbortError')return;
   if(e.name==='NotAllowedError' && prepared){setNotice('Tap Save video again, or download the MP4 below.');setFallback(true);}
   else setError(e.message||'Couldn’t save this video. Please try again.');
  }finally{if(alive.current)setBusy(false);}
 }
 return <div className="l-video-save"><button type="button" className="l-text l-original-link" disabled={busy} onClick={save}><Download size={17}/>{busy?'Preparing video…':'Save video'}</button>{notice&&<p className="l-small" role="status">{notice}</p>}{fallback&&file.current&&<button type="button" className="l-text" onClick={()=>downloadVideoFile(file.current)}>Download video file</button>}{error&&<p className="l-error" role="alert">{error}</p>}</div>;
}
