import sharp from 'sharp';
import {shareSvg} from '../../src/trip-engine/branding.js';
import {engineRpc} from './rpc.js';
import {r2,UUID,mediaKeys} from './storage.js';
export const ORIGIN='https://wearercap.org';
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function cardFor(result,{trip,album,photo,intake}={}){
 const t=result?.trip,available=t&&t.slug===trip;
 const p=available&&UUID.test(photo||'')?result.photos.find(p=>p.id===photo&&p.tripId===t.engineId&&p.album===album&&p.state==='visible'&&p.storage==='r2'&&p.webKey===mediaKeys(t.engineId,p.id).web):null;
 const canonical=available?`${ORIGIN}/trips/${t.slug}/${p?`e/${p.album}/p/${p.id}`:''}`:`${ORIGIN}/`;
 const destination=available?new URL('/trip-vault/',ORIGIN):new URL('/',ORIGIN);
 if(available){destination.searchParams.set('trip',t.slug);if(p){destination.searchParams.set('photo',p.id);destination.searchParams.set('album',p.album);}if(intake==='send-off')destination.searchParams.set('intake','send-off');}
 return {available,exact:Boolean(p),title:available?`${t.destination} · Class of ${t.cohort}`:'We Are RCAP',description:available?`${t.start} to ${t.end}. One trip. Every moment.`:'Ron Clark Academy parent community.',canonical,destination:destination.href,image:p?`${r2().publicBase}/${p.webKey}`:available?`${ORIGIN}/trips/${t.slug}/og.jpg`:`${ORIGIN}/trip-vault/trip-memories-og.jpg`};
}
export function renderCard(c){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.title)}</title><link rel="canonical" href="${esc(c.canonical)}"><meta name="robots" content="noindex,nofollow"><meta property="og:type" content="website"><meta property="og:title" content="${esc(c.title)}"><meta property="og:description" content="${esc(c.description)}"><meta property="og:url" content="${esc(c.canonical)}"><meta property="og:image" content="${esc(c.image)}"><meta property="og:image:type" content="image/jpeg">${c.exact?'':'<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'}<meta property="og:image:alt" content="${esc(c.title)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(c.title)}"><meta name="twitter:description" content="${esc(c.description)}"><meta name="twitter:image" content="${esc(c.image)}"><meta name="twitter:image:alt" content="${esc(c.title)}"><meta http-equiv="refresh" content="0; url=${esc(c.destination)}"></head><body><a href="${esc(c.destination)}">Open the trip album</a></body></html>`;}
export async function ogImage(t){return sharp(Buffer.from(shareSvg(t))).jpeg({quality:90}).toBuffer();}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'&&req.method!=='HEAD')return res.status(405).end();
 const q=req.query||{};let result;
 try{result=await engineRpc('get',{slug:q.trip,album:q.album||null,id:q.photo||null,limit:1});}
 catch(e){if(e.status!==404){res.setHeader('Content-Type','text/html; charset=utf-8');return res.status(503).send(renderCard(cardFor(null,q)));}}
 if(q.og==='1'){
  if(!result){res.setHeader('Content-Type','text/html; charset=utf-8');return res.status(404).send(renderCard(cardFor(null,q)));}
  try{const image=await ogImage(result.trip);res.setHeader('Content-Type','image/jpeg');return res.status(200).send(image);}catch{return res.status(503).end();}
 }
 const c=cardFor(result,q);res.setHeader('Content-Type','text/html; charset=utf-8');return res.status(c.available?200:404).send(renderCard(c));
}
