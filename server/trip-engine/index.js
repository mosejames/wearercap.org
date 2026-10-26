import {engineRpc,bearer,problem} from './rpc.js';
import {signPhoto,withUrls,UUID,downloadUrl,aws,objectUrl} from './storage.js';
const POST_ACTIONS=new Set(['sign','finalize','conversation','own-photo','moderation','admin-photo','set-group']);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
 try{
  const q=req.query||{};
  let action=req.method==='GET'?q.action:(typeof req.body==='string'?JSON.parse(req.body):req.body)?.action;
  if(typeof action==='string'&&action.startsWith('export-')){const {exportHandler}=await import('./exports.js');return exportHandler(req,res);}
  if(req.method==='GET'){
   const result=await engineRpc('get',{slug:q.trip,album:q.album||null,id:q.photo||null,offset:Number(q.offset)||0},req.headers?.authorization);
   if(q.action==='download'){
    const photo=result.photos.find(p=>p.id===q.photo&&p.album===q.album&&p.tripId===result.trip.engineId);
    if(!photo)throw problem('This photo is no longer available.',404);
    if(!result.trip.features.download&&!result.isAdmin)throw problem('Photo downloads are disabled for this trip.',403);
    return res.redirect(302,await downloadUrl(photo));
   }
   return res.status(200).json(withUrls(result));
  }
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'});}
  let b=req.body;if(typeof b==='string'){if(b.length>20000)throw problem('This request is too large.',413);try{b=JSON.parse(b);}catch{throw problem('Please try this request again.');}}
  if(!b||JSON.stringify(b).length>20000||!POST_ACTIONS.has(b.action))throw problem('Unsupported trip request.');
  const payload={...b,slug:q.trip};delete payload.action;
  if(b.action==='sign'){
   if(!UUID.test(b.id||'')||!/^image\//.test(b.contentType||'')||!/^[a-f0-9]{64}$/.test(b.hash||''))throw problem('Choose a valid photo.');
   const photo=await engineRpc('reserve',payload,bearer(req));if(photo.duplicate)return res.status(200).json(photo);
   return res.status(200).json({...photo,urls:await signPhoto(photo,b.ext)});
  }
  if(b.action==='finalize'){
   // Check all objects before completing the reservation. The database also
   // rechecks the trip phase, owner and pending state on finalize.
   const authorization=bearer(req),photo=await engineRpc('reserve',payload,authorization);
   if(photo.duplicate)return res.status(200).json(photo);
   for(const key of [photo.key,photo.webKey,photo.thumbKey]){const r=await aws().fetch(objectUrl(key),{method:'HEAD',signal:AbortSignal.timeout(10000)});if(!r.ok||Number(r.headers.get('content-length'))<1)throw problem('The photo upload is incomplete. Please try again.');}
   return res.status(200).json(await engineRpc('finalize',{slug:q.trip,id:b.id},authorization));
  }
  const auth=b.action==='conversation'?req.headers?.authorization:bearer(req);
  const result=await engineRpc(b.action,payload,auth);
  return res.status(200).json(b.action==='moderation'?withUrls(result):result);
 }catch(e){return res.status(e.status||503).json({error:e.status?e.message:'Trip sharing is temporarily unavailable. Please try again.'});}
}
