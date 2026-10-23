import {countdownConfig,countdownImageUrl} from './countdown.js';
import {campaignLinks} from '../../public/campaign-links.js';
import { RAFFLE_DETAILS_URL, RAFFLE_TICKET_URL } from '../events/raffleCountdown.js';
// RCAP newsletter model and email renderer.
//
// Pure functions only: the builder (browser), the public archive page
// (api/link.js on Vercel) and the tests all import this file, so it must not
// touch the DOM. The output matches the hand-built September 20 issue
// (newsletter/september-20/): table layout, inline styles, Arial, navy
// masthead, paper body. That issue survived a paste into Gmail, so this
// keeps to exactly the same vocabulary.

export const SITE = 'https://wearercap.org';
export const C = {
  navy: '#1a2a56', paper: '#faf4ea', sand: '#f1e6d4', gold: '#8f5e04',
  soft: '#5a4f47', line: '#e4d6c0', mist: '#d3dae8', body: '#1a2a56',
};

export const BLOCKS = {
  story: { label: 'Story', hint: 'A heading, a few lines, an optional photo and button.' },
  photo: { label: 'Photo', hint: 'One full-width picture. Tap it to open a link.' },
  quote: { label: 'Student quote', hint: 'Real words from a real student. Never invent one.' },
  dates: { label: 'Dates to circle', hint: 'A short list of what is coming up.' },
  countdown: { label: 'Countdown', hint: 'A compact countdown to your deadline, with optional actions.' },
  cards: { label: 'Link cards', hint: 'A row of clickable cards with your own words, icons and links.' },
  note: { label: 'One more thing', hint: 'A small aside with a link.' },
};
export const FORMATS = {
  quick: { label: 'Quick Hello', blurb: 'A short note, the dates, one link. For most weeks.', blocks: ['dates', 'note', 'story', 'cards', 'countdown'] },
  full: { label: 'Full Issue', blurb: 'A letter, photos, a student quote, thank-yous, and the ask. For the issues worth dressing up.', blocks: ['story', 'photo', 'quote', 'dates', 'note', 'cards', 'countdown'] },
};

const uid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

export function newBlock(type) {
  const id = uid();
  switch (type) {
    case 'countdown': return { id, type, heading:'', countdown:{label:'COUNTING DOWN',deadline:'',finished:'The countdown has ended.'},button:{label:'',url:''},link:{label:'',url:''} };
    case 'cards': return { id, type, kicker: '', heading: '', columns: 3, items: [newCard(), newCard(), newCard()] };
    case 'photo': return { id, type, image: { url: '', alt: '' }, href: '' };
    case 'quote': return { id, type, quote: '', by: '' };
    case 'dates': return { id, type, kicker: 'Dates to circle', heading: 'Coming up.', items: [{ id: uid(), when: '', what: '', detail: '', url: '' }] };
    case 'note': return { id, type, kicker: 'One more thing', heading: '', body: '', link: { label: '', url: '' } };
    default: return { id, type: 'story', tone: 'paper', kicker: '', heading: '', body: '', image: { url: '', alt: '' }, button: { label: '', url: '' }, link: { label: '', url: '' } };
  }
}
export const newCard = () => ({ id: uid(), icon: '', eyebrow: '', title: '', description: '', action: 'Learn more', url: '' });
export const newDate = () => ({ id: uid(), when: '', what: '', detail: '', url: '' });

