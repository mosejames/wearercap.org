import {authClient} from '../trip-studio/client.js';
async function fingerprint(file){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');}
export async function request(slug,action='',body){
 const {data,error}=await authClient().auth.getSession();if(error)throw error;
 const u=new URL('/api/trip-engine',window.location.origin);u.searchParams.set('trip',slug);
 if(!body){if(action)u.searchParams.set('action',action);}
 const r=await fetch(u,{method:body?'POST':'GET',cache:'no-store',headers:{...(data.session?{Authorization:`Bearer ${data.session.access_token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify({action,...body})}:{})});
 const value=await r.json();if(!r.ok)throw Object.assign(Error(value.error||'Could not open this trip.'),{status:r.status});return value;
}
export async function gallery(slug,params={}){
 const {data}=await authClient().auth.getSession();const url=new URL('/api/trip-engine',location.origin);url.searchParams.set('trip',slug);for(const[k,v]of Object.entries(params))if(v!==undefined&&v!==null)url.searchParams.set(k,String(v));
 const r=await fetch(url,{cache:'no-store',headers:data.session?{Authorization:`Bearer ${data.session.access_token}`}:{}});const value=await r.json();if(!r.ok)throw Object.assign(Error(value.error||'Could not open this trip.'),{status:r.status});return value;
}
export function photoShareUrl(slug,photo){return new URL(`/trips/${encodeURIComponent(slug)}/e/${encodeURIComponent(photo.album)}/p/${photo.id}`,location.origin).href;}
export function downloadUrl(slug,photo){const url=new URL('/api/trip-engine',location.origin);Object.entries({trip:slug,action:'download',photo:photo.id,album:photo.album}).forEach(([k,v])=>url.searchParams.set(k,v));return url.href;}
export async function upload(slug,files,{name,group,onProgress}){
 const {prepareImage}=await import('../vault/images.js');let uploaded=0,skipped=0;const errors=[],seen=new Set();
 for(let i=0;i<files.length;i++){
  const file=files[i];try{
   if(file.size>50*1024*1024||!/^image\//.test(file.type)&&! /\.(heic|heif)$/i.test(file.name))throw Error('Choose a photo under 50 MB.');
   onProgress(`Preparing ${i+1} of ${files.length}…`);const hash=await fingerprint(file);if(seen.has(hash)){skipped++;continue;}seen.add(hash);
   const image=await prepareImage(file);const metadata={id:image.id,hash,ext:image.ext,contentType:image.contentType,width:image.width,height:image.height,bytes:image.orig.size,takenAt:image.takenAt?.toISOString()||null,name:name.trim(),group};
   const signed=await request(slug,'sign',metadata);if(signed.duplicate){skipped++;continue;}
   onProgress(`Sharing ${i+1} of ${files.length}…`);
   for(const[part,blob]of[['orig',image.orig],['web',image.web],['thumb',image.thumb]]){const r=await fetch(signed.urls[part],{method:'PUT',headers:{'Content-Type':part==='orig'?image.contentType:'image/jpeg'},body:blob});if(!r.ok)throw Error('The connection dropped. Try this photo again.');}
   const result=await request(slug,'finalize',metadata);if(result.duplicate)skipped++;else uploaded++;
  }catch(e){errors.push({name:file.name,error:e.message});}
 }
 return {uploaded,skipped,errors};
}
export function browserToken(slug){const key=`trip-engine:${slug}:conversation`;try{const value=localStorage.getItem(key);if(/^[a-f0-9]{64}$/.test(value||''))return value;}catch{}const value=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');try{localStorage.setItem(key,value);}catch{}return value;}
