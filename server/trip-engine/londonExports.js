// London keeps its existing schema and passphrase. Only export requests use this adapter.
import {problem} from './rpc.js';
import {r2} from './storage.js';
export const LONDON='london-2028';
export const londonPage='https://wearercap.org/2028-london/';
async function rpc(name,args,range){
 const base=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
 if(!base||!key)throw problem('London downloads are not configured.',503);
 const r=await fetch(`${base}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...(range?{Range:range,'Range-Unit':'items',Prefer:'count=exact'}:{})},body:JSON.stringify(args),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw problem('London downloads are temporarily unavailable.',503);
 return {data:await r.json(),total:r.headers.get('content-range')?.split('/')[1]};
}
export async function londonGallery(){
 const base=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
 const events=await fetch(`${base}/rest/v1/m3_events?select=id,slug&vault=eq.london-2028&hidden=eq.false`,{headers:{apikey:key,Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});
 if(!events.ok)throw problem('London albums could not load.',503);
 const albums=new Map((await events.json()).map(e=>[e.id,e.slug]));let rows=[],expected;
 for(let offset=0;offset<5000;offset+=500){
  const page=await rpc('m3_list_photos',{p_vault:LONDON,p_mode:'order',p_limit:5000},`${offset}-${offset+499}`);
  if(!/^\d+$/.test(page.total||''))throw problem('The full London album could not be verified.',503);
  const count=Number(page.total);if(count>=5000||expected!==undefined&&expected!==count)throw problem('The album changed or is too large. Please try again.',409);expected=count;rows.push(...page.data);
  if(rows.length===expected)break;if(!page.data.length||rows.length>expected)throw problem('The full London album could not load.',503);
 }
 if(rows.length!==expected||new Set(rows.map(r=>r.photo.id)).size!==expected)throw problem('The full London album could not load.',503);
 const photos=rows.map(r=>r.photo).filter(p=>p.vault===LONDON&&!p.hidden&&p.kind!=='video'&&albums.has(p.event_id)).map(p=>({id:p.id,tripId:LONDON,album:albums.get(p.event_id),webKey:p.web_key,storage:p.storage,createdAt:p.taken_at||p.created_at}));
 if(!photos.length)throw problem('No visible London photos are available yet.');
 for(const p of photos)validateLondonPhoto(p);
 return {trip:{engineId:LONDON,destination:'London + Paris',cohort:'2028'},photos:photos.sort((a,b)=>a.id.localeCompare(b.id))};
}
// Replaced London photos can retain their row ID while referencing a new R2 rendition ID.
export function validateLondonPhoto(photo){
 if(photo.tripId!==LONDON||!/^london-2028\/[a-f0-9]{8}\/[a-z0-9-]{1,60}\/[a-f0-9-]{36}\/web\.jpg$/.test(photo.webKey))throw problem('Invalid London photo.',400);
 return photo.webKey;
}
export function londonMediaUrl(photo){
 const path=validateLondonPhoto(photo),c=r2();return new URL(`https://${c.account}.r2.cloudflarestorage.com/${c.bucket}/${path}`);
}
export async function londonExportRpc(action,_args,pass){
 if(action==='get'){const data=await londonGallery();return {...data,count:data.photos.length,hasMore:false};}
 if(action!=='export-settings'||typeof pass!=='string'||!pass||pass.length>200)throw problem('Open London admin to manage downloads.',403);
 const checked=await rpc('m3_pass_ok',{p_vault:LONDON,p_pass:pass});if(checked.data!==true)throw problem('That London admin passphrase was not recognized.',403);
 return {exportDays:7,recipientBinding:true,videoDownloadUrl:''};
}
