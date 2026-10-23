import {objectRequest,encrypt,decrypt} from './london-stories/storage.js';
import {signedNewsletterLinks} from './newsletter-links.js';
const ROOT='_analytics/newsletter-console/';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export async function newsletterRpc(req,action,payload={}){
 const auth=req.headers?.authorization;if(!auth?.startsWith('Bearer ')){const e=Error('Sign in to the newsletter builder.');e.status=401;throw e;}
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,key=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
 const r=await fetch(`${url}/rest/v1/rpc/rcap_newsletter`,{method:'POST',headers:{apikey:key,Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({p_action:action,p_payload:payload}),signal:AbortSignal.timeout(5000)});
 if(!r.ok){const e=Error('This console is for invited newsletter editors.');e.status=403;throw e;}return r.json();
}
async function readPlan(id){const r=await objectRequest(ROOT+id);if(r.status===404)return {value:{},etag:null};if(!r.ok)throw Error('Could not load calendar');return {value:decrypt(Buffer.from(await r.arrayBuffer())),etag:r.headers.get('etag')};}
export function cleanPlan(body,previous,me,now=new Date().toISOString()){
 const next={...previous};
 if(body.action==='plan'){
  if(previous.sentAt){const e=Error('This send is already recorded.');e.status=409;throw e;}
  const date=body.plannedAt===null?null:new Date(body.plannedAt);
  if(date!==null&&(!Number.isFinite(date.getTime())||date.getUTCFullYear()<2020||date.getUTCFullYear()>2100)){const e=Error('Choose a valid planned send date.');e.status=400;throw e;}
  next.plannedAt=date?.toISOString()||null;
 }else if(body.action==='sent'){
  if(previous.sentAt)return previous;
  const date=new Date(body.sentAt||now);if(!Number.isFinite(date.getTime())||date>new Date(now)||date.getUTCFullYear()<2020){const e=Error('A recorded send must be in the past.');e.status=400;throw e;}
  next.sentAt=date.toISOString();next.sentBy=me.email;
 }else {const e=Error('Unknown calendar action');e.status=400;throw e;}
 next.updatedAt=now;next.updatedBy=me.email;
 next.history=[...(previous.history||[]),{action:body.action,at:now,by:me.email,value:body.action==='sent'?next.sentAt:next.plannedAt}].slice(-100);
 return next;
}
export async function consoleAction(req,body,activityReport){
 const me=await newsletterRpc(req,'me');
 if(body.action==='trackingLinks'){
  if(!UUID.test(body.issueId||'')){const e=Error('Choose an issue.');e.status=400;throw e;}
  const issue=await newsletterRpc(req,'load',{id:body.issueId});return {links:signedNewsletterLinks(issue.content,issue.id)};
 }
 const issues=await newsletterRpc(req,'list');
 if(body.action==='dashboard'){
  const plans=await Promise.all(issues.map(async issue=>({id:issue.id,...(await readPlan(issue.id)).value})));
  const activity=await activityReport({days:Math.min(90,Math.max(7,Number(body.days)||30))});
  const allowed=new Set(issues.filter(i=>i.created_by===me.email).flatMap(i=>[i.id,i.slug].filter(Boolean)));
  const owner=me.role==='owner';
  return {role:me.role,issues,plans:plans.map(p=>owner?p:{id:p.id,plannedAt:p.plannedAt,sentAt:p.sentAt,updatedAt:p.updatedAt}),activity:owner?activity:({...activity,counts:Object.fromEntries(Object.entries(activity.counts).filter(([k])=>k.startsWith('newsletter'))),byDay:activity.byDay.map(d=>({...d,counts:Object.fromEntries(Object.entries(d.counts).filter(([k])=>k.startsWith('newsletter')))})),byIssue:activity.byIssue.map(d=>({...d,counts:Object.fromEntries(Object.entries(d.counts).filter(([k])=>k.startsWith('newsletter')))}))})};
 }
 const issue=issues.find(i=>i.id===body.issueId);if(!issue){const e=Error('Issue not found');e.status=404;throw e;}
 const current=await readPlan(issue.id),next=cleanPlan(body,current.value,me);
 if(next!==current.value){
  const r=await objectRequest(ROOT+issue.id,{method:'PUT',headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store',...(current.etag?{'If-Match':current.etag}:{'If-None-Match':'*'})},body:encrypt(next)});
  if(r.status===409||r.status===412){const e=Error('The calendar changed. Refresh and try again.');e.status=409;throw e;}if(!r.ok)throw Error('Could not save calendar');
 }
 return {ok:true,plan:me.role==='owner'?next:{plannedAt:next.plannedAt,sentAt:next.sentAt,updatedAt:next.updatedAt}};
}
