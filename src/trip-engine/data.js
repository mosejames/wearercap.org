import {uploadBatch} from './uploadBatch.js';
import {authClient} from '../trip-studio/client.js';
export async function request(slug,action='',body,{signal}={}){
 const {data,error}=await authClient().auth.getSession();if(error)throw error;
 const u=new URL('/api/trip-engine',window.location.origin);u.searchParams.set('trip',slug);
 if(!body){if(action)u.searchParams.set('action',action);}
 const deadline=AbortSignal.timeout(45000);const requestSignal=signal?AbortSignal.any([signal,deadline]):deadline;
 const r=await fetch(u,{signal:requestSignal,method:body?'POST':'GET',cache:'no-store',headers:{...(data.session?{Authorization:`Bearer ${data.session.access_token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify({action,...body})}:{})});
 const value=await r.json();if(!r.ok)throw Object.assign(Error(value.error||'Could not open this trip.'),{status:r.status});return value;
}
export async function gallery(slug,params={}){
 const {data}=await authClient().auth.getSession();const url=new URL('/api/trip-engine',location.origin);url.searchParams.set('trip',slug);for(const[k,v]of Object.entries(params))if(v!==undefined&&v!==null)url.searchParams.set(k,String(v));
 const r=await fetch(url,{cache:'no-store',headers:data.session?{Authorization:`Bearer ${data.session.access_token}`}:{}});const value=await r.json();if(!r.ok)throw Object.assign(Error(value.error||'Could not open this trip.'),{status:r.status});return value;
}
export function photoShareUrl(slug,photo){return new URL(`/trips/${encodeURIComponent(slug)}/e/${encodeURIComponent(photo.album)}/p/${photo.id}`,location.origin).href;}
export function downloadUrl(slug,photo){const url=new URL('/api/trip-engine',location.origin);Object.entries({trip:slug,action:'download',photo:photo.id,album:photo.album}).forEach(([k,v])=>url.searchParams.set(k,v));return url.href;}
export async function upload(slug,files,options){
 const {prepareImage}=await import('../vault/images.js');
 return uploadBatch(slug,files,{...options,requestFn:options.requestFn||request,prepare:prepareImage});
}
export function browserToken(slug){const key=`trip-engine:${slug}:conversation`;try{const value=localStorage.getItem(key);if(/^[a-f0-9]{64}$/.test(value||''))return value;}catch{}const value=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');try{localStorage.setItem(key,value);}catch{}return value;}
