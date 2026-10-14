import sharp from 'sharp';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {objectRequest,encrypt,decrypt} from '../london-stories/storage.js';
const KEY='_automation/london-dedupe/index';
const HASH=/^[a-f0-9]{64}$/;
export async function describeThumb(bytes){
 const image=sharp(bytes,{limitInputPixels:2000000}).rotate();const meta=await image.metadata();
 const pixels=await image.resize(32,32,{fit:'fill'}).removeAlpha().toColourspace('srgb').raw().toBuffer();
 if(pixels.length!==3072)throw Error('Invalid thumbnail');
 return {pixels:pixels.toString('base64'),aspect:meta.width/meta.height};
}
export function sameImage(a,b){
 if(!a.pixels||!b.pixels||Math.abs(a.aspect-b.aspect)>.015)return false;
 const x=Buffer.from(a.pixels,'base64'),y=Buffer.from(b.pixels,'base64');if(x.length!==3072||y.length!==3072)return false;
 let sum=0,large=0;for(let i=0;i<x.length;i++){const d=Math.abs(x[i]-y[i]);sum+=d*d;if(d>20)large++;}
 // Whole-image comparison only. Similar bursts, crops, and changed overlays stay separate.
 return Math.sqrt(sum/x.length)<1.5 && large/x.length<.001;
}
export function reserveEntries(entries,files,published,now=Date.now()){
 const next=entries.map(e=>published.has(e.id)?{...e,confirmed:true}:e);const results=[];
 for(const f of files){
  const match=next.find(e=>(e.confirmed||e.until>now)&&(e.hash&&e.hash===f.hash || f.kind==='photo'&&e.kind==='photo'&&sameImage(e,f)));
  if(match){
   if(!match.confirmed && (match.id!==f.id || match.owner!==f.owner))throw Error('This photo is already being shared. Please try again shortly.');
   if(match.confirmed){results.push({id:f.id,duplicate:true,existingId:match.id});continue;}
   results.push({id:f.id});continue;
  }
  next.push({...f,confirmed:false,until:now+20*60000});results.push({id:f.id});
 }
 return {entries:next,results};
}
async function load(){const r=await objectRequest(KEY);if(r.status===404){const seed=JSON.parse(fs.readFileSync(new URL('./seed.json',import.meta.url),'utf8'));return{entries:decrypt(Buffer.from(seed.encrypted,'base64')),etag:null};}if(!r.ok)throw Error('Duplicate check unavailable');return{entries:decrypt(Buffer.from(await r.arrayBuffer())),etag:r.headers.get('etag')};}
async function write(entries,etag){return objectRequest(KEY,{method:'PUT',headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store',...(etag?{'If-Match':etag}:{'If-None-Match':'*'})},body:encrypt(entries)});}
export async function guardUploads(files,photos,owner){
 const prepared=await Promise.all(files.map(async f=>{
  if(!f.sourceHash&&!f.duplicateThumb)return null;
  if(!HASH.test(f.sourceHash||''))throw Error('Please choose your photos again.');
  const photo=f.contentType.startsWith('image/');let visual={};
  if(photo){if(typeof f.duplicateThumb!=='string'||f.duplicateThumb.length>400000||!/^[A-Za-z0-9+/=]+$/.test(f.duplicateThumb))throw Error('Please choose your photos again.');visual=await describeThumb(Buffer.from(f.duplicateThumb,'base64'));}
  return {id:f.id,owner,hash:f.sourceHash,kind:photo?'photo':'video',...visual};
 }));
 if(prepared.every(p=>!p))return new Map();
 const published=new Set(photos.map(p=>p.id));
 // Include uploads made by older tabs and other approved import routes.
 let additions=null;
 for(let attempt=0;attempt<6;attempt++){
  const state=await load();const known=new Set(state.entries.map(e=>e.id));
  if(!additions){const missing=photos.filter(p=>p.kind==='photo'&&!known.has(p.id));additions=[];let cursor=0;
   await Promise.all(Array.from({length:6},async()=>{while(cursor<missing.length){const p=missing[cursor++];const r=await objectRequest(p.thumb_key);if(!r.ok)throw Error('Could not check existing photos.');additions.push({id:p.id,kind:'photo',confirmed:true,...await describeThumb(Buffer.from(await r.arrayBuffer()))});}}));}
  const entries=[...state.entries,...additions.filter(e=>!known.has(e.id))];
  const reserved=reserveEntries(entries,prepared.filter(Boolean),published);
  const r=await write(reserved.entries,state.etag);
  if(r.status===409||r.status===412)continue;if(!r.ok)throw Error('Could not check for duplicates.');
  return new Map(reserved.results.map(r=>[r.id,r]));
 }
 throw Error('The album is busy. Please try sharing again shortly.');
}
export async function galleryPhotos(){
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
 const r=await fetch(`${url}/rest/v1/rpc/m3_list_photos`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_token:crypto.randomBytes(24).toString('hex'),p_vault:'london-2028',p_mode:'recent',p_limit:5000}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Could not check the gallery.');return(await r.json()).map(r=>r.photo);
}
