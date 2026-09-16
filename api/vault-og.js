import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';
import { readFileSync } from 'node:fs';

// Bundle real font weights so social crawlers never depend on a font download.
const fonts = [
  { name:'Figtree', data:readFileSync(new URL('./fonts/Figtree-Medium.ttf',import.meta.url)), weight:500, style:'normal' },
  { name:'Figtree', data:readFileSync(new URL('./fonts/Figtree-Black.ttf',import.meta.url)), weight:900, style:'normal' },
];
const THEMES = {
  amistad: { bg:'#bd0032', mark:'AMI VAULT', fallback:'HOUSE OF FRIENDSHIP', soft:'#ffe5ed', date:'#ffd7e2', btn:'#bd0032', tag:'Our year. All together.' },
  rcap: { bg:'#1a1613', mark:'RCAP VAULT', fallback:'FOUR HOUSES. ONE SCHOOL.', soft:'#f4ecdf', date:'#f7a81c', btn:'#1a1613', tag:'Count it for your house.' },
};
export function eventCard(title, date, closed = false, vault = 'amistad') {
  const T = THEMES[vault] || THEMES.amistad;
  const fontSize = title.length > 110 ? 45 : title.length > 70 ? 55 : title.length > 42 ? 68 : 82;
  return new ImageResponse(h('div', {style:{display:'flex',width:'100%',height:'100%',padding:24,background:'#fff',fontFamily:'Figtree',color:'#fff'}},
    h('div', {style:{display:'flex',flexDirection:'column',justifyContent:'space-between',width:'100%',height:'100%',padding:'40px 46px',borderRadius:32,background:T.bg}},
      h('div', {style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:24}},
        h('div', {style:{fontSize:30,fontWeight:900,letterSpacing:3,color:vault==='rcap'?T.date:'#fff'}}, T.mark),
        h('div', {style:{fontSize:22,fontWeight:900,color:T.date,textAlign:'right',maxWidth:650}},date || T.fallback)),
      h('div', {style:{display:'flex',flexDirection:'column',gap:18}},
        h('div', {style:{fontSize,fontWeight:900,lineHeight:1.02,letterSpacing:-2,wordBreak:'break-word'}},title),
        h('div', {style:{fontSize:29,fontWeight:500,color:T.soft}},closed ? 'The moments we made. The memories we keep.' : 'Were you there? Share photos and videos.')),
      h('div', {style:{display:'flex',alignItems:'center',gap:32}},
        h('div', {style:{display:'flex',alignItems:'center',gap:20,background:'#fff',color:T.btn,padding:'20px 30px',borderRadius:22,fontSize:36,fontWeight:900}},
          !closed && h('svg',{width:34,height:34,viewBox:'0 0 24 24',fill:'none'},h('path',{d:'M12 3v18M3 12h18',stroke:T.btn,strokeWidth:3,strokeLinecap:'round'})),
          closed ? 'View the memories' : 'Add photos / videos'),
        h('div',{style:{fontSize:24,fontWeight:500,color:T.soft}},T.tag)))),
    {width:1200,height:630,fonts});
}

export default async function handler(req,res) {
  const title=String(req.query?.title || 'Our year. All together.').slice(0,180);
  const date=String(req.query?.date || '').slice(0,100);
  const png=Buffer.from(await eventCard(title,date,req.query?.closed==='1',String(req.query?.vault||'amistad')).arrayBuffer());
  res.setHeader('Content-Type','image/png');
  res.setHeader('Cache-Control','public, max-age=86400, s-maxage=31536000, immutable');
  res.status(200).send(png);
}
