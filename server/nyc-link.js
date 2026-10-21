import {serveTripCard} from './trip-link.js';
export default async function handler(req,res){
 const base=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
 return serveTripCard(req,res,{
  publicBase:process.env.R2_PUBLIC_BASE||'',
  lookupEvent:async(vault,slug)=>['send-off','the-whole-adventure'].includes(slug)?{id:slug,slug,vault,title:slug==='send-off'?'And they’re off':'The whole adventure',hidden:false}:null,
  lookupVisiblePhoto:async(vault,album,id)=>{
   if(!base||!key)return null;
   const r=await fetch(`${base}/rest/v1/rpc/trip_gallery`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_vault:vault,p_album:album,p_id:id}),signal:AbortSignal.timeout(4000)});
   if(!r.ok)return null;const rows=await r.json(),p=rows.find(p=>p.id===id&&p.vault===vault&&p.album===album);
   return p?{...p,event_id:p.album,storage:'r2',web_key:p.webKey}:null;
  }
 });
}
