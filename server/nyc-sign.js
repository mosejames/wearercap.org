import {AwsClient} from 'aws4fetch';
import {r2Config} from './london-sign.js';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const TYPES={jpg:'image/jpeg',png:'image/png',webp:'image/webp',heic:'image/heic',heif:'image/heif'};
export function nycKeys(user,album,id,ext){
 if(!UUID.test(user)||!UUID.test(id)||!['send-off','the-whole-adventure'].includes(album)||!Object.hasOwn(TYPES,ext))throw Error('Invalid NYC photo');
 const base=`nyc-2026/${user.replaceAll('-','').slice(0,8)}/${album}/${id}`;
 return {orig:`${base}/orig.${ext}`,web:`${base}/web.jpg`,thumb:`${base}/thumb.jpg`};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 const r2=r2Config();if(!Object.values(r2).every(Boolean))return res.status(503).json({error:'Photo sharing is not ready yet. Please keep your originals.'});
 if(req.method==='GET')return res.status(200).json({publicBase:r2.publicBase});
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 const authorization=req.headers?.authorization;
 if(!authorization?.startsWith('Bearer '))return res.status(401).json({error:'Please sign in to share.'});
 const base=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
 const headers={apikey:key,Authorization:authorization,'Content-Type':'application/json'};
 let body=req.body;try{if(typeof body==='string')body=JSON.parse(body);}catch{return res.status(400).json({error:'Choose your photo again.'});}
 if(!body||!UUID.test(body.id||'')||!Object.hasOwn(TYPES,body.ext)||TYPES[body.ext]!==body.contentType||!['send-off','the-whole-adventure'].includes(body.album)||!Number.isInteger(body.bytes)||body.bytes<1||body.bytes>50*1024*1024||!/^[a-f0-9]{64}$/.test(body.hash||''))return res.status(400).json({error:'Please choose a photo under 50 MB.'});
 try{
  const auth=await fetch(`${base}/auth/v1/user`,{headers,signal:AbortSignal.timeout(5000)});
  if(!auth.ok)return res.status(401).json({error:'Please sign in again.'});
  const user=await auth.json();if(!UUID.test(user.id)||!(user.phone_confirmed_at||user.email_confirmed_at))return res.status(403).json({error:'Please verify your sharing account.'});
  const allowed=await fetch(`${base}/rest/v1/rpc/trip_upload_allowed`,{method:'POST',headers,body:JSON.stringify({p_vault:'nyc-2026',p_album:body.album,p_hash:body.hash}),signal:AbortSignal.timeout(5000)});
  if(!allowed.ok)return res.status(503).json({error:'Photo sharing is not ready yet. Please keep your originals.'});
  const result=await allowed.json();if(!result.allowed)return res.status(429).json({error:result.error||'Please try again in a minute.'});
  if(result.duplicate)return res.status(200).json({duplicate:true});
  const keys=nycKeys(user.id,body.album,body.id,body.ext),urls={};
  const aws=new AwsClient({accessKeyId:r2.key,secretAccessKey:r2.secret,service:'s3',region:'auto'});
  for(const [part,path] of Object.entries(keys)){
   const url=new URL(`https://${r2.account}.r2.cloudflarestorage.com/${r2.bucket}/${path}`);url.searchParams.set('X-Amz-Expires','900');
   const signed=await aws.sign(new Request(url,{method:'PUT',headers:{'Content-Type':part==='orig'?TYPES[body.ext]:'image/jpeg'}}),{aws:{signQuery:true}});urls[part]=signed.url;
  }
  return res.status(200).json({keys,urls,publicBase:r2.publicBase});
 }catch{return res.status(503).json({error:'Could not prepare sharing. Please try again.'});}
}
