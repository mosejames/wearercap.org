import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Eye,MousePointerClick,ArrowUpRight,X} from 'lucide-react';
import {supabase} from './api.js';
import './analytics.css';
const labels={newsletter_tickets:'Buy raffle tickets',newsletter_share:'Create a family raffle card',newsletter_volunteer:'Volunteer sign-up',newsletter_raffleDetails:'Fall raffle details',newsletter_trunkDetails:'Trunk or Treat details',newsletter_membership:'RCAP membership',newsletter_committees:'Join a committee',newsletter_bingo:'Bingo Night photos',newsletter_chickfila:'Chick-fil-A photos',newsletter_survey:'Parent survey',newsletter_calendar:'School calendar',newsletter_link:'Other newsletter links'};
export const linkClicks=counts=>Object.entries(counts||{}).filter(([key])=>key.startsWith('newsletter_')).reduce((sum,[,n])=>sum+n,0);
const fmt=n=>Number(n).toLocaleString();
const date=day=>new Date(day+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'});
export function AnalyticsSummary({data}){
 const clicks=linkClicks(data.counts),visits=data.counts.newsletterView||0;
 const destinations=Object.entries(data.counts).filter(([key,n])=>key.startsWith('newsletter_')&&n>0).sort((a,b)=>b[1]-a[1]);
 const daily=(data.byDay||[]).map(d=>({...d,clicks:linkClicks(d.counts),visits:d.counts.newsletterView||0}));
 const max=Math.max(1,...daily.flatMap(d=>[d.clicks,d.visits]));
 const points=key=>daily.map((d,i)=>`${12+i*576/Math.max(1,daily.length-1)},${138-d[key]/max*120}`).join(' ');
 return <>
  <div className="na-metrics">
   <article><Eye aria-hidden="true" size={23}/><strong>{fmt(visits)}</strong><h3>Web visits</h3><p>Visits to this newsletter’s web edition.</p></article>
   <article><MousePointerClick aria-hidden="true" size={23}/><strong>{fmt(clicks)}</strong><h3>Link clicks</h3><p>Tracked links followed from this newsletter.</p></article>
  </div>
  <section className="na-chart"><div className="na-section-title"><h3>Activity over time</h3><span>Last {data.days} days</span></div>
   <div className="na-legend"><span><i/> Web visits</span><span><i/> Link clicks</span></div>
   {visits+clicks===0?<p className="na-empty">No tracked activity for this newsletter in this period yet.</p>:<>
    <svg viewBox="0 0 600 160" role="img" aria-label={`Daily web visits and link clicks. Highest daily count: ${max}. Exact counts are available below.`}>
     {[18,78,138].map(y=><line key={y} x1="12" x2="588" y1={y} y2={y} stroke="#dfd7c9" strokeDasharray="4 5"/>)}
     <text x="12" y="12" fontSize="11" fill="currentColor">{fmt(max)}</text>
     <polyline points={points('visits')} fill="none" stroke="#1b2c56" strokeWidth="3" strokeLinejoin="round"/>
     <polyline points={points('clicks')} fill="none" stroke="#b7770a" strokeWidth="3" strokeLinejoin="round"/>
     {daily.map((d,i)=><g key={d.day}><title>{date(d.day)}: {d.visits} web visits, {d.clicks} link clicks</title><circle cx={12+i*576/Math.max(1,daily.length-1)} cy={138-d.visits/max*120} r="3" fill="#1b2c56"/><circle cx={12+i*576/Math.max(1,daily.length-1)} cy={138-d.clicks/max*120} r="3" fill="#b7770a"/></g>)}
    </svg>
    <div className="na-axis"><span>{daily[0]&&date(daily[0].day)}</span><span>{daily.length>0&&date(daily[daily.length-1].day)}</span></div>
    <details className="na-daily"><summary>View daily counts</summary><p>Dates use UTC. Today’s counts are still growing.</p><table><thead><tr><th>Date</th><th>Web visits</th><th>Link clicks</th></tr></thead><tbody>{daily.map(d=><tr key={d.day}><th>{date(d.day)}</th><td>{fmt(d.visits)}</td><td>{fmt(d.clicks)}</td></tr>)}</tbody></table></details>
   </>}
  </section>
  <section className="na-chart"><div className="na-section-title"><h3>What families clicked</h3><ArrowUpRight aria-hidden="true" size={22}/></div><p>Most-followed links in this newsletter.</p>
   {destinations.length===0?<p className="na-empty">When a tracked link is followed, its activity will appear here.</p>:<ol className="na-destinations">{destinations.map(([key,n])=><li key={key}><div><span>{labels[key]||'Other newsletter link category'}</span><strong>{fmt(n)} <small>{n===1?'click':'clicks'}</small></strong></div><div className="na-track" aria-hidden="true"><span style={{width:`${n/destinations[0][1]*100}%`}}/></div></li>)}</ol>}
   {(data.counts.newsletter_link||0)>0&&<p className="na-note">Other newsletter links combines destinations that earlier tracking did not label individually.</p>}
  </section>
  <p className="na-note">Counts are actions, not unique people. Gmail email opens are not tracked. Email scanners and blocked requests can affect counts; clicks do not confirm purchases or sign-ups.</p>
  {data.truncated&&<p role="status" className="na-note">The reporting limit was reached. These totals may be incomplete.</p>}
 </>;
}
export default function CampaignAnalytics({issueId,issueTitle}){
 const [open,setOpen]=useState(false),[data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[days,setDays]=useState(30),[refresh,setRefresh]=useState(0);
 const trigger=useRef(null),panel=useRef(null),closeButton=useRef(null);
 const close=()=>{setOpen(false);trigger.current?.focus();};
 useEffect(()=>{if(!open)return;closeButton.current?.focus();const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[open]);
 useEffect(()=>{if(!open)return;let cancelled=false;const controller=new AbortController();setData(null);setBusy(true);setError('');
  (async()=>{try{
   const {data:{session}}=await supabase.auth.getSession();
   const r=await fetch('/api/campaign-activity',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token||''}`},body:JSON.stringify({action:'report',issueId,days})});
   const body=await r.json();if(!r.ok)throw Error(body.error||'Could not load analytics');if(!cancelled)setData(body);
  }catch(e){if(!cancelled)setError(e.message);}finally{if(!cancelled)setBusy(false);}})();
  return()=>{cancelled=true;controller.abort();};
 },[open,issueId,days,refresh]);
 function keyboard(e){if(e.key==='Escape'){close();return;}if(e.key!=='Tab')return;const nodes=[...panel.current.querySelectorAll('button:not(:disabled),summary,[href],[tabindex="0"]')];const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
 return <><button ref={trigger} className="nb-text" onClick={()=>setOpen(true)}>Analytics</button>{open&&createPortal(<div className="na-overlay" onClick={e=>{if(e.target===e.currentTarget)close();}}><section ref={panel} role="dialog" aria-modal="true" aria-labelledby="na-title" className="na-panel" onKeyDown={keyboard}>
  <header><p className="na-kicker">THIS NEWSLETTER</p><button ref={closeButton} className="na-close" onClick={close} aria-label="Close analytics"><X size={22}/></button><h2 id="na-title">A look at the response</h2><p className="na-issue">{data?.issue?.title||issueTitle||'Newsletter analytics'}</p></header>
  <div className="na-controls"><div role="group" aria-label="Reporting period">{[7,30,90].map(n=><button key={n} aria-pressed={days===n} onClick={()=>setDays(n)}>{n} days</button>)}</div><button className="na-refresh" disabled={busy} onClick={()=>setRefresh(n=>n+1)}>Refresh</button></div>
  {busy&&<p role="status" className="na-empty">Gathering this newsletter’s activity…</p>}{error&&<p role="alert">{error}</p>}{data&&<AnalyticsSummary data={data}/>}
 </section></div>,document.body)}</>;
}
