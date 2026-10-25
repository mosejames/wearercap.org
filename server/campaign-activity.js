import aiAction from './newsletter-ai.js';
import {editorialAction} from './newsletter-editorial.js';
import {intakeAction} from './newsletter-intake.js';
import {consoleAction} from './newsletter-console.js';
import {verifyNewsletterLink} from './newsletter-links.js';
import {randomUUID,createHash} from 'node:crypto';
import {objectRequest,encrypt,decrypt} from './london-stories/storage.js';
import {CAMPAIGN_LINKS} from '../public/campaign-links.js';
const PREFIX='_analytics/rcap-campaign/';
export const EVENTS=['newsletterView','creatorView','invitationView','photoSelected','frameChanged','creationStarted','creationFailed','created','shareCompleted','shareCancelled','linkCopied','cardSaved','ticketClick','creditCopied','newsletter_link',...Object.keys(CAMPAIGN_LINKS).map(k=>'newsletter_'+k)];
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const rates=new Map();
export function cleanEvent(body){
 if(!EVENTS.includes(body?.event)||!UUID.test(body?.id||''))throw Error('Invalid event');
 return {id:body.id,event:body.event,issue:/^[a-z0-9-]{1,72}$/.test(body.issue||'')?body.issue:'current',at:Date.now()};
}
export async function recordActivity(event,issue='current',id=randomUUID()){
 const value=cleanEvent({event,issue,id});
 const key=PREFIX+new Date(value.at).toISOString().slice(0,10)+'/'+value.id;
 const r=await objectRequest(key,{method:'PUT',headers:{'Content-Type':'application/octet-stream','If-None-Match':'*','Cache-Control':'no-store'},body:encrypt(value)});
 if(!r.ok&&r.status!==412&&r.status!==409)throw Error('Activity write failed');
}
export function summarizeEvents(rows){
 return {total:rows.length,counts:Object.fromEntries(EVENTS.map(event=>[event,rows.filter(r=>r.event===event).length]))};
}
const xmlDecode=s=>s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
export async function report({days=30}={}){
 const rows=[];let truncated=false;
 for(let day=0;day<days&&!truncated;day++){
  let token;
  do{
   const date=new Date(Date.now()-day*86400000).toISOString().slice(0,10);
   const query=new URLSearchParams({'list-type':'2',prefix:PREFIX+date+'/','max-keys':'250'});if(token)query.set('continuation-token',token);
   const result=await objectRequest('?'+query);if(!result.ok)throw Error('List failed');const xml=await result.text();
   const keys=[...xml.matchAll(/<Key>(.*?)<\/Key>/g)].map(m=>xmlDecode(m[1]));
   for(let n=0;n<keys.length&&rows.length<5000;n+=20){
    const batch=await Promise.all(keys.slice(n,n+20).map(async key=>{const r=await objectRequest(key);if(!r.ok)throw Error('Read failed');return decrypt(Buffer.from(await r.arrayBuffer()));}));rows.push(...batch);
   }
   token=xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/)?.[1];if(token)token=xmlDecode(token);
   truncated=rows.length>=5000;if(truncated)break;
  }while(token);
 }
 return {...summarizeEvents(rows),days,truncated,byDay:Array.from({length:days},(_,i)=>{const day=new Date(Date.now()-(days-i-1)*86400000).toISOString().slice(0,10);return {day,...summarizeEvents(rows.filter(r=>new Date(r.at).toISOString().slice(0,10)===day))};}),byIssue:[...new Set(rows.map(r=>r.issue))].map(issue=>({issue,...summarizeEvents(rows.filter(r=>r.issue===issue))}))};
}
async function authorized(req,body){
 const auth=req.headers?.authorization;if(!auth?.startsWith('Bearer ')||!UUID.test(body.issueId||''))return false;
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
 const r=await fetch(`${url}/rest/v1/rpc/rcap_newsletter`,{method:'POST',headers:{apikey:key,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({p_action:'upload_ok',p_payload:{id:body.issueId}}),signal:AbortSignal.timeout(5000)});
 return r.ok&&await r.json()===true;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex');
 const link=req.query?.link;
 if(req.method==='GET'){
  const signed=verifyNewsletterLink(req.query?.issue,req.query?.target,req.query?.sig);
  if(!signed&&!Object.hasOwn(CAMPAIGN_LINKS,link))return res.status(400).json({error:'Unknown link'});
  if(!/bot|crawler|spider|preview|slack|facebookexternalhit|proofpoint|safelinks/i.test(req.headers?.['user-agent']||'')){
   try{await recordActivity(signed?(Object.keys(CAMPAIGN_LINKS).find(k=>CAMPAIGN_LINKS[k]===req.query.target)?'newsletter_'+Object.keys(CAMPAIGN_LINKS).find(k=>CAMPAIGN_LINKS[k]===req.query.target):'newsletter_link'):'newsletter_'+link,req.query?.issue);}catch{/* A tracking outage must never break a newsletter link. */}
  }
  res.setHeader('Location',signed?req.query.target:CAMPAIGN_LINKS[link]);return res.status(302).end();
 }
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(req.headers?.origin&&!['https://wearercap.org','https://www.wearercap.org'].includes(req.headers.origin))return res.status(403).json({error:'Origin not allowed'});
 try{
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  if(JSON.stringify(body).length>(body.action==='uploadAttachment'?4250000:12000))return res.status(413).json({error:'Too large'});
  if(['submit','inbox','review','uploadSession','uploadAttachment','attachment'].includes(body.action))return res.status(200).json(await intakeAction(req,body));
  if(['ideaSuggestions','ideaChat'].includes(body.action))return res.status(200).json(await aiAction(req,body));
  if(['ideas','ideaAdd','ideaUpdate','ideaComment'].includes(body.action))return res.status(200).json(await editorialAction(req,body));
  if(['workspace','workflow','dashboard','plan','sent','trackingLinks'].includes(body.action)){return res.status(200).json(await consoleAction(req,body,report));}
  if(body.action==='report'){
   if(!await authorized(req,body))return res.status(403).json({error:'Sign in as a newsletter editor to see analytics.'});
   return res.status(200).json(await report());
  }
  let value;try{value=cleanEvent(body);}catch{return res.status(400).json({error:'Invalid event'});}
  if(value.event==='created'||value.event.startsWith('newsletter_'))return res.status(400).json({error:'Server event only'});
  // Warm-instance burst protection. No IP addresses or hashes enter stored analytics.
  const now=Date.now();for(const [k,v] of rates)if(now-v.at>60000)rates.delete(k);
  const ip=createHash('sha256').update(String(req.headers?.['x-real-ip']||'unknown')).digest('hex');
  const rate=rates.get(ip)||{at:now,n:0};rate.n++;rates.set(ip,rate);if(rate.n>120)return res.status(429).json({error:'Please try later'});
  if(!/bot|crawler|spider|preview/i.test(req.headers?.['user-agent']||''))await recordActivity(value.event,value.issue,value.id);
  return res.status(200).json({ok:true});
 }catch(error){return res.status(error.status||503).json({error:error.status?error.message:'Analytics and calendar are temporarily unavailable.'});}
}
