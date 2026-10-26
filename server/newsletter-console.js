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
 if(['plan','sent'].includes(body.action)&&(previous.isTemplate||previous.archivedAt)){const e=Error('Use a template to create a draft, or restore this newsletter first.');e.status=409;throw e;}
 if(body.action==='plan'){
  if(previous.sentAt){const e=Error('This send is already recorded.');e.status=409;throw e;}
  const date=body.plannedAt===null?null:new Date(body.plannedAt);
  if(date!==null&&(!Number.isFinite(date.getTime())||date.getUTCFullYear()<2020||date.getUTCFullYear()>2100)){const e=Error('Choose a valid planned send date.');e.status=400;throw e;}
  next.plannedAt=date?.toISOString()||null;
 }else if(body.action==='sent'){
  if(previous.sentAt)return previous;
  const date=new Date(body.sentAt||now);if(!Number.isFinite(date.getTime())||date>new Date(now)||date.getUTCFullYear()<2020){const e=Error('A recorded send must be in the past.');e.status=400;throw e;}
  next.sentAt=date.toISOString();next.sentBy=me.email;
 }else if(body.action==='lifecycle'){
  if(!['archive','restore','template','draft','unsent'].includes(body.operation)){const e=Error('Choose a valid newsletter action.');e.status=400;throw e;}
  if(body.operation==='archive'){
   if(previous.isTemplate){const e=Error('Change this template back to a draft before archiving it.');e.status=409;throw e;}
   next.archivedAt=now;
  }
  if(body.operation==='restore')next.archivedAt=null;
  if(body.operation==='template'){
   if(previous.sentAt){const e=Error('Copy a sent newsletter before saving it as a template.');e.status=409;throw e;}
   next.isTemplate=true;next.archivedAt=null;next.plannedAt=null;
  }
  if(body.operation==='draft')next.isTemplate=false;
  if(body.operation==='unsent'){next.sentAt=null;next.sentBy=null;}
 }else if(body.action==='workflow'){
  if(body.stage!==undefined){if(!['Draft','In review','Ready to send'].includes(body.stage)){const e=Error('Choose a valid review status.');e.status=400;throw e;}next.stage=body.stage;}
  if(body.lead!==undefined)next.lead=String(body.lead||'').slice(0,200);
  if(body.comment){const text=String(body.comment).trim().slice(0,2000);if(text)next.comments=[...(previous.comments||[]),{by:me.email,text,at:now}].slice(-100);}
 }else {const e=Error('Unknown calendar action');e.status=400;throw e;}
 next.updatedAt=now;next.updatedBy=me.email;
 next.history=[...(previous.history||[]),{action:body.action,operation:body.operation,at:now,by:me.email,value:body.action==='sent'?next.sentAt:next.plannedAt}].slice(-100);
 return next;
}
export async function consoleAction(req,body,activityReport){
 const me=await newsletterRpc(req,'me');
 if(body.action==='trackingLinks'){
  if(!UUID.test(body.issueId||'')){const e=Error('Choose an issue.');e.status=400;throw e;}
  const issue=await newsletterRpc(req,'load',{id:body.issueId});return {links:signedNewsletterLinks(issue.content,issue.id)};
 }
 const issues=await newsletterRpc(req,'list');
 if(['dashboard','workspace'].includes(body.action)){
  const plans=await Promise.all(issues.map(async issue=>({id:issue.id,...(await readPlan(issue.id)).value})));
  if(body.action==='workspace')return {issues,plans:plans.map(p=>{const{history,...shared}=p;return shared;}),editors:await newsletterRpc(req,'editors')};
  const activity=await activityReport({days:Math.min(90,Math.max(7,Number(body.days)||30))});
  const allowed=new Set(issues.filter(i=>i.created_by===me.email).flatMap(i=>[i.id,i.slug].filter(Boolean)));
  const owner=me.role==='owner';
  return {role:me.role,issues,plans:plans.map(p=>owner?p:{id:p.id,plannedAt:p.plannedAt,sentAt:p.sentAt,updatedAt:p.updatedAt}),activity:owner?activity:({...activity,counts:Object.fromEntries(Object.entries(activity.counts).filter(([k])=>k.startsWith('newsletter'))),byDay:activity.byDay.map(d=>({...d,counts:Object.fromEntries(Object.entries(d.counts).filter(([k])=>k.startsWith('newsletter')))})),byIssue:activity.byIssue.map(d=>({...d,counts:Object.fromEntries(Object.entries(d.counts).filter(([k])=>k.startsWith('newsletter')))}))})};
 }
 if(body.action==='issueState'){if(!issues.some(i=>i.id===body.issueId)){const e=Error('Issue not found');e.status=404;throw e;}const {history,...plan}=(await readPlan(body.issueId)).value;return {plan};}
 const issue=issues.find(i=>i.id===body.issueId);if(!issue){const e=Error('Issue not found');e.status=404;throw e;}
 if(body.action==='workflow'&&body.lead){const editors=await newsletterRpc(req,'editors');if(!editors.some(e=>e.email===body.lead)){const e=Error('Choose an invited editor.');e.status=400;throw e;}}
 if(body.action==='lifecycle'&&body.operation==='template'&&issue.status==='published'){const e=Error('Copy this published newsletter before saving it as a template.');e.status=409;throw e;}
 const current=await readPlan(issue.id),next=cleanPlan(body,current.value,me);
 if(next!==current.value){
  const r=await objectRequest(ROOT+issue.id,{method:'PUT',headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store',...(current.etag?{'If-Match':current.etag}:{'If-None-Match':'*'})},body:encrypt(next)});
  if(r.status===409||r.status===412){const e=Error('The calendar changed. Refresh and try again.');e.status=409;throw e;}if(!r.ok)throw Error('Could not save calendar');
 }
 const {history,...shared}=next;return {ok:true,plan:shared};
}
