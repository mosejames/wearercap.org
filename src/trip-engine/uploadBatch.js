// Shared real uploader. Local verification injects local HTTP endpoints, never storage credentials.
export async function fingerprint(file){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');}
export function putPhoto(url,blob,type,{signal,onActivity=()=>{},stallMs=90000}={}){
 return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();let timer,finished=false;const stop=()=>xhr.abort();const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);};const finish=(error)=>{if(finished)return;finished=true;cleanup();error?reject(error):resolve();};const activity=()=>{clearTimeout(timer);timer=setTimeout(()=>{finish(Error('The connection stopped responding. Try this photo again.'));xhr.abort();},stallMs);onActivity();};
  if(signal?.aborted){finish(new DOMException('Upload stopped','AbortError'));return;}xhr.open('PUT',url,true);xhr.setRequestHeader('Content-Type',type);xhr.upload.onprogress=activity;xhr.onload=()=>finish(xhr.status>=200&&xhr.status<300?null:Error('The connection dropped. Try this photo again.'));xhr.onerror=()=>finish(Error('The connection dropped. Try this photo again.'));xhr.onabort=()=>finish(new DOMException('Upload stopped','AbortError'));signal?.addEventListener('abort',stop,{once:true});activity();xhr.send(blob);
 });
}
export async function uploadBatch(slug,items,{name,group,onItem=()=>{},onProgress=()=>{},signal,requestFn,prepare,put=putPhoto,hashFile=fingerprint}){
 if(!name?.trim()||!group)throw Error('Add your name and upload group.');if(items.length>60)throw Error('Choose up to 60 photos per batch.');
 const result={uploaded:0,skipped:0,errors:[],items:[]},known=new Map();
 for(let i=0;i<items.length;i++){
  const input=items[i],file=input.file||input,id=input.file?input.id:crypto.randomUUID();let hash=input.hash,metadata=input.metadata,uncertain=Boolean(input.uncertain);
  const emit=(status,extra={})=>{const state={id,status,...extra};onItem(state);return state;};
  if(signal?.aborted){const state=emit('failed',{error:'Not shared. This batch was stopped.',file,uncertain:Boolean(input.uncertain)});result.errors.push(state);result.items.push(state);continue;}
  try{
   if(file.size>50*1024*1024||!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)&&! /\.(heic|heif)$/i.test(file.name))throw Error('Choose a JPEG, PNG, WebP or HEIC photo under 50 MB.');
   emit('active',{phase:'preparing'});onProgress(`Preparing photo ${i+1} of ${items.length}…`);hash=hash||await hashFile(file);if(signal?.aborted)throw new DOMException('Upload stopped','AbortError');
   if(known.has(hash)){result.skipped++;result.items.push(emit('duplicate',{hash}));continue;}
   const image=await prepare(file);if(signal?.aborted)throw new DOMException('Upload stopped','AbortError');
   metadata={id:metadata?.id||image.id,hash,ext:image.ext,contentType:image.contentType,width:image.width,height:image.height,bytes:image.orig.size,takenAt:image.takenAt?.toISOString()||null,name:name.trim(),group};
   emit('active',{phase:'checking',hash,metadata});const signed=await requestFn(slug,'sign',metadata,{signal});
   if(signed.duplicate){known.set(hash,true);if(input.uncertain&&signed.confirmed){result.uploaded++;result.items.push(emit('shared',{hash,metadata,photoId:signed.existingId}));}else{result.skipped++;result.items.push(emit('duplicate',{hash,metadata}));}continue;}
   // Always use the reservation's canonical ID, including when an older attempt reserved it.
   uncertain=false;metadata={...metadata,id:signed.id||metadata.id};emit('active',{phase:'transferring',hash,metadata});onProgress(`Sharing photo ${i+1} of ${items.length}…`);
   for(const[part,blob]of[['orig',image.orig],['web',image.web],['thumb',image.thumb]]){if(!signed.urls?.[part])throw Error('Could not prepare photo storage.');await put(signed.urls[part],blob,part==='orig'?image.contentType:'image/jpeg',{signal,onActivity:()=>onProgress(`Sharing photo ${i+1} of ${items.length}…`)});}
   emit('active',{phase:'confirming',hash,metadata});onProgress('Confirming that your photo is in the album…');uncertain=true;
   const saved=await requestFn(slug,'finalize',metadata,{signal});uncertain=false;known.set(hash,true);
   if(saved.duplicate&&!saved.confirmed){result.skipped++;result.items.push(emit('duplicate',{hash,metadata}));}else{result.uploaded++;result.items.push(emit('shared',{hash,metadata,photoId:saved.id||saved.existingId||metadata.id}));}
  }catch(e){const state=emit('failed',{file,hash,metadata,uncertain,error:e.name==='AbortError'?'Sharing stopped. Retry to check whether this photo was saved.':e.name==='TimeoutError'?'The connection stopped responding. Retry this photo when it returns.':e.message||'This photo needs another try.'});result.errors.push(state);result.items.push(state);}
 }
 return result;
}
