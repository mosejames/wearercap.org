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
const sampleUrl=type=>`https://example.com/replace-this-${type}-link`;
const templateImage=name=>({url:`https://wearercap.org/newsletter/templates/${name}.png`,alt:name==='replace-image'?'Template image placeholder. Change this image or upload your own.':'Template photo placeholders. Replace with your own community photos.'});
const story=(heading,body,extra={})=>({...newBlock('story'),heading,body,...extra});
const dates=(heading,items)=>({...newBlock('dates'),heading,items:items.map(([when,what,detail])=>({id:newBlock('note').id,when,what,detail,url:''}))});
export function starterContent(kind,day,me={}){
 const starter=STARTERS.find(s=>s.id===kind)||STARTERS[0];
 const base={...template('full',day),starterVersion:2,starterKind:starter.id,signer:me.name||'Your RCAP team',role:'RCAP',greeting:'RCAP family,',kicker:starter.label,preheader:'[Add a short preview of what families need to know]',signoff:'See you soon,'};
 if(starter.id==='event'){
  const eventDay=new Date(day+'T12:00:00Z');eventDay.setUTCDate(eventDay.getUTCDate()+7);
  return {...base,subject:'[Add your event name] is coming up',headline:'Let’s make it a great day.',body:'You can add your text about your event right here. Tell families what is happening, why they will love it, and how they can take part.',blocks:[
   story('[Add your event name]','Add the date, time, and location here. Include who can attend and anything families should bring or do before the event.',{image:templateImage('replace-image'),actionStyle:'solid',centerActions:true,countdown:{label:'COUNTDOWN TO YOUR EVENT · SAMPLE DATE',deadline:eventDay.toISOString().slice(0,10)+'T18:00',finished:'[Add your message for when the countdown ends]'},button:{label:'Volunteer for this event',url:sampleUrl('volunteer')},link:{label:'Get all the event details',url:sampleUrl('event-details')}}),
   dates('The details at a glance.',[['[Add date]','[Add event time and location]','Add a quick arrival, parking, or participation note.'],['[Add deadline]','[Add RSVP or volunteer deadline]','Tell families what to do and when.']]),
   story('A little look back.','Add a few photos from last year so families can picture the fun. Replace this sample image with your own photo or collage, or add individual Photo sections.',{tone:'sand',image:templateImage('past-photos')})]};
 }
 if(starter.id==='recap')return {...base,subject:'[Add your community moment] in pictures',headline:'Good moments. Shared memories.',body:'Add a short introduction to what happened, who was part of it, and what made it special for our community.',blocks:[
  story('[Add the celebration or event name]','Tell the story here. Share one or two highlights and a specific moment that families will enjoy remembering.',{image:templateImage('replace-image')}),
  story('The moments we’ll remember.','Replace this sample with your own photo or collage. You can also add individual Photo sections to share more moments.',{image:templateImage('recap-photos'),button:{label:'See all the photos',url:sampleUrl('photo-album')}}),
  {...newBlock('quote'),quote:'[Add a real quote from a scholar, family member, or volunteer]',by:'[Add the name and credit with permission]'},
  story('Thank you for being part of it.','Add a specific thank-you here. Recognize the people who helped and invite families to share their own memories.',{tone:'sand',button:{label:'Share your photos or story',url:sampleUrl('photo-submission')}}),
  dates('What’s next?',[['[Add date]','[Add the next community gathering]','Share one useful detail and a link if needed.']]) ]};
 return {...base,subject:'[Add this week’s main update] | RCAP',headline:'A few good things to know.',body:'Add your short welcome here. Give families a quick sense of what matters this week and the most useful thing to know or do.',blocks:[
  story('[Add your main update]','You can add your text about your update right here. Keep it useful and welcoming. Include the key details, then point families to the full information.',{image:templateImage('replace-image'),button:{label:'Read the full update',url:sampleUrl('update')}}),
  {...newBlock('cards'),heading:'Find what you need.',columns:2,items:[{id:newBlock('note').id,icon:'team',eyebrow:'Get involved',title:'[Add a volunteer opportunity]',description:'Explain how families can help and what the time commitment looks like.',action:'Find your place',url:sampleUrl('volunteer')},{id:newBlock('note').id,icon:'',eyebrow:'Good to know',title:'[Add a helpful resource]',description:'Share a practical resource or a useful reminder for families.',action:'Get the details',url:sampleUrl('resource')}]},
  dates('Coming up.',[['[Add date]','[Add an upcoming event]','Include a time, location, or action families should take.'],['[Add date]','[Add an important deadline]','Tell families what they need to do.']]) ]};
}
// Upgrade only untouched, empty starters. Never replace an editor’s words or media.
export function upgradeBlankStarter(content,day){
 if(!content||content.starterVersion||content.subject||content.headline||content.body||content.preheader||content.button?.label||content.button?.url)return content;
 const starter=STARTERS.find(s=>s.label===content.kicker);if(!starter)return content;
 const shape=value=>Array.isArray(value)?value.map(shape):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).filter(k=>k!=='id').sort().map(k=>[k,shape(value[k])])):value;
 const empty=content.blocks?.length===starter.blocks.length&&content.blocks.every((b,index)=>b.type===starter.blocks[index]&&JSON.stringify(shape(b))===JSON.stringify(shape(newBlock(b.type))));
 if(!empty)return content;
 const example=starterContent(starter.id,day,{name:content.signer});
 return {...content,starterVersion:2,starterKind:starter.id,subject:example.subject,preheader:example.preheader,headline:example.headline,body:example.body,blocks:example.blocks};
}
export function issueStage(issue,plan={}){return plan.archivedAt?'Archived':plan.isTemplate?'Template':plan.sentAt?'Sent':plan.stage||'Draft';}
export function calendarEntries(issues,plans,day){return plans.filter(p=>(p.sentAt||p.plannedAt)&&easternDay(p.sentAt||p.plannedAt)===day).map(p=>({plan:p,issue:issues.find(i=>i.id===p.id)})).filter(e=>e.issue);}

export function blankContent(day,me={}){return {...template('full',day),signer:me.name||'Your RCAP team',role:'RCAP',greeting:'RCAP family,',kicker:'',subject:'',headline:'',body:'',preheader:'',blocks:[]};}
export function issueCollection(plan={}){return plan.archivedAt?'archive':plan.isTemplate?'templates':'active';}
