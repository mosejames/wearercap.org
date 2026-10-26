import {createHash} from 'node:crypto';
import {readRegistry,writeRegistry,open} from '../trip-studio/storage.js';
import {engineRpc,problem} from './rpc.js';
import {r2,aws,objectUrl,UUID} from './storage.js';
const PREFIX='_private/trip-engine/exports/';
export function isVerificationDraft(d){return d?.id!=='dc-draft'&&UUID.test(d?.id||'')&&d.destination?.startsWith('Temporary verification trip ')&&/^verification-flow-[a-z0-9-]+$/.test(d.slug||'');}
async function discardRpc(req,body,apply){
 const base=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
 const r=await fetch(`${base}/rest/v1/rpc/trip_engine_discard_test`,{method:'POST',headers:{apikey:key,Authorization:req.headers.authorization,'Content-Type':'application/json'},body:JSON.stringify({p_draft:body.id,p_version:body.version,p_confirm:body.confirm,p_apply:apply}),signal:AbortSignal.timeout(15000)});
 const value=await r.json();if(!r.ok)throw problem(value.message||'Could not clean up this verification trip.',r.status===401?401:409);return value;
}
function storageUrl(path){if(path.split('/').some(s=>s==='.'||s==='..')||!/^(_private\/trip-engine\/exports\/|_exports\/trip-engine\/)[a-z0-9/.-]+$/.test(path))throw problem('Invalid cleanup path.');const c=r2();return new URL(`https://${c.account}.r2.cloudflarestorage.com/${c.bucket}/${path}`);}
async function listStateKeys(){const c=r2(),client=aws(),keys=[];let continuation;
 do{const u=new URL(`https://${c.account}.r2.cloudflarestorage.com/${c.bucket}`);u.searchParams.set('list-type','2');u.searchParams.set('prefix',PREFIX);if(continuation)u.searchParams.set('continuation-token',continuation);const r=await client.fetch(u,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw problem('Could not inspect test delivery records.',503);const xml=await r.text();keys.push(...[...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m=>m[1]));continuation=xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1];if(keys.length>10000)throw problem('Too many delivery records for automatic test cleanup.',409);}while(continuation);return keys;
}
async function inspectExports(slug,tripId){const keys=await listStateKeys(),records=[];for(const key of keys){if(!key.startsWith(PREFIX))continue;const r=await aws().fetch(storageUrl(key),{signal:AbortSignal.timeout(15000)});if(r.status===404)continue;if(!r.ok)throw problem('Could not inspect test delivery state.',503);records.push({key,value:open(Buffer.from(await r.arrayBuffer()))});}
 const jobs=records.filter(r=>r.key.startsWith(PREFIX+'jobs/')&&r.value.slug===slug);
 if(jobs.some(r=>r.value.leaseUntil>Date.now()))throw problem('Wait for this test’s download worker to finish before cleanup.',409);
 const ids=new Set(jobs.map(r=>r.key.slice((PREFIX+'jobs/').length))),index=PREFIX+'indexes/'+createHash('sha256').update(slug).digest('hex');
 const selected=records.filter(r=>r.value.slug===slug||ids.has(r.value.id)||r.key===index);
 const archives=jobs.map(r=>r.value.archiveKey).filter(Boolean);if(archives.some(key=>!tripId||!key.startsWith(`_exports/trip-engine/${tripId}/`)))throw problem('An archive does not match this verification trip.',409);
 return {records:selected,archives};
}
async function remove(url){const r=await aws().fetch(url,{method:'DELETE',signal:AbortSignal.timeout(15000)});if(!r.ok&&r.status!==404)throw problem('A test file could not be removed. Retry cleanup.',503);}
export async function discardTest(req,body){
 const {registry}=await readRegistry(),draft=registry?.trips.find(t=>t.id===body.id);
 const preserve=body.preserveDraft===true;
 const live=preserve?(await engineRpc('list',{},req.headers.authorization)).find(t=>t.draftId===body.id):null;
 const slug=preserve?live?.slug:draft?.slug;
 if(!draft||draft.id==='dc-draft'||(preserve?(!UUID.test(draft.id)||live?.published||!/^verification-flow-[a-z0-9-]+$/.test(slug||'')):!isVerificationDraft(draft))||body.confirm!==slug)throw problem('Only the confirmed disposable verification trip can be removed.',403);
 if(body.revision!==registry.revision)throw problem('Refresh the draft list before cleanup.',409);
 const manifest=await discardRpc(req,body,false),exports=await inspectExports(slug,manifest.tripId);
 const media=manifest.photos.flatMap(p=>[p.key,p.webKey,p.thumbKey]);if(media.some(key=>!manifest.tripId||!key.startsWith(`trip-engine/v1/${manifest.tripId}/`)))throw problem('A photo does not match this verification trip.',409);
 // Unpublishing is required before this point. Keep database rows until every
 // object deletion succeeds, so a failed cleanup remains inspectable and retryable.
 for(const key of media)await remove(objectUrl(key));
 for(const key of exports.archives)await remove(storageUrl(key));
 for(const record of exports.records)await remove(storageUrl(record.key));
 await discardRpc(req,body,true);
 if(preserve){const current=await readRegistry();return {...current.registry,liveTrips:await engineRpc('list',{},req.headers.authorization),cleanupNotice:'Old verification vault and files removed. Your saved draft was preserved.'};}
 // Re-read after remote work so concurrent edits to DC or another trip survive.
 for(let attempt=0;attempt<3;attempt++){
  const current=await readRegistry();if(!current.registry)throw problem('Could not reload the draft list.',503);
  const next={...current.registry,revision:current.registry.revision+1,trips:current.registry.trips.filter(t=>t.id!==draft.id)};
  try{await writeRegistry(next,current.etag);return {...next,liveTrips:await engineRpc('list',{},req.headers.authorization)};}catch(e){if(e.status!==409||attempt===2)throw e;}
 }
}
