import {AwsClient} from 'aws4fetch';
import {r2Config} from './london-sign.js';
export function createDownloadHandler({lookup,read}){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const id=req.query?.download;if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))return res.status(400).json({error:'Choose a photo from the album.'});
 try{const photo=await lookup(id);if(!photo)return res.status(404).json({error:'This photo is no longer available.'});
 if(photo.id!==id||photo.vault!=='nyc-2026'||!new RegExp('^nyc-2026/[a-f0-9]{8}/(send-off|the-whole-adventure)/'+id+'/web\\.jpg$','i').test(photo.webKey))return res.status(404).json({error:'This photo is no longer available.'});
 const image=await read(photo.webKey);if(!image.ok)throw Error('Storage unavailable');
 if(!image.headers.get('content-type')?.startsWith('image/jpeg'))throw Error('Invalid image');
 const bytes=Buffer.from(await image.arrayBuffer());if(!bytes.length||bytes.length>4*1024*1024)throw Error('Invalid image size');
 res.setHeader('Content-Type','image/jpeg');res.setHeader('Content-Disposition',`attachment; filename="RCA-NYC-${id}.jpg"`);return res.status(200).send(bytes);
 }catch{return res.status(503).json({error:'Could not download this photo. Please try again shortly.'});}
};}
export default async function handler(req,res){const base=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY,r2=r2Config();return createDownloadHandler({
 lookup:async id=>{if(!base||!key)throw Error('Not configured');const r=await fetch(`${base}/rest/v1/rpc/trip_gallery`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({p_vault:'nyc-2026',p_id:id}),signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Gallery unavailable');return (await r.json()).find(p=>p.id===id);},
 read:async path=>{if(!r2.account||!r2.key||!r2.secret||!r2.bucket)throw Error('Not configured');const aws=new AwsClient({accessKeyId:r2.key,secretAccessKey:r2.secret,service:'s3',region:'auto'});return aws.fetch(`https://${r2.account}.r2.cloudflarestorage.com/${r2.bucket}/${path}`,{signal:AbortSignal.timeout(12000)});}
})(req,res);}
