import {useEffect,useState} from 'react';
import {Download} from 'lucide-react';
export async function prepareSavePhoto(photo,signal){const response=await fetch(photo.web,{signal});if(!response.ok)throw Error('Could not prepare photo');const blob=await response.blob();if(!blob.type.startsWith('image/'))throw Error('Could not prepare photo');return new File([blob],`RCA-NYC-${photo.id}.jpg`,{type:'image/jpeg'});}
export async function savePhotoFile(file){if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file]});return 'share';}const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);return 'download';}
export default function SavePhoto({photo,onNotice}){
 const[file,setFile]=useState(null),[failed,setFailed]=useState(false),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const controller=new AbortController();setFile(null);setFailed(false);prepareSavePhoto(photo,controller.signal).then(value=>{if(!controller.signal.aborted)setFile(value);}).catch(()=>{if(!controller.signal.aborted)setFailed(true);});return()=>controller.abort();},[photo.id,photo.web,attempt]);
 async function save(){if(failed){setAttempt(n=>n+1);return;}if(!file||busy)return;setBusy(true);try{const result=await savePhotoFile(file);onNotice(result==='share'?'Choose Save Image or your photo app in the share sheet.':'Photo download started.');}catch(e){if(e.name!=='AbortError')onNotice('Couldn’t open the save options. Please try again.');}finally{setBusy(false);}}
 return <button type="button" className="text-link" disabled={busy||!file&&!failed} onClick={save}><Download size={17}/>{busy?'Opening…':failed?'Retry save':!file?'Preparing photo…':'Save photo'}</button>;
}