export function longDate(iso) {
  const d = iso ? new Date(`${iso}T12:00:00`) : new Date();
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function template(format, isoDate) {
  const when = longDate(isoDate).toUpperCase();
  const base = { signer: 'Mose James IV', role: 'RCAP Chair', preheader: '' };
  if (format === 'quick') {
    return {
      ...base,
      subject: '',
      dateline: `A QUICK HELLO · ${when}`,
      kicker: 'From your RCAP family',
      headline: '',
      greeting: 'RCAP family,',
      body: '',
      button: { label: '', url: '' },
      blocks: [newBlock('dates')],
      signoff: 'See you soon,',
    };
  }
  return {
    ...base,
    subject: '',
    dateline: `RCAP UPDATE · ${when}`,
    kicker: 'Your week with RCAP',
    headline: '',
    greeting: 'Dear Ron Clark Academy Families,',
    body: '',
    button: { label: '', url: '' },
    blocks: [newBlock('photo'), newBlock('story'), newBlock('quote'), { ...newBlock('story'), tone: 'sand', kicker: 'Thank you for showing up' }, newBlock('dates')],
    signoff: 'With gratitude,',
  };
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------
export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function safeUrl(u) {
  const s = String(u || '').trim();
  if (/^https?:\/\/[^\s<>"']+$/i.test(s)) return s;
  if (/^mailto:[^\s<>"']+$/i.test(s)) return s;
  if (/^\/[^\s<>"']*$/.test(s)) return SITE + s;
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s<>"']*)?$/i.test(s)) return 'https://' + s;
  return '';
}

const linkStyle = `color:${C.navy};font-weight:700;text-decoration:underline;`;

// Inline formatting: **bold** and [label](link). Everything else is escaped.
export function inline(text) {
  let out = esc(text);
  out = out.replace(/\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)/g, (m, label, url) => {
    const href = safeUrl(url.replace(/&amp;/g, '&'));
    return href ? `<a href="${esc(href)}" style="${linkStyle}">${label}</a>` : label;
  });
  out = out.replace(/\*\*([^*\n]{1,300})\*\*/g, '<strong>$1</strong>');
  return out.replace(/\n/g, '<br>');
}

export function paragraphs(text, size = 16) {
  return String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p style="margin:0 0 16px;font-size:${size}px;line-height:1.65;color:${C.body};">${inline(p)}</p>`).join('');
}

const plain = (text) => String(text || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------
const kicker = (t) => t ? `<p style="margin:0 0 10px;font-size:11px;letter-spacing:2px;font-weight:800;text-transform:uppercase;color:${C.gold};">${esc(t)}</p>` : '';
const h1 = (t) => t ? `<h1 style="margin:0 0 12px;font-size:44px;line-height:1.02;letter-spacing:-2px;color:${C.navy};">${inline(t)}</h1>` : '';
const h2 = (t, small) => t ? `<h2 style="margin:0 0 ${small ? 12 : 16}px;font-size:${small ? 23 : 30}px;line-height:${small ? 1.2 : 1.1};letter-spacing:${small ? 0 : -1}px;color:${C.navy};">${inline(t)}</h2>` : '';
function button(b, onNavy) {
  const href = safeUrl(b?.url);
  if (!href || !String(b?.label || '').trim()) return '';
  return `<a href="${esc(href)}" style="display:inline-block;background:${C.paper};color:${C.navy};text-decoration:none;border:2px solid ${onNavy ? C.paper : C.navy};border-radius:999px;padding:13px 21px;font-size:13px;font-weight:800;line-height:1.3;">${esc(b.label)}</a>`;
}
function textLink(l) {
  const href = safeUrl(l?.url);
  if (!href || !String(l?.label || '').trim()) return '';
  return `<p style="margin:16px 0 0;font-size:14px;"><a href="${esc(href)}" style="${linkStyle}">${esc(l.label)}</a></p>`;
}
function image(img, href, inset) {
  const src = safeUrl(img?.url);
  if (!src) return '';
  const tag = `<img src="${esc(src)}" alt="${esc(img.alt || '')}" width="${inset ? 588 : 640}" style="display:block;width:100%;max-width:${inset ? 588 : 640}px;height:auto;border:0;${inset ? 'border-radius:12px;margin:0 0 18px;' : ''}">`;
  const link = safeUrl(href);
  return link ? `<a href="${esc(link)}" style="text-decoration:none;">${tag}</a>` : tag;
}
const row = (bg, padding, html) => html ? `<tr><td style="padding:${padding};background:${bg};">${html}</td></tr>` : '';

function storyBlock(b, { leading = false } = {}) {
  b=editableCardBlock(b);
  // A story with two actions keeps them together. Inline blocks wrap on phones
  // and survive the same Gmail paste as the existing single-button markup.
  const directAction = b.actionStyle==='solid';
  const primary = directAction
    ? button(b.button).replace(`background:${C.paper};`, 'background:#f7a81c;').replace('border-radius:999px;', 'border-radius:6px;')
    : button(b.button);
  const secondary = primary && safeUrl(b.link?.url) && String(b.link?.label || '').trim() ? button(b.link) : '';
  const directActions = b.centerActions || b.countdown
    ? `<div style="text-align:center;">${primary}${textLink(b.link)}</div>`
    : primary + textLink(b.link);
  const actions = b.cards ? cardItems(b.cards) : (b.centerActions||b.countdown) ? directActions : (directAction ? directActions : secondary
    ? `<div style="font-size:0;">${primary.replace('display:inline-block;', 'display:inline-block;margin:0 10px 10px 0;')}${secondary.replace('display:inline-block;', 'display:inline-block;margin:0 0 10px;')}</div>`
    : primary + textLink(b.link));
  const countdown = countdownMarkup(b.countdown,b.button?.url);
  const inner = image(b.image, b.button?.url, true) + kicker(b.kicker) + h2(b.heading) + paragraphs(safeUrl(b.button?.url) === RAFFLE_TICKET_URL ? String(b.body || '').replace('Every ticket supports Teacher Appreciation Week.', 'Every ticket supports RCAP’s efforts. This is our main fundraiser for Teacher Appreciation Week.') : b.body) + countdown + actions;
  return row(b.tone === 'sand' ? C.sand : C.paper, leading ? '14px 26px 30px' : '30px 26px', inner.trim() ? inner : '');
}
function photoBlock(b) { return row(C.paper, '0', image(b.image, b.href)); }
function quoteBlock(b) {
  if (!String(b.quote || '').trim()) return '';
  return row(C.navy, '34px 26px',
    `<p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:44px;line-height:.6;color:#f7a81c;">&ldquo;</p>`
    + `<p style="margin:10px 0 0;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:24px;line-height:1.35;color:${C.paper};">${inline(b.quote)}</p>`
    + (b.by ? `<p style="margin:16px 0 0;font-size:11px;letter-spacing:2px;font-weight:800;text-transform:uppercase;color:${C.mist};">${esc(b.by)}</p>` : ''));
}
function datesBlock(b) {
  const items = (b.items || []).filter((i) => String(i.what || '').trim() || String(i.when || '').trim());
  if (!items.length) return '';
  const rows = items.map((i, n) => {
    const href = safeUrl(i.url);
    const what = href ? `<a href="${esc(href)}" style="color:${C.navy};text-decoration:underline;">${esc(i.what)}</a>` : esc(i.what);
    return `<tr><td valign="top" style="padding:14px 14px 14px 0;width:96px;${n ? `border-top:1px solid ${C.line};` : ''}font-size:12px;letter-spacing:1px;font-weight:800;text-transform:uppercase;color:${C.gold};line-height:1.4;">${esc(i.when)}</td>`
      + `<td valign="top" style="padding:14px 0;${n ? `border-top:1px solid ${C.line};` : ''}"><p style="margin:0;font-size:16px;font-weight:800;line-height:1.35;color:${C.navy};">${what}</p>`
      + (i.detail ? `<p style="margin:4px 0 0;font-size:14px;line-height:1.5;color:${C.soft};">${inline(i.detail)}</p>` : '') + '</td></tr>';
  }).join('');
  return row(C.paper, '30px 26px', kicker(b.kicker) + h2(b.heading)
    + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">${rows}</table>`);
}
export function legacyLinkCards(b) {
  if (b.type !== 'note') return null;
  if (String(b.heading || '').replace(/[.\s]+$/, '').toLowerCase() !== 'things you may have missed') return null;
  const copy = {
    [`${SITE}/rcap-capsule/#/e/bingo-night`]: ['PHOTOS', 'Find your family. Relive the fun.', 'View photos'],
    [`${SITE}/rcap-capsule/#/e/chick-fil-a-spirit-night`]: ['PHOTOS', 'A night of food and school spirit.', 'View photos'],
    [`${SITE}/feedback/rb-karaoke`]: ['YOUR VOICE', 'Share your take in about 3 minutes.', 'Take the survey'],
  };
  const items = String(b.body || '').trim().split(/\n\s*\n/).map((part) => {
    const match = part.trim().match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    const url = match && safeUrl(match[2]);
    return match && copy[url] ? { label: match[1], url, copy: copy[url] } : null;
  });
  if (items.length !== 3 || items.some((item) => !item)) return null;
  return { id:b.id, type:'cards', kicker:b.kicker||'', heading:b.heading, columns:3, items:items.map(({label,url,copy:[eyebrow,description,action]},i)=>({id:`${b.id}-card-${i}`,icon:'',eyebrow,title:label,description,action,url})) };
}

export function editableCardBlock(block) {
 const legacy=legacyLinkCards(block);if(legacy)return legacy;
 if(block.type!=='story')return block;
 if(!block.cards&&safeUrl(block.button?.url)===`${SITE}/board/#committees`&&safeUrl(block.link?.url)==='https://www.paypal.com/ncp/payment/EWP8R298MW83A')return {...block,button:{label:'',url:''},link:{label:'',url:''},cards:{columns:2,style:'community',items:[
  {id:`${block.id}-committee`,icon:'team',eyebrow:'',title:block.button.label,description:'Meet the leads. Find your team.',action:'Explore the teams',url:block.button.url},
  {id:`${block.id}-membership`,icon:'heart',eyebrow:'',title:block.link.label,description:'Already given? Thank you. You’re all set.',action:'Membership donation',url:block.link.url}
 ]}};
 if(!Object.hasOwn(block,'countdown')&&safeUrl(block.button?.url)===RAFFLE_TICKET_URL&&safeUrl(block.link?.url)===RAFFLE_DETAILS_URL)return {...block,actionStyle:'solid',centerActions:true,countdown:{label:'FIRST-DRAWING ENTRY CLOSES IN',deadline:'2026-10-24T23:59',finished:'See the raffle page for upcoming drawings.'},link:{label:'Share the raffle with friends',url:`${SITE}/events/2026/fall-raffle/share/`}};
 if(!Object.hasOwn(block,'actionStyle')&&[RAFFLE_TICKET_URL,'https://www.signupgenius.com/go/10C0E4EADAD28A0FEC43-66825818-trunk'].includes(safeUrl(block.button?.url)))return {...block,actionStyle:'solid',centerActions:safeUrl(block.button?.url)===RAFFLE_TICKET_URL};
 return block;
}
function cardItems(b) {
  const items=(b.items||[]).slice(0,6).filter(i=>i.title||i.description||i.eyebrow||i.icon);
  if(!items.length)return '';
  const columns=Math.min(items.length,b.columns===2?2:3);
  return '<div style="font-size:0;text-align:center;">'+items.map(item=>{
    const url=safeUrl(item.url),element=url?'a':'div';
    return `<div class="nb-missed" style="display:inline-block;width:100%;width:calc((560px - 100%) * 1000);min-width:${100/columns}%;max-width:100%;vertical-align:top;text-align:left;">`
      +`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:separate;"><tr><td style="padding:4px;">`
      +`<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:${b.style==='community'?C.paper:C.sand};border:1px solid ${C.line};border-top:4px solid ${b.style==='community'?C.line:C.gold};border-radius:8px;"><tr><td valign="top">`
      +`<${element}${url?` href="${esc(url)}"`:''} style="display:block;padding:16px 14px;color:${C.navy};text-decoration:none;">`
      +(['team','heart'].includes(item.icon)?`<img src="${SITE}/newsletter-assets/${item.icon==='team'?'committee-team-icon':'community-giving-icon'}.png" width="24" height="24" alt="" style="display:block;margin:0 0 9px;border:0;">`:item.icon?`<span aria-hidden="true" style="display:block;font-size:22px;margin:0 0 9px;">${esc(item.icon)}</span>`:'')
      +(item.eyebrow?`<span style="display:block;font-size:9px;font-weight:800;letter-spacing:1.3px;color:${C.gold};margin:0 0 9px;">${esc(item.eyebrow)}</span>`:'')
      +(item.title?`<strong style="display:block;font-size:15px;line-height:1.25;margin:0 0 8px;">${esc(item.title)}</strong>`:'')
      +(item.description?`<span style="display:block;font-size:12px;line-height:1.4;color:${C.body};margin:0 0 12px;">${esc(item.description)}</span>`:'')
      +(url&&item.action?`<span style="display:block;font-size:12px;font-weight:800;text-decoration:underline;">${esc(item.action)}</span>`:'')
      +`</${element}></td></tr></table></td></tr></table></div>`;
  }).join('')+'</div>';
}
function countdownMarkup(value,url) {
 if(!value)return '';
 const src=countdownImageUrl(value);if(!src)return '';
 const alt=`${countdownConfig(value).label}. Deadline ${value.deadline.replace('T',' at ')} Eastern.`;
 const img=`<img src="${esc(src)}" alt="${esc(alt)}" width="400" style="display:block;width:100%;max-width:400px;height:auto;border:0;border-radius:8px;">`;
 return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" style="padding:0 0 18px;">${safeUrl(url)?`<a href="${esc(safeUrl(url))}" style="text-decoration:none;">${img}</a>`:img}</td></tr></table>`;
}
function countdownBlock(b) {return row(C.paper,'30px 26px',h2(b.heading)+countdownMarkup(b.countdown,b.button?.url)+`<div style="text-align:center;">${button(b.button)}${textLink(b.link)}</div>`);}
function cardsBlock(b) { return row(C.paper,'30px 26px',kicker(b.kicker)+h2(b.heading,true)+cardItems(b)); }
function noteBlock(b) {
  const legacy=legacyLinkCards(b);if(legacy)return cardsBlock(legacy);
  const inner = kicker(b.kicker) + h2(b.heading, true) + paragraphs(b.body) + (safeUrl(b.link?.url) && b.link?.label ? `<a href="${esc(safeUrl(b.link.url))}" style="${linkStyle}">${esc(b.link.label)}</a>` : '');
  return row(C.paper, '30px 26px', (b.heading || b.body) ? inner : '');
}
const RENDER = { countdown:countdownBlock, cards: cardsBlock, story: storyBlock, photo: photoBlock, quote: quoteBlock, dates: datesBlock, note: noteBlock };

// ---------------------------------------------------------------------------
// The email
// ---------------------------------------------------------------------------
// mark: the builder preview tags each part with data-nb so a tap in the
// preview can open that part in the editor. Never set for the copied email.
const tagRow = (html, key, mark) => (mark && html.startsWith('<tr>') ? `<tr data-nb="${esc(key)}">` + html.slice(4) : html);

export function renderEmail(c = {}, { webUrl = '', mark = false, analytics = false } = {}) {
  const pre = c.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(c.preheader)}</div>` : '';
  const view = safeUrl(webUrl) ? `<p style="margin:14px 0 0;font-size:10px;letter-spacing:2px;"><a href="${esc(safeUrl(webUrl))}" style="color:${C.mist};text-decoration:underline;">VIEW ON THE WEB</a></p>` : '';
  const masthead = `<tr><td style="padding:30px 26px;background:${C.navy};"><a href="${SITE}" style="text-decoration:none;"><img src="${SITE}/images/we-are-rcap-logo.png" alt="We Are RCAP" width="160" style="display:block;width:160px;max-width:100%;height:auto;border:0;margin:0 0 20px;"></a>`
    + (c.dateline ? `<p style="margin:8px 0 0;color:${C.mist};font-size:10px;letter-spacing:2px;">${esc(c.dateline)}</p>` : '') + view + '</td></tr>';
  const opener = kicker(c.kicker) + h1(c.headline)
    + (c.greeting ? `<p style="margin:0 0 10px;font-size:16px;line-height:1.65;color:${C.body};">${esc(c.greeting)}</p>` : '')
    + paragraphs(c.body).replaceAll('margin:0 0 16px;', 'margin:0 0 10px;') + button(c.button);
  const blocks = (c.blocks || []).map((b, index) => tagRow((RENDER[b.type] || storyBlock)(b, { leading: index === 0 }), `block:${b.id}`, mark)).join('');
  const closing = `<tr><td style="padding:30px 26px;background:${C.paper};">`
    + (c.signoff ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:${C.body};">${esc(c.signoff)}</p>` : '')
    + (c.signer ? `<p style="margin:0 0 20px;font-size:17px;font-weight:800;color:${C.navy};">${esc(c.signer)}${c.role ? `<br><span style="font-size:12px;font-weight:400;">${esc(c.role)}</span>` : ''}</p>` : '')
    + `<a href="${SITE}" style="display:block;margin:28px 0 0;"><img src="${SITE}/newsletter-assets/rcap-footer.png" alt="RCAP. Ron Clark Academy Parents" width="180" style="display:block;width:180px;max-width:100%;height:auto;border:0;"></a>`
    + `<p style="margin:22px 0 0;font-size:12px;color:${C.soft};">Built by parents, for our community.<br><a href="${SITE}" style="${linkStyle}">wearercap.org</a></p></td></tr>`;
  const email = pre + `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:640px;margin:0 auto;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;color:${C.navy};background:${C.paper};">`
    + tagRow(masthead, 'sending', mark) + tagRow(row(C.paper, '22px 26px 0', opener.trim() ? opener : ''), 'opening', mark) + blocks + tagRow(closing, 'closing', mark) + '</table>';
  return analytics && !mark ? campaignLinks(email, webUrl.split('/').filter(Boolean).at(-1)||'current') : email;
}

export function renderDocument(c, opts = {}) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(c.subject || 'RCAP newsletter')}</title><style>@media (max-width:620px){.nb-missed{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important}}</style></head>`
    + `<body style="margin:0;padding:24px 0;background:#dce0e7;">${renderEmail(c, opts)}</body></html>`;
}

export function plainText(c = {}) {
  const out = [c.dateline, c.kicker, plain(c.headline), c.greeting, plain(c.body)];
  if (c.button?.label && safeUrl(c.button.url)) out.push(`${c.button.label}: ${safeUrl(c.button.url)}`);
  for (const original of c.blocks || []) {
    const b=editableCardBlock(original);
    if(b.countdown&&countdownConfig(b.countdown).valid)out.push(`${b.countdown.label}: ${b.countdown.deadline.replace('T',' at ')} Eastern.`);
    if(b.cards)out.push(...b.cards.items.map(i=>`${i.title}\n${i.description}\n${i.action}: ${safeUrl(i.url)}`));
    if(b.type==='cards'){out.push([b.kicker,b.heading,...(b.items||[]).flatMap(i=>[i.eyebrow,i.title,i.description,safeUrl(i.url)?`${i.action||'Learn more'}: ${safeUrl(i.url)}`:''])].filter(Boolean).join('\n'));continue;}
    if (b.type === 'quote' && b.quote) out.push(`"${plain(b.quote)}"${b.by ? ` (${b.by})` : ''}`);
    else if (b.type === 'dates') out.push([b.heading, ...(b.items || []).filter((i) => i.what).map((i) => `${i.when}: ${i.what}${i.detail ? `. ${plain(i.detail)}` : ''}`)].filter(Boolean).join('\n'));
    else if (b.type === 'photo') continue;
    else {
      out.push([b.kicker, plain(b.heading), plain(b.body)].filter(Boolean).join('\n'));
      if (b.button?.label && safeUrl(b.button.url)) out.push(`${b.button.label}: ${safeUrl(b.button.url)}`);
      if (b.link?.label && safeUrl(b.link.url)) out.push(`${b.link.label}: ${safeUrl(b.link.url)}`);
    }
  }
  out.push([c.signoff, c.signer, c.role].filter(Boolean).join('\n'), 'wearercap.org');
  return out.filter((s) => String(s || '').trim()).join('\n\n');
}

// Sending happens from the shared RCAP Gmail. Gmail's compose link carries the
// subject and recipients but only plain text, so the formatted newsletter is
// copied to the clipboard and pasted into the body.
export const RCAP_SENDER = 'rcaparents@ronclarkacademy.com';
export const DEFAULT_BCC = ['rcap2027', 'rcap2028', 'rcap2029', 'rcap2030', 'rcap2031'].map((c) => `${c}@ronclarkacademy.com`).join(', ');
export function gmailComposeUrl(c = {}) {
  const q = new URLSearchParams({ authuser: RCAP_SENDER, view: 'cm', fs: '1', to: RCAP_SENDER, bcc: (c.bcc ?? DEFAULT_BCC).replace(/\s+/g, ''), su: c.subject || '' });
  return `https://mail.google.com/mail/?${q.toString()}`;
}
export function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}
export function suggestSlug(c, isoDate) {
  const d = isoDate ? new Date(`${isoDate}T12:00:00`) : new Date();
  const stamp = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toLowerCase().replace(/\s+/g, '-');
  const s = slugify(`${stamp} ${(c.headline || c.subject || '').split(/\s+/).slice(0, 5).join(' ')}`);
  return s.length >= 2 ? s : stamp;
}

// ---------------------------------------------------------------------------
// House-style check. RCAP rules: no em dashes anywhere a person reads, no
// exclamation points in body copy, real alt text, real quotes. These are
// suggestions shown in the builder, never blockers.
// ---------------------------------------------------------------------------
export function styleCheck(c = {}) {
  const notes = [];
  const fields = [['Subject', c.subject], ['Headline', c.headline], ['Opening note', c.body], ['Masthead line', c.dateline], ['Kicker', c.kicker]];
  (c.blocks || []).forEach((b, n) => {
    const name = `${BLOCKS[b.type]?.label || 'Section'} ${n + 1}`;
    fields.push([name, [b.kicker, b.heading, b.body, b.quote, b.by, ...(b.items || []).flatMap((i) => [i.when, i.what, i.detail, i.eyebrow, i.title, i.description, i.action])].filter(Boolean).join(' ')]);
    if ((b.type === 'photo' || b.type === 'story') && safeUrl(b.image?.url) && !String(b.image?.alt || '').trim()) notes.push({ field: name, kind: 'alt', text: 'Add a short photo description so screen readers and blocked images still make sense.' });
    if(b.countdown&&!countdownConfig(b.countdown).valid)notes.push({field:name,kind:'deadline',text:'Choose a valid Eastern deadline for the countdown.'});
    if(b.cards&&(b.cards.items||[]).some(i=>(i.title||i.description)&&!safeUrl(i.url)))notes.push({field:name,kind:'link',text:'Add a valid destination to each link card before sending.'});
    if(b.type==='cards'&&(b.items||[]).some(i=>(i.title||i.description)&&!safeUrl(i.url))) notes.push({field:name,kind:'link',text:'Add a valid destination to each link card before sending.'});
    if (b.type === 'quote' && b.quote && !b.by) notes.push({ field: name, kind: 'quote', text: 'Name the student who said it. Quotes stay real.' });
  });
  for (const [field, text] of fields) {
    if (/[—–]|--/.test(text || '')) notes.push({ field, kind: 'dash', text: 'Swap the dash for a period, comma, or colon.' });
  }
  for (const [field, text] of fields.filter(([f]) => f !== 'Subject')) {
    if (/!/.test(text || '')) notes.push({ field, kind: 'bang', text: 'Let the detail carry the excitement. Drop the exclamation point.' });
  }
  if (!String(c.subject || '').trim()) notes.unshift({ field: 'Subject', kind: 'subject', text: 'Add a subject line before you send.' });
  return notes;
}

// Replace dashes the way the house style asks. Used by the one-tap fix.
export function fixDashes(c) {
  const fix = (s) => typeof s === 'string' ? s.replace(/\s*[—]\s*|\s+--\s+/g, ', ').replace(/(\d)\s*–\s*(\d)/g, '$1 to $2').replace(/\s*–\s*/g, ', ') : s;
  const walk = (v) => Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'url' || k === 'href' || k === 'id' ? x : walk(x)])) : fix(v);
  return walk(c);
}
