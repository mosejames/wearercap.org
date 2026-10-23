import {createHmac,timingSafeEqual} from 'node:crypto';
import {renderEmail} from '../src/newsletter/render.js';
const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
export function linkSignature(issue,url){
 const key=process.env.LONDON_IMPORT_STATE_KEY;if(!key)throw Error('Tracking key unavailable');
 return createHmac('sha256',key).update(`${issue}\n${url}`).digest('hex');
}
export function verifyNewsletterLink(issue,url,sig){
 if(!/^[a-z0-9-]{1,72}$/.test(issue||'')||!/^[a-f0-9]{64}$/.test(sig||''))return false;
 try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return false;return timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(linkSignature(issue,url),'hex'));}catch{return false;}
}
export function signedNewsletterLinks(content,issue){
 if(!process.env.LONDON_IMPORT_STATE_KEY)return {};
 const html=renderEmail(content),links={};
 for(const match of html.matchAll(/href="([^"]+)"/g)){
  const url=decode(match[1]);try{const u=new URL(url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)continue;}catch{continue;}
  const q=new URLSearchParams({issue,target:url,sig:linkSignature(issue,url)});links[url]=`https://wearercap.org/api/campaign-activity?${q}`;
 }
 return links;
}
