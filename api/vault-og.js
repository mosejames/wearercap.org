import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';
import { readFileSync } from 'node:fs';

// Bundle real font weights so social crawlers never depend on a font download.
const fonts = [
  { name:'Figtree', data:readFileSync(new URL('./fonts/Figtree-Medium.ttf',import.meta.url)), weight:500, style:'normal' },
  { name:'Figtree', data:readFileSync(new URL('./fonts/Figtree-Black.ttf',import.meta.url)), weight:900, style:'normal' },
];
const THEMES = {
  rcap: { navy:'#1a2a56', gold:'#f0b323', cream:'#faf4ea', name:'RCAP', word:'CAPSULE', family:'RON CLARK ACADEMY  /  PARENTS', band:'IN THE CAPSULE', path:'rcap-capsule' },
  amistad: { navy:'#bd0032', gold:'#ffd7e2', cream:'#fff8fa', name:'AMI', word:'VAULT', family:'AMISTAD  /  HOUSE OF FRIENDSHIP', band:'IN THE VAULT', path:'ami-vault' },
};
const box=(style,...children)=>h('div',{style:{display:'flex',...style}},...children);
function mark({navy, gold, cream}){return h('svg',{width:270,height:260,viewBox:'0 0 270 260'},
 h('rect',{x:51,y:29,width:161,height:190,rx:20,fill:navy,stroke:cream,strokeWidth:3,transform:'rotate(15 130 124)'}),
 h('rect',{x:34,y:35,width:161,height:190,rx:20,fill:navy,stroke:gold,strokeWidth:5,transform:'rotate(-12 114 130)'}),
 h('rect',{x:58,y:44,width:160,height:190,rx:20,fill:cream}),
 h('rect',{x:71,y:57,width:134,height:136,rx:10,fill:navy}),
 h('path',{d:'M79 177L120 128L145 153L166 131L197 177Z',fill:cream}),
 h('circle',{cx:170,cy:91,r:15,fill:gold}),
 h('path',{d:'M120 212H155',stroke:navy,strokeWidth:7,strokeLinecap:'round'}),
 h('path',{d:'M230 28L236 45L253 51L236 57L230 74L224 57L207 51L224 45Z',fill:gold}));}
function brandedCard(event, closed, theme){
 const {navy, gold, cream} = theme;
 const label = event.length > 64 ? `${event.slice(0, 61).trimEnd()}…` : event;return box({width:'100%',height:'100%',background:navy,fontFamily:'Figtree',flexDirection:'column',color:cream},
 box({height:421,padding:'36px 58px 30px',flexDirection:'column',position:'relative'},
 box({justifyContent:'space-between',alignItems:'center'},
 box({fontSize:29,fontWeight:900,letterSpacing:5,color:gold},theme.name),
 box({fontSize:17,fontWeight:500,letterSpacing:2,color:cream},theme.family)),
 box({alignItems:'center',justifyContent:'space-between',flexGrow:1},
 box({flexDirection:'column',marginTop:-5},box({fontWeight:900,fontSize:126,letterSpacing:-6,lineHeight:1},theme.word),box({fontSize:37,fontWeight:500,marginTop:22,letterSpacing:-1},'Your photos. Our memories.')),
 box({marginRight:4,marginTop:7},mark(theme))),
 box({fontSize:17,letterSpacing:1,color:cream},'SOMEONE’S FAVORITE PHOTO MIGHT BE YOURS.')),
 box({height:209,background:cream,color:navy,padding:'29px 58px',justifyContent:'space-between',alignItems:'center',borderTop:`7px solid ${gold}`},
 box({flexDirection:'column',width:690,flexShrink:0},box({fontSize:16,letterSpacing:3,fontWeight:900,marginBottom:5},theme.band),box({fontSize:label.length>40?36:label.length>20?48:67,letterSpacing:-2,fontWeight:900,lineHeight:1.08,wordBreak:'break-word'},label)),
 box({flexDirection:'column',alignItems:'flex-end',gap:14,flexShrink:0},box({fontSize:23,fontWeight:900,background:navy,color:cream,borderRadius:50,padding:'19px 24px',gap:12,alignItems:'center'},closed ? 'View the memories' : 'See photos. Add yours',h('svg',{width:24,height:24,viewBox:'0 0 24 24',fill:'none'},h('path',{d:'M5 19L19 5M5 5H19V19',stroke:cream,strokeWidth:2.5,strokeLinecap:'round',strokeLinejoin:'round'}))),box({fontSize:16,fontWeight:500},`wearercap.org/${theme.path}`))));}

export function eventCard(title, date, closed = false, vault = 'amistad') {
  return new ImageResponse(brandedCard(title, closed, THEMES[vault] || THEMES.amistad),
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
