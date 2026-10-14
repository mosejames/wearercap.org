import crypto from 'node:crypto';
import {objectRequest,encrypt,decrypt} from '../london-stories/storage.js';
const PREFIX='_analytics/london/';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const PAGES=['gallery','airport'];
const EVENTS=['photoViews','videoPlays','shares','reactions','comments','uploads'];
export function cleanSession(body,now=Date.now()) {
  if(!UUID.test(body.session||'') || !UUID.test(body.visitor||'') || !PAGES.includes(body.page)) throw Error('Invalid session');
  const started=Number(body.started);
  if(!Number.isFinite(started)||started>now+5000||started<now-86400000) throw Error('Invalid time');
  const seconds=Math.min(Math.max(0,Math.floor((now-started)/1000)),Math.max(0,Math.floor(Number(body.seconds)||0)));
  const counts=Object.fromEntries(EVENTS.map(k=>[k,Math.min(10000,Math.max(0,Math.floor(Number(body.counts?.[k])||0)))]));
  return {session:body.session,visitor:crypto.createHmac('sha256',process.env.LONDON_IMPORT_STATE_KEY).update(body.visitor).digest('hex'),page:body.page,started,lastSeen:now,seconds,counts};
}
export function summarize(rows,now=Date.now()) {
  const visitors=new Set(rows.map(r=>r.visitor));
  const active=new Set(rows.filter(r=>now-r.lastSeen<90000 && r.active).map(r=>r.visitor));
  const counts=Object.fromEntries(EVENTS.map(k=>[k,rows.reduce((n,r)=>n+(r.counts[k]||0),0)]));
  return {visits:rows.length,visitors:visitors.size,activeNow:active.size,averageSeconds:rows.length?Math.round(rows.reduce((n,r)=>n+r.seconds,0)/rows.length):0,counts};
}
async function read(key){const r=await objectRequest(key);if(r.status===404)return null;if(!r.ok)throw Error('Read failed');return {value:decrypt(Buffer.from(await r.arrayBuffer())),etag:r.headers.get('etag')};}
function unescapeXml(s){return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");}
async function report(days){
 const rows=[];let truncated=false;
 for(let i=0;i<days;i++){
  const day=new Date(Date.now()-i*86400000).toISOString().slice(0,10);let token;
  do{
   const q=new URLSearchParams({'list-type':'2',prefix:PREFIX+day+'/'});if(token)q.set('continuation-token',token);
   const r=await objectRequest('?'+q);if(!r.ok)throw Error('List failed');const xml=await r.text();
   const keys=[...xml.matchAll(/<Key>(.*?)<\/Key>/g)].map(m=>unescapeXml(m[1]));
   for(let n=0;n<keys.length;n+=20){const batch=await Promise.all(keys.slice(n,n+20).map(read));rows.push(...batch.filter(Boolean).map(x=>x.value));}
   token=xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/)?.[1];if(token)token=unescapeXml(token);
   if(rows.length>=5000){truncated=true;break;}
  }while(token);
  if(truncated)break;
 }
 return {...summarize(rows),days,truncated,byDay:[...new Set(rows.map(r=>new Date(r.started).toISOString().slice(0,10)))].sort().reverse().map(day=>({day,...summarize(rows.filter(r=>new Date(r.started).toISOString().slice(0,10)===day))}))};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 if(req.headers.origin && !['https://wearercap.org','https://www.wearercap.org'].includes(req.headers.origin))return res.status(403).json({error:'Origin not allowed'});
 try{
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  if(JSON.stringify(body).length>4096)return res.status(413).json({error:'Too large'});
  if(body.action==='report'){
   const pass=req.headers['x-vault-admin'];if(typeof pass!=='string'||pass.length>200)return res.status(403).json({error:'Sign in as an admin first.'});
   const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
   const r=await fetch(`${url}/rest/v1/rpc/m3_pass_ok`,{method:'POST',headers:{apikey:anon,Authorization:`Bearer ${anon}`,'Content-Type':'application/json'},body:JSON.stringify({p_vault:'london-2028',p_pass:pass}),signal:AbortSignal.timeout(5000)});
   if(!r.ok||await r.json()!==true)return res.status(403).json({error:'Sign in as an admin first.'});
   return res.status(200).json(await report(Math.min(14,Math.max(1,Math.floor(Number(body.days))||7))));
  }
  let value;try{value=cleanSession(body);}catch{return res.status(400).json({error:'Invalid session'});}
  value.active=body.active===true;
  const key=PREFIX+new Date(value.started).toISOString().slice(0,10)+'/'+value.session;
  const previous=await read(key);
  if(previous){value.seconds=Math.max(value.seconds,previous.value.seconds);value.started=previous.value.started;value.visitor=previous.value.visitor;value.counts=Object.fromEntries(EVENTS.map(k=>[k,Math.max(value.counts[k],previous.value.counts[k])]));}
  const r=await objectRequest(key,{method:'PUT',headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store',...(previous?{'If-Match':previous.etag}:{'If-None-Match':'*'})},body:encrypt(value)});
  if(r.status===412||r.status===409)return res.status(202).json({ok:true});
  if(!r.ok)throw Error('Write failed');return res.status(200).json({ok:true});
 }catch{return res.status(503).json({error:'Activity is temporarily unavailable.'});}
}
