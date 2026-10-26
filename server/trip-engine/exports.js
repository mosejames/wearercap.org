import crypto from 'node:crypto';
import {QueueClient} from '@vercel/queue';
import {engineRpc,bearer,problem} from './rpc.js';
import {r2,objectUrl,aws,UUID} from './storage.js';
import {seal,open} from '../trip-studio/storage.js';
import {zipStream} from '../../src/vault/zipstream.js';
export const TOPIC='trip-vault-exports';
export const queue=new QueueClient({region:'iad1'});
const ORIGIN='https://wearercap.org',EMAIL=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/,TOKEN=/^[a-f0-9]{64}$/;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),token=()=>crypto.randomBytes(32).toString('hex');
function privateUrl(path){if(!/^(_private\/trip-engine\/exports\/|_exports\/trip-engine\/)[a-z0-9/.-]+$/.test(path))throw Error('Invalid export path');const c=r2();return new URL(`https://${c.account}.r2.cloudflarestorage.com/${c.bucket}/${path}`);}
async function object(path,init={}){return aws().fetch(privateUrl(path),{...init,signal:AbortSignal.timeout(30000)});}
export async function read(path){const r=await object('_private/trip-engine/exports/'+path);if(r.status===404)return {value:null,etag:null};if(!r.ok)throw Error('Export state unavailable');const etag=r.headers.get('etag');if(!etag)throw Error('Export version unavailable');return {value:open(Buffer.from(await r.arrayBuffer())),etag};}
export async function write(path,value,etag){const r=await object('_private/trip-engine/exports/'+path,{method:'PUT',body:seal(value),headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store',...(etag?{'If-Match':etag}:{'If-None-Match':'*'})}});if(!r.ok)throw Error('The download request changed. Please refresh.');return r.headers.get('etag');}
export async function fullGallery(slug){let photos=[],offset=0,total;let trip;do{const value=await engineRpc('get',{slug,offset,limit:100});if(total!==undefined&&total!==value.count)throw Error('The album changed. Please request a fresh download.');trip=value.trip;total=value.count;photos.push(...value.photos);offset=photos.length;if(!value.hasMore)break;if(!value.photos.length)throw Error('The complete album could not be loaded.');}while(offset<50000);if(!photos.length||new Set(photos.map(p=>p.id)).size!==total)throw Error('The complete album could not be loaded.');return {trip,photos:photos.sort((a,b)=>a.id.localeCompare(b.id))};}
async function addIndex(slug,id){const path=`indexes/${hash(slug)}`;const current=await read(path);await write(path,{ids:[id,...(current.value?.ids||[])].slice(0,100)},current.etag);}
async function cleanupLater(id,expires){await queue.send(TOPIC,{type:'cleanup',id},{delaySeconds:Math.max(0,Math.min(604000,Math.ceil((expires-Date.now())/1000))),retentionSeconds:604800,idempotencyKey:`cleanup-${id}`});}
async function enqueue(id){await queue.send(TOPIC,{type:'prepare',id},{retentionSeconds:259200,idempotencyKey:`prepare-${id}-${Date.now()}`});}
async function createJob(inviteValue,email){const invitation=await read(`invites/${hash(inviteValue)}`),invite=invitation.value;if(!invite||invite.expires<=Date.now())throw problem('This invitation expired. Ask for a fresh link.',410);if(!EMAIL.test(email)||email.length>254||invite.email&&invite.email!==email)throw problem('Use the email address for this invitation.');
 const key=`requests/${hash(inviteValue+'/'+email)}`,existing=await read(key);if(existing.value?.expires>Date.now()){const old=await read(`jobs/${existing.value.id}`);if(old.value&&old.value.status!=='revoked'&&old.value.status!=='expired'){if(['queued','failed','email-failed'].includes(old.value.status)&&!(old.value.leaseUntil>Date.now())){await cleanupLater(existing.value.id,old.value.expires);await enqueue(existing.value.id);}return existing.value.id;}}
 if((invite.requests||0)>=10)throw problem('Please ask the organizer for a fresh invitation.',429);
 const available=await engineRpc('get',{slug:invite.slug,limit:1});if(!available.count)throw problem('No photos have been shared yet. Request downloads after photos arrive.');
 const id=token(),receipt=token(),expires=Math.min(invite.expires,Date.now()+invite.days*86400000);
 await write(`invites/${hash(inviteValue)}`,{...invite,requests:(invite.requests||0)+1},invitation.etag);
 await write(`jobs/${id}`,{slug:invite.slug,email,expires,receipt,inviteHash:hash(inviteValue),videoUrl:invite.videoUrl,status:'queued',progress:0,attempt:1});
 await write(`receipts/${hash(receipt)}`,{id,slug:invite.slug,expires});await write(key,{id,expires},existing.etag);await addIndex(invite.slug,id);await cleanupLater(id,expires);await enqueue(id);return id;
}
export async function exportHandler(req,res){const q=req.query||{},slug=q.trip;
 try{
  if(req.method==='GET'){
   if(q.action==='export-info'){
    if(!TOKEN.test(q.invite||''))throw problem('Invalid invitation.',404);const{value}=await read(`invites/${hash(q.invite)}`);if(!value||value.slug!==slug||value.expires<=Date.now())throw problem('This invitation expired. Ask for a fresh link.',410);await engineRpc('get',{slug,limit:1});return res.status(200).json({email:value.email||'',expires:value.expires});
   }
   if(q.action==='export-file'||q.action==='export-receipt'||q.action==='export-video'){
    if(!TOKEN.test(q.receipt||''))throw problem('Invalid download link.',404);const{value:receipt}=await read(`receipts/${hash(q.receipt)}`);if(!receipt||receipt.slug!==slug||receipt.expires<=Date.now())throw problem('This download expired. Request a fresh link.',410);const{value:job}=await read(`jobs/${receipt.id}`);if(!job||job.receipt!==q.receipt||job.expires<=Date.now()||['revoked','expired'].includes(job.status))throw problem('This download expired.',410);
    await engineRpc('get',{slug,limit:1});
    if(q.action==='export-video'){if(!job.videoUrl||!/^https:\/\//.test(job.videoUrl))throw problem('This trip has no video download folder.',404);return res.redirect(302,job.videoUrl);}
    if(q.action==='export-receipt')return res.status(200).json({status:job.status,count:job.photos?.length||0,expires:job.expires,videoUrl:job.videoUrl||'',ready:Boolean(job.archiveKey)});
    if(!job.archiveKey)throw problem('Your photo download is not ready yet.',409);const gallery=await fullGallery(slug);const visible=new Set(gallery.photos.map(p=>p.id));if(job.photos.some(p=>!visible.has(p.id)))throw problem('The gallery changed. Request a fresh download.',409);
    const url=privateUrl(job.archiveKey);url.searchParams.set('X-Amz-Expires','60');url.searchParams.set('response-content-disposition','attachment; filename="RCA-Trip-Photos.zip"');return res.redirect(302,(await aws().sign(new Request(url),{aws:{signQuery:true}})).url);
   }
   throw problem('Unknown download request.');
  }
  let b=req.body;if(typeof b==='string')b=JSON.parse(b);if(!b||JSON.stringify(b).length>10000)throw problem('Invalid download request.');
  if(b.action==='export-request'){await engineRpc('get',{slug,limit:1});const{value:invite}=TOKEN.test(b.invite||'')?await read(`invites/${hash(b.invite)}`):{value:null};if(!invite||invite.slug!==slug)throw problem('Invalid invitation.',404);await createJob(b.invite,String(b.email||'').trim().toLowerCase());return res.status(202).json({ok:true});}
  const authorization=bearer(req),settings=await engineRpc('export-settings',{slug},authorization);
  if(b.action==='export-jobs'){const{value:index}=await read(`indexes/${hash(slug)}`);const jobs=[];for(const id of (index?.ids||[]).slice(0,30)){const{value:j}=await read(`jobs/${id}`);if(j)jobs.push({id,email:j.email,status:j.expires<=Date.now()?'expired':j.status,progress:j.progress||0,count:j.photos?.length||0,error:j.error||'',expires:j.expires});}return res.status(200).json({jobs});}
  if(b.action==='export-invite'){
   const email=String(b.email||'').trim().toLowerCase();if(!EMAIL.test(email)||email.length>254)throw problem('Enter a valid recipient email.');await engineRpc('get',{slug,limit:1},authorization);
   const value=token(),expires=Date.now()+settings.exportDays*86400000;await write(`invites/${hash(value)}`,{slug,email:settings.recipientBinding?email:'',expires,days:settings.exportDays,videoUrl:settings.videoDownloadUrl||'',requests:0});
   let id;if(b.prepare)id=await createJob(value,email);return res.status(200).json({url:`${ORIGIN}/trip-vault/?trip=${encodeURIComponent(slug)}&download=${value}`,expires,id});
  }
  if(!TOKEN.test(b.id||''))throw problem('Choose a download job.');const state=await read(`jobs/${b.id}`),job=state.value;if(!job||job.slug!==slug)throw problem('Download job not found.',404);
  if(b.action==='export-revoke'){await write(`jobs/${b.id}`,{...job,status:'revoked',expires:Date.now()},state.etag);const invite=await read(`invites/${job.inviteHash}`);if(invite.value)await write(`invites/${job.inviteHash}`,{...invite.value,expires:Date.now()},invite.etag);await queue.send(TOPIC,{type:'cleanup',id:b.id},{retentionSeconds:86400});return res.status(200).json({ok:true});}
  if(b.action==='export-retry'){if(job.expires<=Date.now()||job.status==='revoked')throw problem('Create a new invitation after expiration.',410);if(job.leaseUntil>Date.now())throw problem('This download is still being prepared.',409);if(job.error?.includes('gallery changed')&&job.archiveKey){await object(job.archiveKey,{method:'DELETE'});job.archiveKey=null;job.photos=null;job.progress=0;}await write(`jobs/${b.id}`,{...job,status:'queued',error:'',attempt:(job.attempt||1)+1},state.etag);await enqueue(b.id);return res.status(202).json({ok:true});}
  throw problem('Unknown download action.');
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Could not prepare this download request. Please try again.'});}
}
async function multipart(path,stream){const client=aws(),start=privateUrl(path);start.searchParams.set('uploads','');const r=await client.fetch(start,{method:'POST',headers:{'Content-Type':'application/zip'}});const id=r.ok?(await r.text()).match(/<UploadId>([^<]+)<\/UploadId>/)?.[1]:null;if(!id)throw Error('Could not start archive storage.');let pending=Buffer.alloc(0);const parts=[];try{
 const put=async bytes=>{const u=privateUrl(path);u.searchParams.set('uploadId',id);u.searchParams.set('partNumber',String(parts.length+1));const r=await client.fetch(u,{method:'PUT',body:bytes,signal:AbortSignal.timeout(60000)});if(!r.ok||!r.headers.get('etag'))throw Error('Could not save an archive part.');parts.push(r.headers.get('etag'));};
 for await(const chunk of stream){pending=Buffer.concat([pending,chunk]);while(pending.length>=5242880){await put(pending.subarray(0,5242880));pending=pending.subarray(5242880);}}
 if(pending.length)await put(pending);const u=privateUrl(path);u.searchParams.set('uploadId',id);const xml='<CompleteMultipartUpload>'+parts.map((e,i)=>`<Part><PartNumber>${i+1}</PartNumber><ETag>${e.replaceAll('&','&amp;').replaceAll('"','&quot;')}</ETag></Part>`).join('')+'</CompleteMultipartUpload>';const done=await client.fetch(u,{method:'POST',headers:{'Content-Type':'application/xml'},body:xml});if(!done.ok||(await done.text()).includes('<Error>'))throw Error('Could not complete the archive.');
 }catch(e){const u=privateUrl(path);u.searchParams.set('uploadId',id);await client.fetch(u,{method:'DELETE'}).catch(()=>{});throw e;}}
export async function processExport(message,metadata={}){
 if(!TOKEN.test(message.id||''))throw Error('Invalid export job.');const id=message.id;let state=await read(`jobs/${id}`),job=state.value;if(!job)return;
 if(message.type==='cleanup'||job.expires<=Date.now()||job.status==='revoked'){
  if(job.expires>Date.now()&&job.status!=='revoked'){await cleanupLater(id,job.expires);return;}
  if(job.archiveKey)await object(job.archiveKey,{method:'DELETE'});await write(`jobs/${id}`,{...job,archiveKey:null,status:job.status==='revoked'?'revoked':'expired'},state.etag);return;
 }
 if(job.status==='sent')return;
 if(metadata.deliveryCount>5){await write(`jobs/${id}`,{...job,status:'failed',error:'Preparation stopped after repeated attempts. Refresh and retry.',leaseUntil:0},state.etag);return;}
 if(job.leaseUntil>Date.now())throw Error('This archive is already being prepared.');
 state.etag=await write(`jobs/${id}`,{...job,status:'preparing',leaseUntil:Date.now()+330000},state.etag);
 let archiveComplete=Boolean(job.archiveKey);
 try{
  const gallery=await fullGallery(job.slug);if(!job.archiveKey){job.photos=gallery.photos;job.tripId=gallery.trip.engineId;job.destination=gallery.trip.destination;job.cohort=gallery.trip.cohort;
   job.archiveKey=`_exports/trip-engine/${job.tripId}/${token()}/trip-photos.zip`;
   const pending=new Map();const preload=i=>{if(i>=job.photos.length||pending.has(i))return;const p=job.photos[i];if(p.tripId!==job.tripId||p.webKey!==`trip-engine/v1/${job.tripId}/${p.id}/web.jpg`||!UUID.test(p.id))throw Error('Invalid trip photo.');const promise=aws().fetch(objectUrl(p.webKey),{signal:AbortSignal.timeout(30000)});promise.catch(()=>{});pending.set(i,promise);};for(let i=0;i<4;i++)preload(i);
   let completed=0;const stream=zipStream(job.photos.map((p,i)=>({name:`${p.album}/${p.id}.jpg`,date:p.createdAt,open:async()=>{preload(i);const r=await pending.get(i);pending.delete(i);preload(i+4);if(!r.ok)throw Error('Could not retrieve a photo.');completed++;if(completed%25===0){job.progress=completed;state.etag=await write(`jobs/${id}`,{...job,status:'preparing',archiveKey:null,leaseUntil:Date.now()+330000},state.etag);}return r.body;}})));
   await multipart(job.archiveKey,stream);archiveComplete=true;job.progress=job.photos.length;state.etag=await write(`jobs/${id}`,{...job,status:'ready',leaseUntil:Date.now()+330000},state.etag);
  }
  const current=await fullGallery(job.slug),visible=new Set(current.photos.map(p=>p.id));if(job.photos.some(p=>!visible.has(p.id)))throw Error('The gallery changed. Prepare a new download.');
  const latest=await read(`jobs/${id}`);if(latest.value?.status==='revoked'||latest.value?.expires<=Date.now())return;
  const base=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.TRIP_ENGINE_EMAIL_KEY;if(!key)throw Error('Download email delivery is not configured.');
  const r=await fetch(`${base}/functions/v1/trip-export-email`,{method:'POST',headers:{'Content-Type':'application/json','X-Trip-Export-Key':key},body:JSON.stringify({id,attempt:job.attempt,email:job.email,destination:job.destination,cohort:job.cohort,count:job.photos.length,url:`${ORIGIN}/trip-vault/?trip=${encodeURIComponent(job.slug)}&archive=${job.receipt}`,expires:new Date(job.expires).toISOString(),hasVideos:Boolean(job.videoUrl)}),signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error('Download email delivery needs another try.');
  state.etag=await write(`jobs/${id}`,{...job,status:'sent',error:'',leaseUntil:0},state.etag);
  await cleanupLater(id,job.expires);
 }catch(e){const current=await read(`jobs/${id}`);if(current.value&&current.value.status!=='revoked')await write(`jobs/${id}`,{...job,archiveKey:archiveComplete?job.archiveKey:null,status:archiveComplete?'email-failed':'failed',error:e.message,leaseUntil:0},current.etag);throw e;}
}
