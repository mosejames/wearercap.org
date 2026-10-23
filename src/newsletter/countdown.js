// Deadlines are entered in school time, independently of the editor's device.
export function easternDeadline(value) {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value||''))return NaN;
 const [y,m,d,h,min]=value.match(/\d+/g).map(Number),local=Date.UTC(y,m-1,d,h,min);
 const check=new Date(local);if(check.getUTCFullYear()!==y||check.getUTCMonth()!==m-1||check.getUTCDate()!==d||h>23||min>59)return NaN;
 let utc=local+5*3600000;
 for(let i=0;i<3;i++){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(utc).map(p=>[p.type,p.value]));
  const shown=Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute);
  if(shown===local)return utc;
  utc+=local-shown;
 }
 return NaN;
}
export function countdownConfig(value={}) {
 const deadline=easternDeadline(value.deadline);
 return {deadline,label:String(value.label||'COUNTING DOWN').slice(0,60),finished:String(value.finished||'The countdown has ended.').slice(0,96),valid:Number.isFinite(deadline)&&deadline>=Date.UTC(2020,0,1)&&deadline<=Date.UTC(2100,0,1)};
}
export function countdownImageUrl(value) {
 const config=countdownConfig(value);if(!config.valid)return '';
 const q=new URLSearchParams({card:'newsletter-countdown',deadline:String(config.deadline),label:config.label,finished:config.finished});
 return `https://wearercap.org/api/vault-og?${q}`;
}
