import {useEffect,useState} from 'react';
import {Download} from 'lucide-react';
export function photoDownloadUrl(photo){return `/api/nyc-download/${encodeURIComponent(photo.id)}`;}
export function downloadPhoto(photo){const a=document.createElement('a');a.href=photoDownloadUrl(photo);a.download=`RCA-NYC-${photo.id}.jpg`;document.body.append(a);a.click();a.remove();}
export async function prepareSavePhoto(photo,signal){const response=await fetch(photoDownloadUrl(photo),{signal,cache:'no-store'});if(!response.ok)throw Error('Could not prepare photo');const blob=await response.blob();if(!blob.type.startsWith('image/'))throw Error('Could not prepare photo');return new File([blob],`RCA-NYC-${photo.id}.jpg`,{type:'image/jpeg'});}
export async function savePhotoFile(file){if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file]});return 'share';}const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);return 'download';}
export default function SavePhoto({photo,onNotice}){
 const[file,setFile]=useState(null),[busy,setBusy]=useState(false);
 useEffect(()=>{const controller=new AbortController();setFile(null);prepareSavePhoto(photo,controller.signal).then(value=>{if(!controller.signal.aborted)setFile(value);}).catch(()=>{/* The same-origin attachment remains available directly. */});return()=>controller.abort();},[photo.id]);
 async function save(){if(busy)return;if(!file||!window.matchMedia?.('(pointer: coarse)').matches){downloadPhoto(photo);onNotice('Photo download started.');return;}setBusy(true);try{const result=await savePhotoFile(file);onNotice(result==='share'?'Choose Save Image or your photo app in the share sheet.':'Photo download started.');}catch(e){if(e.name!=='AbortError'){downloadPhoto(photo);onNotice('Photo download started.');}}finally{setBusy(false);}}
 return <button type="button" className="text-link" disabled={busy} onClick={save}><Download size={17}/>{busy?'Opening…':'Download photo'}</button>;
}
