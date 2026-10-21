import {createClient} from '@supabase/supabase-js';
import {fingerprint} from './preview.js';
export const client=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY,{auth:{storageKey:'nyc-2026-verified-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
async function rpc(name,args){const {data,error}=await client.rpc(name,args);if(error)throw error;return data;}
let publicBase;
export async function mediaBase(){if(!publicBase){const r=await fetch('/api/nyc-sign',{cache:'no-store'});const d=await r.json();if(!r.ok||!d.publicBase)throw Error('Photo sharing is not ready yet. Please keep your originals.');publicBase=d.publicBase.replace(/\/+$/,'');}return publicBase;}
export async function listPhotos(album=null){const [base,rows]=await Promise.all([mediaBase(),rpc('trip_gallery',{p_vault:'nyc-2026',p_album:album})]);return rows.map(p=>({...p,web:`${base}/${p.webKey}`,thumb:`${base}/${p.thumbKey}`,original:`${base}/${p.key}`}));}
export async function hidePhoto(id){await rpc('trip_hide_photo',{p_vault:'nyc-2026',p_id:id});}
export async function uploadPhotos(files,{album,name,scholar,onProgress=()=>{}}){
 const {data}=await client.auth.getSession();if(!data.session)throw Error('Please sign in first.');
 const {prepareImage}=await import('../vault/images.js');let uploaded=0,skipped=0;const errors=[],seen=new Set();
 for(const file of files){
  try{
   if(file.size>50*1024*1024||!/^image\//.test(file.type)&&! /\.(heic|heif)$/i.test(file.name))throw Error('Choose photos under 50 MB.');
   onProgress(`Preparing ${uploaded+skipped+errors.length+1} of ${files.length}…`);
   const hash=await fingerprint(file);if(seen.has(hash)){skipped++;continue;}seen.add(hash);
   const image=await prepareImage(file);const r=await fetch('/api/nyc-sign',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session.access_token}`},body:JSON.stringify({id:image.id,album,ext:image.ext,contentType:image.contentType,bytes:image.orig.size,hash})});
   const signed=await r.json();if(!r.ok)throw Error(signed.error||'Could not prepare upload.');if(signed.duplicate){skipped++;continue;}
   onProgress(`Uploading ${uploaded+skipped+errors.length+1} of ${files.length}…`);
   for(const [part,blob] of [['orig',image.orig],['web',image.web],['thumb',image.thumb]]){const put=await fetch(signed.urls[part],{method:'PUT',headers:{'Content-Type':part==='orig'?image.contentType:'image/jpeg'},body:blob});if(!put.ok)throw Error('The connection dropped. Please try this photo again.');}
   const added=await rpc('trip_add_photo',{p_id:image.id,p_vault:'nyc-2026',p_album:album,p_hash:hash,p_ext:image.ext,p_name:name.trim(),p_scholar:scholar.trim(),p_width:image.width,p_height:image.height,p_bytes:image.orig.size,p_taken:image.takenAt?.toISOString()||null});
   if(added)uploaded++;else skipped++;
  }catch(error){errors.push({name:file.name,error:error.message});}
 }
 return {uploaded,skipped,errors};
}
