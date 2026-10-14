export function canSaveVideoFile(file=new File([], 'london-video.mp4',{type:'video/mp4'})) {
 try{return typeof navigator.share==='function' && typeof navigator.canShare==='function' && navigator.canShare({files:[file]});}catch{return false;}
}
export async function loadVideoFile(url,id,{signal}={}) {
 const response=await fetch(url,{signal});
 if(!response.ok)throw Error('Couldn’t prepare this video. Please try again.');
 const type=(response.headers.get('content-type')||'').split(';')[0];
 if(type && !['video/mp4','application/octet-stream','video/quicktime'].includes(type))throw Error('This download is not a video. Please try again.');
 const blob=await response.blob();
 const header=new Uint8Array(await blob.slice(0,32).arrayBuffer());
 if(header.length<12 || String.fromCharCode(...header.slice(4,8))!=='ftyp')throw Error('This download is not a video. Please try again.');
 return new File([blob],`london-2028-${id}.mp4`,{type:'video/mp4'});
}
export function downloadVideoFile(file){
 const url=URL.createObjectURL(file),link=document.createElement('a');
 link.href=url;link.download=file.name;link.style.display='none';document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
}
// Called directly by a tap with an already prepared file. Never share a poster or URL.
export async function saveVideoFile(file){
 if(canSaveVideoFile(file)){await navigator.share({files:[file]});return 'shared';}
 downloadVideoFile(file);return 'downloaded';
}
