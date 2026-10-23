import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';
import { raffleTimeLeft } from '../src/events/raffleCountdown.js';
const box = (style, ...children) => h('div', { style: { display: 'flex', ...style } }, ...children);
export function raffleCountdownImage(fonts, now = Date.now()) {
  const left = raffleTimeLeft(now);
  const updated = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(now);
  const tree = box({ width: '100%', height: '100%', flexDirection: 'column', padding: '14px 22px', background: '#121b30', color: '#faf4ea', fontFamily: 'Figtree', alignItems: 'center' },
    box({ color: '#f7a81c', fontSize: 12, fontWeight: 900, letterSpacing: 2 }, left.closed ? 'FIRST-DRAWING ENTRIES CLOSED' : 'FIRST-DRAWING ENTRY CLOSES IN'),
    left.closed
      ? box({ fontSize: 25, marginTop: 24, marginBottom: 24, fontWeight: 900 }, 'See the raffle page for upcoming drawings.')
      : box({ gap: 14, marginTop: 9 }, ...['days', 'hours', 'minutes'].map((unit) => box({ flexDirection: 'column', alignItems: 'center', width: 142 },
        box({ position: 'relative', width: 142, height: 96, borderRadius: 10, border: '1px solid #46516a', background: 'linear-gradient(180deg, #38435a 0%, #253047 49%, #1a2235 50%, #202a40 100%)', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 3px #080f1e', fontSize: 76, fontWeight: 900, letterSpacing: -3, lineHeight: 1 },
          String(left[unit]).padStart(2, '0'),
          box({ position: 'absolute', left: 0, right: 0, top: 47, height: 2, background: '#0a1020' })),
        box({ color: '#f7a81c', fontSize: 12, marginTop: 7, letterSpacing: 2, textTransform: 'uppercase' }, unit)))),
    box({ fontSize: 10, color: '#d3dae8', marginTop: 'auto' }, `Oct 24 · 11:59 p.m. Eastern  |  As of ${updated} Eastern`));
  return new ImageResponse(tree, { width: 588, height: 184, fonts });
}

export function newsletterCountdownImage(fonts,query,now=Date.now()) {
 const deadline=Number(query.deadline);
 if(!Number.isFinite(deadline)||deadline<Date.UTC(2020,0,1)||deadline>Date.UTC(2100,0,1))throw Error('Invalid deadline');
 const label=String(query.label||'COUNTING DOWN').slice(0,60),finished=String(query.finished||'The countdown has ended.').slice(0,96);
 const remaining=Math.max(0,Math.ceil((deadline-now)/1000));
 const values=[Math.floor(remaining/86400),Math.floor(remaining%86400/3600),Math.floor(remaining%3600/60)];
 const fmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
 const tree=box({width:'100%',height:'100%',background:'#121b30',color:'#faf4ea',fontFamily:'Figtree',padding:'14px 22px',flexDirection:'column',alignItems:'center'},
  box({fontSize:12,fontWeight:900,color:'#f7a81c',textAlign:'center'},label),
  remaining?box({gap:14,marginTop:9},...values.map((n,i)=>box({flexDirection:'column',alignItems:'center'},box({width:142,height:96,borderRadius:10,border:'1px solid #46516a',background:'linear-gradient(180deg,#38435a 0%,#253047 49%,#1a2235 50%,#202a40 100%)',justifyContent:'center',alignItems:'center',fontSize:n>99?50:76,fontWeight:900},String(n).padStart(2,'0')),box({fontSize:12,color:'#f7a81c',marginTop:7},['DAYS','HOURS','MINUTES'][i])))):box({fontSize:24,fontWeight:900,marginTop:24,textAlign:'center'},finished),
  box({fontSize:10,color:'#d3dae8',marginTop:'auto'},`${fmt.format(deadline)} Eastern | As of ${fmt.format(now)} Eastern`));
 return new ImageResponse(tree,{width:588,height:184,fonts});
}
