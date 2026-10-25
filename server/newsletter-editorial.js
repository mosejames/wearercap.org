import {randomUUID} from 'node:crypto';
import {objectRequest,encrypt,decrypt} from './london-stories/storage.js';
import {newsletterRpc} from './newsletter-console.js';
const KEY='_newsletter/editorial-board';
const fail=(message,status=400)=>Object.assign(Error(message),{status});
export const IDEA_STAGES=['Suggested','Planned','In progress','Ready','Used'];
export const SEED_IDEAS=[
 ['travel-first','Your scholar’s first international trip','10 things families should know before a first international trip. Confirm guidance with the trip organizers.','Before international travel'],
 ['travel-away','While they’re away','Communication, time differences, staying connected, and helpful ways to support a scholar from home.','Before departure'],
 ['travel-home','Home again: stories from our scholars','Invite families to contribute photos and scholars to share a favorite memory or something they learned.','After travel'],
 ['basketball-start','Basketball season: getting started','Gather confirmed schedules, attendance details, family expectations, and ways to support the team.','Before basketball season'],
 ['basketball-night','New to game night?','A welcoming guide for first-time families, with confirmed arrival, parking, and participation details.','Before the first home game']
].map(([id,title,pitch,timing])=>({id,title,pitch,timing,status:'Suggested',by:'RCAP planning ideas',comments:[],needsDetails:true}));
export function editBoard(previous,body,me,now=new Date().toISOString()){
 const next=structuredClone(previous);const text=(value,max)=>String(value||'').trim().slice(0,max);
 if(body.action==='ideaAdd'){
  const title=text(body.title,160),pitch=text(body.pitch,3000);if(!title||!pitch)throw fail('Add a title and a short pitch.');
  next.ideas.unshift({id:randomUUID(),title,pitch,timing:text(body.timing,120),status:'Suggested',by:me.email,createdAt:now,comments:[],needsDetails:true});
 }else{
  const idea=next.ideas.find(i=>i.id===body.id);if(!idea)throw fail('Idea not found.',404);
  if(body.action==='ideaUpdate'){
   if(body.status!==undefined){if(!IDEA_STAGES.includes(body.status))throw fail('Choose a valid idea status.');idea.status=body.status;}
   if(body.assignee!==undefined)idea.assignee=text(body.assignee,200);
   if(body.timing!==undefined)idea.timing=text(body.timing,120);
   if(body.dismissed!==undefined)idea.dismissed=body.dismissed===true;
   if(body.needsDetails!==undefined)idea.needsDetails=body.needsDetails===true;
   if(body.issueId!==undefined){if(body.issueId!==null&&!/^[a-f0-9-]{36}$/.test(body.issueId))throw fail('Choose an issue.');idea.issueId=body.issueId;idea.status=body.issueId?'Planned':idea.status;}
  }else if(body.action==='ideaComment'){
   const comment=text(body.comment,2000);if(!comment)throw fail('Write a comment first.');idea.comments=[...(idea.comments||[]),{id:randomUUID(),text:comment,by:me.email,at:now}].slice(-100);
  }else throw fail('Unknown editorial action.');
  idea.updatedAt=now;idea.updatedBy=me.email;
 }
 if(next.ideas.length>500)throw fail('The ideas board is full.');
 next.revision=(previous.revision||0)+1;return next;
}
export async function editorialAction(req,body){
 const me=await newsletterRpc(req,'me');
 const r=await objectRequest(KEY);if(!r.ok&&r.status!==404)throw Error('Ideas unavailable');
 const previous=r.ok?decrypt(Buffer.from(await r.arrayBuffer())):{revision:0,ideas:SEED_IDEAS};
 if(body.action==='ideas')return previous;
 if(body.expectedRevision!==previous.revision)throw fail('The ideas board changed. Refresh and try again.',409);
 if(body.issueId){const issues=await newsletterRpc(req,'list');if(!issues.some(i=>i.id===body.issueId))throw fail('Issue not found.',404);}
 if(body.assignee){const editors=await newsletterRpc(req,'editors');if(!editors.some(e=>e.email===body.assignee))throw fail('Choose an invited editor.');}
 const next=editBoard(previous,body,me);
 const saved=await objectRequest(KEY,{method:'PUT',headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store',...(r.ok?{'If-Match':r.headers.get('etag')}:{'If-None-Match':'*'})},body:encrypt(next)});
 if(saved.status===412||saved.status===409)throw fail('The ideas board changed. Refresh and try again.',409);if(!saved.ok)throw Error('Ideas could not be saved');return next;
}
