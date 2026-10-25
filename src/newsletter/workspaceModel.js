import {template,newBlock} from './render';
export const WORKSPACE_VIEWS=['home','newsletters','calendar','ideas','submissions','performance','settings'];
export const easternDay=(value=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export function nextWednesday(day=easternDay()){
 const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+((3-date.getUTCDay()+7)%7));return date.toISOString().slice(0,10);
}
export function monthCells(month){
 if(!/^\d{4}-\d{2}$/.test(month))return [];
 const [y,m]=month.split('-').map(Number);if(m<1||m>12)return [];
 const first=new Date(Date.UTC(y,m-1,1)),count=new Date(Date.UTC(y,m,0)).getUTCDate();
 return [...Array(first.getUTCDay()).fill(null),...Array.from({length:count},(_,i)=>({day:month+'-'+String(i+1).padStart(2,'0'),number:i+1,wednesday:new Date(Date.UTC(y,m-1,i+1)).getUTCDay()===3}))];
}
export const STARTERS=[{id:'weekly',label:'Weekly Update',description:'The main story, clear actions, and dates families need.',blocks:['story','dates']},{id:'event',label:'Event Reminder',description:'One event, the essentials, and a clear way to participate.',blocks:['story','dates']},{id:'recap',label:'Community Recap',description:'Photos, scholar experiences, celebrations, and what’s next.',blocks:['photo','story','quote','dates']}];
export function starterContent(kind,day,me={}){
 const starter=STARTERS.find(s=>s.id===kind)||STARTERS[0];return {...template('full',day),signer:me.name||'Your RCAP team',role:'RCAP',greeting:'RCAP family,',kicker:starter.label,blocks:starter.blocks.map(newBlock)};
}
export function issueStage(issue,plan={}){return plan.sentAt?'Sent':plan.stage||'Draft';}
export function calendarEntries(issues,plans,day){return plans.filter(p=>(p.sentAt||p.plannedAt)&&easternDay(p.sentAt||p.plannedAt)===day).map(p=>({plan:p,issue:issues.find(i=>i.id===p.id)})).filter(e=>e.issue);}
