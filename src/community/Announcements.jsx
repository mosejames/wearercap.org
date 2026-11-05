import React,{useEffect,useState} from 'react';
import {ArrowRight,ArrowUpRight} from 'lucide-react';
import {useCommunityContent} from './CommunityContent.jsx';
import {activeAnnouncements} from './model.js';
import './announcements.css';
export function useAnnouncements() {
  const content=useCommunityContent();
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{
    const update=()=>setNow(new Date());
    const interval=window.setInterval(update,60000);
    const visible=()=>{if(document.visibilityState==='visible') update();};
    window.addEventListener('focus',update);document.addEventListener('visibilitychange',visible);
    return()=>{window.clearInterval(interval);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',visible);};
  },[]);
  return activeAnnouncements(content,now);
}
export default function Announcements({view='app',placement}) {
  const all=useAnnouncements();
  const items=placement?all.filter(item=>item.placement===placement):all;
  if(!items.length) return null;
  if(view==='main' && placement==='featured') return <>{items.map(item=><article key={item.id} className="home-collective home-raffle" data-announcement={item.id}>
    <div className="home-collective-copy"><p className="section-label">{item.kicker}</p><h3>{item.title}</h3><p>{item.body}</p>{item.note&&<p><strong>{item.note}</strong></p>}<a className="button primary" href={item.href}>{item.cta} <ArrowUpRight size={18} aria-hidden="true"/></a>{item.secondaryHref&&<p><a href={item.secondaryHref}>{item.secondaryCta} ↗</a></p>}</div>
    {item.image&&<a className="home-collective-visual" href={item.href} aria-label={item.cta}><img src={item.image} alt={item.imageAlt||''} width="1200" height="630" loading="lazy"/></a>}
  </article>)}</>;
  if(view==='main') return <div className="callouts">{items.map(item=><a key={item.id} data-announcement={item.id} className={`callout callout-${item.tone==='social'?'social':'capsule'}${item.image?' has-photo':''}`} href={item.href}>
    {item.image&&<img className="callout-photo" src={item.image} alt={item.imageAlt||''} loading="lazy" width="1200" height="800"/>}<span className="callout-kicker">{item.kicker}</span><strong>{item.title}</strong><span className="callout-body">{item.body}</span><span className="callout-go">{item.cta} <ArrowRight size={17} aria-hidden="true"/></span>
  </a>)}</div>;
  return <section className="hub-announcements" aria-labelledby="announcements-title"><div className="hub-announcements-heading"><h2 id="announcements-title">From RCAP</h2><span>NEWS & ANNOUNCEMENTS</span></div><div className="hub-announcement-list">{items.map(item=><a key={item.id} href={item.href} data-announcement={item.id} className="hub-announcement">
    <div className="hub-announcement-copy"><small>{item.kicker}</small><h3>{item.title}</h3><p>{item.body}</p>{item.note&&<p className="hub-announcement-note">{item.note}</p>}<span>{item.cta} <ArrowRight size={14} aria-hidden="true"/></span></div>
    {item.image&&<img src={item.image} alt={item.imageAlt||''} loading="lazy" width="100" height="100"/>}
  </a>)}</div></section>;
}
