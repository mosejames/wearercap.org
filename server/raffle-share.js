import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';
const BASE = 'https://wearercap.org/events/2026/fall-raffle/share/';
export function shareNames(q = {}) {
  const clean = value => (typeof value === 'string' ? value : '').normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return { scholar: clean(q.scholar), family: clean(q.family) };
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function raffleShareHtml(q = {}, record = null) {
  const { scholar, family } = shareNames(record || q);
  const params = new URLSearchParams({ ...(scholar ? {scholar} : {}), ...(family ? {family} : {}) });
  const url = record ? `${BASE}?id=${record.id}` : BASE + (params.size ? `?${params}` : '');
  const image = record?.imageUrl || `https://wearercap.org/api/vault-og?card=raffle-share&${params}`;
  const title = scholar ? `Cheer on ${scholar}. Give our teachers a little love.` : 'Share the RCAP Fall Raffle with your friends.';
  const description = `${family ? `An invitation from the ${family} family. ` : ''}Tickets are $1. Every ticket supports Teacher Appreciation Week.`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(url)}"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:type" content="${record ? 'image/jpeg' : 'image/png'}"><meta property="og:image:alt" content="${esc(title)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}"><meta name="twitter:image:alt" content="${esc(title)}"><meta name="theme-color" content="#1b2c56"><link rel="stylesheet" href="/raffle-share/style.css"></head><body><header><a href="/"><img src="/brand/rcap-reversed.svg" alt="RCAP" width="110"></a><a href="/events/2026/fall-raffle/">Raffle details</a></header><main><section id="invitation" ${scholar ? '' : 'hidden'}>${record ? `<img class="finished-photo" id="finished-photo" src="${esc(record.imageUrl)}" alt="${esc(`The ${family} family invites you to support ${scholar} in the RCAP Fall Raffle`)}" width="1200" height="630">` : `<div class="card"><span class="eyebrow">RCAP FALL RAFFLE · 2026</span><p id="from">${esc(family ? `The ${family} family invites you` : 'You’re invited')}</p><h1>Cheer on <span id="scholar">${esc(scholar)}</span>.<br>Give our teachers a little love.</h1><p>Big thanks. A little luck. Tickets just <strong>$1.</strong></p><div class="ticket">Supporting Teacher Appreciation Week</div></div>`}<div class="buy"><h2>A small ticket. A big thank-you.</h2><p>Enter to win gift cards, a gaming system, Hawks or Falcons tickets and more. Every ticket supports our teachers and staff.</p><a class="button" id="buy" href="https://www.zeffy.com/en-US/ticketing/ron-clark-academy-parents-fall-fundraiser--2026">Buy $1 raffle tickets</a><p class="credit">At checkout, credit scholar <strong id="credit-name">${esc(scholar)}</strong>.</p><button class="quiet" id="copy-name" type="button">Copy scholar’s name</button><p class="fine">Please enter the scholar’s name in the raffle form. This link does not automatically fill in checkout.</p><a href="/events/2026/fall-raffle/">See prizes, deadlines and drawing dates</a></div><section class="sharing"><h2>Pass a little luck along.</h2><div class="actions"><button id="share" class="button">Share invitation</button><button id="copy" class="outline">Copy link</button><button id="download" class="outline">Save card</button></div><p id="share-status" role="status"></p><button id="edit" class="quiet">Create your own invitation</button><button id="hide" class="quiet" hidden>Hide my invitation</button></section></section><section id="creator" ${scholar ? 'hidden' : ''}><div class="create-heading"><span class="eyebrow">RCAP FALL RAFFLE · PHOTO INVITATION</span><h1>A familiar face. A little raffle magic.</h1><p>Add your scholar or family photo. Invite your people to support our teachers by buying $1 tickets.</p></div><form id="form"><div class="editor-grid"><div><div class="photo-stage"><canvas id="photo-preview" width="1200" height="630" aria-label="Preview of your raffle invitation"></canvas><label class="photo-upload" id="photo-prompt" for="photo-input"><span aria-hidden="true">＋</span>Add your scholar or family photo</label></div><input id="photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" class="file-input" aria-label="Upload scholar or family photo"><button id="change-photo" class="outline" type="button">Choose a photo</button><div id="crop-controls" hidden><p class="fine">Adjust the photo to keep everyone in the frame.</p><label>Zoom<input id="zoom" type="range" min="1" max="3" step="0.02" value="1"></label><div class="crop-sliders"><label>Left / right<input id="pan-x" type="range" min="0" max="1" step="0.01" value="0.5"></label><label>Up / down<input id="pan-y" type="range" min="0" max="1" step="0.01" value="0.5"></label></div></div><fieldset class="frames"><legend>Choose your frame</legend><label><input type="radio" name="frame" value="navy" checked><span class="swatch navy"></span>Navy &amp; gold</label><label><input type="radio" name="frame" value="gold"><span class="swatch gold"></span>Golden ticket</label></fieldset></div><div class="create-fields"><label>Scholar’s name<input name="scholar" maxlength="60" required autocomplete="off" value="${esc(scholar)}" placeholder="Scholar’s name"></label><label>Family name<input name="family" maxlength="60" required autocomplete="off" value="${esc(family)}" placeholder="For example, Johnson"></label><p class="fine">Your photo and names appear on your invitation and its message preview. Anyone with your link can view it. It won’t appear in a public gallery.</p><label class="consent"><input type="checkbox" id="photo-consent" required>I have permission to share this photo.</label><p id="create-status" role="status"></p><button id="create-button" class="button" type="submit">Create my photo invitation</button><p class="fine">Next: share it by text, copy your link or save the card.</p></div></div></form></section></main><footer>Built by parents, for our community. <a href="/">We Are RCAP</a></footer><script src="/raffle-share/app.js" defer></script></body></html>`;
}
export function raffleShareImage(fonts, query) {
 const {scholar, family} = shareNames(query);
 const box = (style,...children) => h('div',{style:{display:'flex',...style}},...children);
 return new ImageResponse(box({width:'100%',height:'100%',background:'#1b2c56',color:'#faf4ea',fontFamily:'Figtree',padding:60,flexDirection:'column',justifyContent:'space-between',border:'12px solid #f7a81c'},
 box({fontSize:25,color:'#f7a81c',letterSpacing:4,fontWeight:900},'RCAP FALL RAFFLE · 2026'),
 box({flexDirection:'column',gap:18},box({fontSize:27},family ? `The ${family} family invites you` : 'A little raffle magic. A big thank-you.'),box({fontSize:scholar.length>30?48:66,fontWeight:900,lineHeight:1.06},scholar?`Cheer on ${scholar}.`:'Share a little luck.'),box({fontSize:38,fontWeight:900},'Give our teachers a little love.')),
 box({justifyContent:'space-between',alignItems:'center'},box({fontSize:24},'Supporting Teacher Appreciation Week'),box({fontSize:32,background:'#f7a81c',color:'#1b2c56',padding:'16px 25px',borderRadius:8,fontWeight:900},'Tickets $1'))),{width:1200,height:630,fonts});
}
export async function raffleShareHandler(req,res) {
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Cache-Control','no-store');
 res.setHeader('Referrer-Policy','no-referrer');
 let record = null;
 if (req.query?.id != null) {
   try { const { getRafflePhoto } = await import('./raffle-photo.js'); record = await getRafflePhoto(req.query.id); }
   catch { return res.status(503).send('This invitation is temporarily unavailable. Please try again shortly.'); }
   // Never substitute a different family’s photo or retain names for a hidden record.
   if (!record) return res.status(404).send(raffleShareHtml());
 }
 return res.status(200).send(raffleShareHtml(record ? {} : req.query, record));
}

export function rafflePhotoImage(fonts, {photo,scholar,family,frame}) {
 const gold = frame === 'gold';
 const bg = gold ? '#edb744' : '#1b2c56';
 const ink = gold ? '#1b2c56' : '#faf4ea';
 const accent = gold ? '#1b2c56' : '#f7a81c';
 const box=(style,...children)=>h('div',{style:{display:'flex',...style}},...children);
 return new ImageResponse(box({width:'100%',height:'100%',background:bg,color:ink,fontFamily:'Figtree',padding:24,gap:32},
 box({width:650,height:582,borderRadius:14,overflow:'hidden',flexShrink:0},h('img',{src:photo,width:650,height:582,style:{objectFit:'cover'}})),
 box({flexDirection:'column',width:466,padding:'20px 22px 18px 0',justifyContent:'space-between'},
 box({fontSize:20,fontWeight:900,letterSpacing:3,color:accent},'RCAP FALL RAFFLE'),
 box({flexDirection:'column',gap:16},box({fontSize:21,wordBreak:'break-word'},`The ${family} family invites you`),box({fontSize:scholar.length>25?32:43,lineHeight:1.07,fontWeight:900,wordBreak:'break-word'},`Cheer on ${scholar}.`),box({fontSize:28,fontWeight:900,lineHeight:1.15},'Give our teachers a little love.')),
 box({flexDirection:'column',gap:15},box({background:accent,color:bg,borderRadius:8,padding:'14px 22px',fontSize:28,fontWeight:900},'Buy $1 raffle tickets'),box({fontSize:17},'Supporting Teacher Appreciation Week'),box({fontSize:16},'wearercap.org')))),{width:1200,height:630,fonts});
}
