import React,{useEffect,useState} from 'react';
import {ArrowRight} from 'lucide-react';
import {useAnnouncements} from '../community/Announcements.jsx';
import {fetchNewsletterIssues} from './newsletters.js';

export default function Updates() {
  const announcements=useAnnouncements();
  const [state,setState]=useState({issues:[],status:'loading'});
  const [attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let controller,disposed=false;
    async function refresh() {
      controller?.abort();controller=new AbortController();
      const request=controller;
      const timeout=window.setTimeout(()=>request.abort(),8000);
      try {
        const issues=await fetchNewsletterIssues(request.signal);
        if(!disposed&&controller===request) setState({issues,status:'ready'});
      } catch {
        if(!disposed&&controller===request) setState({issues:[],status:'error'});
      } finally {window.clearTimeout(timeout);}
    }
    refresh();
    const timer=window.setInterval(refresh,60000);
    const visible=()=>{if(document.visibilityState==='visible') refresh();};
    window.addEventListener('focus',visible);window.addEventListener('online',refresh);document.addEventListener('visibilitychange',visible);
    return()=>{disposed=true;controller?.abort();window.clearInterval(timer);window.removeEventListener('focus',visible);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',visible);};
  },[attempt]);
  return <section className="hub-announcements" aria-label="RCAP updates"><div className="hub-announcement-list">
    {announcements.map(item=><a key={item.id} className="hub-announcement" href={item.href}>
      <div className="hub-announcement-copy"><small>{item.kicker}</small><h2>{item.title}</h2><p>{item.body}</p>{item.note&&<p className="hub-announcement-note">{item.note}</p>}<span>{item.cta} <ArrowRight size={14} aria-hidden="true"/></span></div>
      {item.image&&<img src={item.image} alt={item.imageAlt||''} width="100" height="100" loading="lazy"/>}
    </a>)}
    {state.issues.map(issue=><a key={issue.slug} className="hub-announcement" href={issue.href}><div className="hub-announcement-copy"><small><time dateTime={issue.date}>{issue.dateLabel}</time> · NEWSLETTER</small><h2>{issue.title}</h2><span>Read the update <ArrowRight size={14} aria-hidden="true"/></span></div></a>)}
    {state.status==='loading'&&<p role="status">Finding the latest updates…</p>}
    {state.status==='error'&&<div className="album-unavailable" role="status"><p>We couldn’t load newsletter issues right now.</p><button onClick={()=>setAttempt(n=>n+1)}>Try again</button> · <a href="/newsletter">Open newsletter archive</a></div>}
    {state.status==='ready'&&!state.issues.length&&!announcements.length&&<p>New updates will appear here when they’re published.</p>}
  </div></section>;
}
