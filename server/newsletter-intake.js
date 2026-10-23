import {randomUUID,createHash} from 'node:crypto';
import {objectRequest,encrypt,decrypt} from './london-stories/storage.js';
import {newsletterRpc} from './newsletter-console.js';
const ROOT='_newsletter/intake/';const rates=new Map();
export function cleanSubmission(body){
 const text=(key,max,required=false)=>{const value=String(body[key]||'').trim();if(value.length>max||(required&&!value))throw Object.assign(Error(`Please check ${key}.`),{status:400});return value;};
 const item={name:text('name',100,true),email:text('email',200,true),title:text('title',160,true),details:text('details',6000,true),links:text('links',2000),requestedDate:text('requestedDate',10),category:text('category',40)};
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email))throw Object.assign(Error('Enter your email address.'),{status:400});
 if(item.requestedDate&&!/^\d{4}-\d{2}-\d{2}$/.test(item.requestedDate))throw Object.assign(Error('Choose a requested date.'),{status:400});
 if(!['Announcement','Event','Photos or recap','Volunteer opportunity','Other'].includes(item.category))throw Object.assign(Error('Choose a category.'),{status:400});
 return item;
}
export async function intakeAction(req,body){
 if(body.action==='submit'){
  if(body.website)return {ok:true};
  const key=createHash('sha256').update(String(req.headers?.['x-real-ip']||'unknown')).digest('hex'),now=Date.now();
  for(const [k,v] of rates)if(now-v.at>3600000)rates.delete(k);
  const rate=rates.get(key)||{at:now,n:0};if(++rate.n>10)throw Object.assign(Error('Please try again later.'),{status:429});rates.set(key,rate);
  const item={...cleanSubmission(body),id:randomUUID(),createdAt:new Date().toISOString(),status:'New'};
  const r=await objectRequest(ROOT+item.id,{method:'PUT',headers:{'Content-Type':'application/octet-stream','If-None-Match':'*'},body:encrypt(item)});if(!r.ok)throw Error('Submission unavailable');return {ok:true};
 }
 await newsletterRpc(req,'me');
 if(body.action==='inbox'){
  const r=await objectRequest('?'+new URLSearchParams({'list-type':'2',prefix:ROOT,'max-keys':'500'}));if(!r.ok)throw Error('Inbox unavailable');const xml=await r.text();
  const keys=[...xml.matchAll(/<Key>(.*?)<\/Key>/g)].map(m=>m[1]);
  const items=[];for(let n=0;n<keys.length;n+=20)items.push(...await Promise.all(keys.slice(n,n+20).map(async k=>{const f=await objectRequest(k);if(!f.ok)throw Error('Inbox unavailable');return decrypt(Buffer.from(await f.arrayBuffer()));})));
  return {items:items.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),truncated:xml.includes('<IsTruncated>true</IsTruncated>')};
 }
 if(body.action==='review'){
  if(!/^[a-f0-9-]{36}$/.test(body.id||'')||!['New','Reviewing','Ready','Used','Archived'].includes(body.status))throw Object.assign(Error('Choose a valid submission status.'),{status:400});
  const r=await objectRequest(ROOT+body.id);if(!r.ok)throw Object.assign(Error('Submission not found.'),{status:404});const item=decrypt(Buffer.from(await r.arrayBuffer()));item.status=body.status;
  const saved=await objectRequest(ROOT+body.id,{method:'PUT',headers:{'Content-Type':'application/octet-stream','If-Match':r.headers.get('etag')},body:encrypt(item)});if(!saved.ok)throw Object.assign(Error('The submission changed. Refresh and try again.'),{status:409});return {ok:true};
 }
 throw Object.assign(Error('Unknown action.'),{status:400});
}
