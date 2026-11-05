// The public content contract used by the build and both browser views.
const safeUrl = value => typeof value==='string' && (/^\/(?!\/)/.test(value) || /^https:\/\/[^\s]+$/.test(value) || /^mailto:[^\s]+$/.test(value));
const validDate = value => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export function validateContent(value) {
  if(value?.schemaVersion!==1 || !value.groups || !Array.isArray(value.tools) || !Array.isArray(value.calendar?.dates) || !Array.isArray(value.events)) throw Error('Unsupported community content');
  if(!safeUrl(value.calendar.source) || typeof value.calendar.edition!=='string' || typeof value.homepage?.eventsIntro!=='string') throw Error('Invalid calendar information');
  for(const group of Object.values(value.groups)) if(typeof group.title!=='string' || typeof group.intro!=='string') throw Error('Invalid public group');
  const ids = new Set();
  for(const tool of value.tools) {
    if(typeof tool.id!=='string' || !tool.id || ids.has(tool.id) || typeof tool.title!=='string' || !tool.title || typeof tool.detail!=='string' || !tool.detail || !safeUrl(tool.href) || !value.groups[tool.group]) throw Error('Invalid or duplicate public tool');
    if((tool.homepage?.href && !safeUrl(tool.homepage.href)) || (tool.signupHref&&!safeUrl(tool.signupHref)) || (tool.homepage?.actionHref&&!safeUrl(tool.homepage.actionHref))) throw Error('Invalid homepage link');
    if(tool.homepage) for(const field of ['body','action','href','actionHref','variant']) if(tool.homepage[field]!==undefined && typeof tool.homepage[field]!=='string') throw Error('Invalid homepage tool copy');
    ids.add(tool.id);
  }
  for(const required of ['calendar','capsule','newsletter','volunteer','uniforms','hours','collective','email','instagram']) if(!ids.has(required) || value.tools.find(tool=>tool.id===required).app===false) throw Error('Missing core public destination: '+required);
  for(const event of [...value.calendar.dates,...value.events]) {
    if(!validDate(event.start) || !validDate(event.end) || event.end<event.start || typeof event.title!=='string' || !event.title || (event.href&&!safeUrl(event.href)) || (event.detail!==undefined&&typeof event.detail!=='string') || (event.cta!==undefined&&typeof event.cta!=='string')) throw Error('Invalid community event');
  }
  if(value.announcements!==undefined && !Array.isArray(value.announcements)) throw Error('Invalid announcements');
  const announcementIds=new Set();
  for(const item of value.announcements||[]) {
    if(typeof item.id!=='string' || !item.id || announcementIds.has(item.id) || !['draft','published','archived'].includes(item.status)) throw Error('Invalid announcement identity or status');
    if(!['card','featured'].includes(item.placement) || !Number.isFinite(item.priority)) throw Error('Invalid announcement placement');
    for(const field of ['kicker','title','body','cta']) if(typeof item[field]!=='string' || !item[field].trim()) throw Error('Invalid announcement copy');
    if(!safeUrl(item.href) || (item.image&&!safeUrl(item.image)) || (item.secondaryHref&&!safeUrl(item.secondaryHref))) throw Error('Invalid announcement link');
    for(const field of ['imageAlt','note','secondaryCta']) if(item[field]!==undefined&&typeof item[field]!=='string') throw Error('Invalid announcement copy');
    for(const field of ['startsAt','endsAt']) if(item[field]!=null && (typeof item[field]!=='string' || !validDate(item[field].slice(0,10)) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(item[field]) || !Number.isFinite(Date.parse(item[field])))) throw Error('Use an explicit time zone for announcement scheduling');
    if(item.startsAt&&item.endsAt&&Date.parse(item.endsAt)<=Date.parse(item.startsAt)) throw Error('Announcement must end after it starts');
    announcementIds.add(item.id);
  }
  return value;
}
export const publicTools = content => content.tools.filter(tool=>tool.app!==false);
export function upcomingItems(content,today) {
  const unique=new Map();
  for(const item of [...content.calendar.dates,...content.events]) {const key=[item.start,item.end,item.title].join('|');unique.set(key,{...unique.get(key),...item});}
  return [...unique.values()].filter(item=>item.end>=today)
    .sort((a,b)=>a.start.localeCompare(b.start) || (b.priority||0)-(a.priority||0));
}
export function homepageTools(content) {
  return content.tools.filter(tool=>tool.homepage).sort((a,b)=>(a.homepage.order||0)-(b.homepage.order||0))
    .map(tool=>({...tool,...tool.homepage,body:tool.homepage.body||tool.detail,action:tool.homepage.action||'Open tool',countdown:tool.homepage.countdown?new Date(tool.homepage.countdown):undefined}));
}
export function dateCard(item) {
  const start=new Date(item.start+'T12:00:00Z'), end=new Date(item.end+'T12:00:00Z');
  const fmt=(date,field)=>date.toLocaleDateString('en-US',{[field]:'short',timeZone:'UTC'});
  return {...item,month:fmt(start,'month')+(item.start.slice(0,7)!==item.end.slice(0,7)?'–'+fmt(end,'month'):''),year:String(start.getUTCFullYear())+(start.getUTCFullYear()!==end.getUTCFullYear()?'–'+end.getUTCFullYear():''),weekday:fmt(start,'weekday')+(item.start!==item.end?'–'+fmt(end,'weekday'):''),day:String(start.getUTCDate())+(item.start!==item.end?'–'+end.getUTCDate():''),label:item.title};
}

// Draft and archived copy is excluded from the public feed and browser bundles.
export function publicContent(content) {
  return {...content,announcements:(content.announcements||[]).filter(item=>item.status==='published')};
}
export function activeAnnouncements(content,now=new Date()) {
  const instant=+now;
  return (content.announcements||[]).filter(item=>item.status==='published' && (!item.startsAt||Date.parse(item.startsAt)<=instant) && (!item.endsAt||instant<Date.parse(item.endsAt)))
    .slice().sort((a,b)=>b.priority-a.priority || a.id.localeCompare(b.id));
}
