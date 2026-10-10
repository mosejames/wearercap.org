// Read metadata before compression so long clips never start expensive work.
export async function videoDuration(file, {signal}={}) {
 const video=document.createElement('video');const url=URL.createObjectURL(file);let timer;
 try{return await new Promise((resolve,reject)=>{
  const abort=()=>reject(signal.reason || new DOMException('Cancelled','AbortError'));
  signal?.throwIfAborted();signal?.addEventListener('abort',abort,{once:true});
  const finish=(error)=>{signal?.removeEventListener('abort',abort);error?reject(error):resolve(video.duration);};
  timer=setTimeout(()=>finish(new Error('Could not read this clip. Try a short MP4 video.')),15000);
  video.preload='metadata';video.onloadedmetadata=()=>finish(Number.isFinite(video.duration)&&video.duration>0?null:new Error('Could not read the video length. Try another clip.'));
  video.onerror=()=>finish(new Error('Could not read this clip. Try a short MP4 video.'));video.src=url;
 });}finally{clearTimeout(timer);video.onloadedmetadata=null;video.onerror=null;video.removeAttribute('src');video.load();URL.revokeObjectURL(url);}
}
