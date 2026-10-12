import {captureTime} from './timeline.js';
import {instagramAccount} from './instagram.js';
const londonDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'});
export function photoDay(photo){const time=captureTime(photo);return time?londonDate.format(new Date(time)):'';}
export function matchesGalleryFilters(photo,{source='all',day='',place=''}={}){
 const instagram=Boolean(instagramAccount(photo));
 return (source==='all'||(source==='instagram'?instagram:!instagram))&&(!day||photoDay(photo)===day)&&(!place||(place==='unassigned'?!photo.inspiration:photo.inspiration===place));
}
