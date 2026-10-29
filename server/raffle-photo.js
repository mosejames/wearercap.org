import {recordActivity} from './campaign-activity.js';
import { studentDetails } from '../public/raffle-share/student.js';
// Raffle invitations are link-only records, not a public gallery. Only the
// cropped web photo and composed card are saved; source files are discarded.
import { AwsClient } from 'aws4fetch';
import { randomUUID, randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import sharp from 'sharp';
import { shareNames, rafflePhotoImage } from './raffle-share.js';
import { readFileSync } from 'node:fs';
import { frameLayout } from '../public/raffle-share/layout.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROOT = 'raffle/2026/invitations';
const MAX_BASE64 = 1900000;
const hash = value => createHash('sha256').update(value).digest('hex');
const attempts = new Map();
const fonts = [
 {name:'Figtree',data:readFileSync(new URL('../api/fonts/Figtree-Medium.ttf',import.meta.url)),weight:500},
 {name:'Figtree',data:readFileSync(new URL('../api/fonts/Figtree-Black.ttf',import.meta.url)),weight:900},
];
function config() {
 const values = ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET','R2_PUBLIC_BASE'].map(key=>process.env[key]);
 if(values.some(v=>!v)) throw new Error('Photo storage is unavailable. Please try again shortly.');
 const [account,key,secret,bucket,base]=values;
 return {account,key,secret,bucket,base:base.replace(/\/+$/,'')};
}
async function object(key, method='GET', data, type) {
 const r2=config(); const aws=new AwsClient({accessKeyId:r2.key,secretAccessKey:r2.secret,service:'s3',region:'auto'});
 return aws.fetch(`https://${r2.account}.r2.cloudflarestorage.com/${r2.bucket}/${key}`,{method,headers:type?{'Content-Type':type,'Cache-Control':'no-store'}:undefined,body:data,signal:AbortSignal.timeout(12000)});
}
export async function getRafflePhoto(id) {
 if(!UUID.test(id||'')) return null;
 const response=await object(`${ROOT}/${id}/record.json`);
 if(response.status===404) return null;
 if(!response.ok) throw new Error('Could not load this invitation. Please try again.');
 const record=await response.json();
 if(record.id!==id || record.storage!=='r2' || record.status!=='visible') return null;
 const {scholar,family}=shareNames(record);
 // Refresh earlier cards without changing their share link or publishing a
 // hidden manifest again. A new filename also bypasses cached old artwork.
 if(record.cardVersion!==9){
  const current=await object(`${ROOT}/${id}/card-v9.jpg`,'HEAD');
  if(!current.ok){
   const source=await object(`${ROOT}/${id}/web.jpg`);
   if(!source.ok)return null;
   const bytes=Buffer.from(await source.arrayBuffer());
   const rendered=Buffer.from(await rafflePhotoImage(fonts,{scholar,family,frame:record.frame,photo:`data:image/jpeg;base64,${bytes.toString('base64')}`}).arrayBuffer());
   const card=await sharp(rendered).jpeg({quality:90}).toBuffer();
   const saved=await object(`${ROOT}/${id}/card-v9.jpg`,'PUT',card,'image/jpeg');
   if(!saved.ok)throw new Error('Could not refresh this invitation.');
  }
 }

 return {id,scholar,family,...studentDetails(record),frame:record.frame==='gold'?'gold':'navy',storage:'r2',photoUrl:`${config().base}/${ROOT}/${id}/web.jpg`,imageUrl:`${config().base}/${ROOT}/${id}/card-v9.jpg`,ownerHash:record.ownerHash};
}
export function acceptsPhotoRequest(body) {
 const names=shareNames(body);
 const details=studentDetails(body);
 return Boolean(names.scholar && details.classYear && details.house && typeof body?.image==='string' && body.image.length<MAX_BASE64 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(body.image));
}
export async function createRafflePhoto(body) {
 if(!acceptsPhotoRequest(body)) {const e=new Error('Add the student’s name, class and house, then choose a photo again.');e.status=400;throw e;}
 const bytes=Buffer.from(body.image.split(',')[1],'base64');
 let web;
 try {
  const input=sharp(bytes,{limitInputPixels:16000000,failOn:'error'});
  const meta=await input.metadata();
  if(meta.format!=='jpeg') throw new Error('Not a JPEG');
  const area=frameLayout(body.frame).photo;
  web=await input.rotate().resize(area.w*2,area.h*2,{fit:'cover'}).jpeg({quality:88}).toBuffer();
 } catch {const e=new Error('We could not read that photo. Please choose another image.');e.status=400;throw e;}
 const id=randomUUID(); const token=randomBytes(32).toString('hex');
 const names=shareNames(body);const frame=body.frame==='gold'?'gold':'navy';
 const image=Buffer.from(await rafflePhotoImage(fonts,{...names,frame,photo:`data:image/jpeg;base64,${web.toString('base64')}`}).arrayBuffer());
 const card=await sharp(image).jpeg({quality:90}).toBuffer();
 const record={id,...names,...studentDetails(body),frame,storage:'r2',status:'visible',cardVersion:9,ownerHash:hash(token),createdAt:new Date().toISOString()};
 // Publish the manifest last. Partial uploads never produce a visible invitation.
 for(const [filename,data,type] of [['web.jpg',web,'image/jpeg'],['card-v9.jpg',card,'image/jpeg'],['record.json',JSON.stringify(record),'application/json']]) {
  const r=await object(`${ROOT}/${id}/${filename}`,'PUT',data,type);
  if(!r.ok) throw new Error('Could not save your invitation. Please try again.');
 }
 return {id,token,url:`https://wearercap.org/events/2026/fall-raffle/share/?id=${id}`};
}
export default async function rafflePhotoHandler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(!['POST','DELETE'].includes(req.method)) {res.setHeader('Allow','POST, DELETE');return res.status(405).json({error:'Method not allowed'});}
 if(req.headers?.origin && req.headers.origin!=='https://wearercap.org' && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(req.headers.origin)) return res.status(403).json({error:'Please create your invitation on We Are RCAP.'});
 let body=req.body;if(typeof body==='string'){try{body=JSON.parse(body);}catch{body=null;}}
 try {
  if(req.method==='DELETE') {
   const record=await getRafflePhoto(body?.id);
   const token=typeof body?.token==='string'?body.token:'';
   if(!record || !/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9]{64}$/.test(record.ownerHash||'') || !timingSafeEqual(Buffer.from(hash(token),'hex'),Buffer.from(record.ownerHash,'hex'))) return res.status(403).json({error:'Only the creator can hide this invitation from this browser.'});
   const r=await object(`${ROOT}/${body.id}/record.json`,'PUT',JSON.stringify({id:body.id,storage:'r2',status:'hidden'}),'application/json');
   if(!r.ok) throw new Error('Could not hide the invitation. Please try again.');
   return res.status(200).json({hidden:true});
  }
  if(Date.now()>Date.parse('2026-11-17T00:00:00-05:00')) return res.status(410).json({error:'The 2026 fall raffle has ended. Thank you for supporting RCAP.'});
  // Best-effort burst protection in each warm instance; image byte/pixel limits
  // and a fixed campaign end also bound the anonymous upload surface.
  const ip=hash(String(req.headers?.['x-real-ip']||'unknown'));const now=Date.now();
  for(const [key,value] of attempts) if(now-value.start>3600000) attempts.delete(key);
  const rate=attempts.get(ip)||{start:now,count:0};rate.count++;attempts.set(ip,rate);
  if(rate.count>100) return res.status(429).json({error:'You’ve made several invitations. Please try again in an hour.'});
  const result=await createRafflePhoto(body);
  try{await recordActivity('created');}catch{/* Analytics must not block a saved invitation. */}
  return res.status(201).json(result);
 } catch(error) {return res.status(error.status||503).json({error:error.status?error.message:'Could not save or load your invitation. Please try again shortly.'});}
}
