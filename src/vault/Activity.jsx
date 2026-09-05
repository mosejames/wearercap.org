import { useEffect, useState } from 'react';
import { rewardCall } from './rewards.js';
import { mediaUrl } from './data.js';

export function DashboardStats({ owner, refresh }) {
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{let live=true;setData(null);setError('');rewardCall('vault_my_dashboard').then(r=>{if(live)setData(r);}).catch(()=>{if(live)setError('Your activity totals couldn’t load.');});return()=>{live=false;};},[owner,refresh,retry]);
  if(error) return <p>{error} <button className="link" onClick={()=>setRetry(n=>n+1)}>Try again</button></p>;
  if(!data) return <p role="status" className="fine">Gathering your contributions…</p>;
  const since=new Date(data.tracking_since).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/New_York'});
  return <section className="dashboard-impact" aria-labelledby="impact-title"><h2 id="impact-title">Look what you’re helping us keep.</h2><p>{data.uploads ? 'Every memory you share brings our family a little closer.' : 'Your first shared moment is the start of something special.'}</p>
    <dl className="impact-grid">{[['uploads','Shared memories'],['events','Galleries contributed to'],['likes_received','Likes received'],['comments_received','Comments received'],['views','Views received']].map(([key,label])=><div key={key}><dt>{label}</dt><dd>{data[key].toLocaleString()}</dd></div>)}</dl>
    <p className="fine">Views tracked since {since}. Earlier views aren’t available. A view is a photo or video opened in the viewer, counted once per browsing session. Your own views are excluded when we can recognize your account or device.</p>
    <div className="personal-standing"><div><b>{data.rank ? `You’re #${data.rank} among our memory makers` : 'Your place in the story is waiting'}</b><p>{data.points_to_lead===0 ? 'You’re in the lead! Thank you for showing up for our family.' : `${data.points_to_lead.toLocaleString()} more points to take the lead. Every contribution helps.`}</p><small>{data.score.toLocaleString()} all-time points · Current lead: {data.leader_score.toLocaleString()}</small></div><a href="#/community">See the leaderboard →</a></div>
  </section>;
}
export function MyActivity({ kind, owner }) {
  const [page,setPage]=useState(0);
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{let live=true;setData(null);setError('');rewardCall('vault_my_activity',{p_kind:kind,p_offset:page*20}).then(r=>{if(live)setData(r);}).catch(()=>{if(live)setError('Your activity couldn’t load.');});return()=>{live=false;};},[kind,owner,page,retry]);
  if(error) return <p>{error} <button className="link" onClick={()=>setRetry(n=>n+1)}>Try again</button></p>;
  if(!data) return <p className="empty" role="status">Loading your {kind}…</p>;
  return <section aria-label={`Your ${kind}`}><p className="fine">{data.total} {kind==='likes' ? 'memories you’ve liked' : 'comments you’ve shared'}</p>{!data.total ? <p className="empty">{kind==='likes' ? 'Find a moment you love and tap its heart. Your favorites will appear here.' : 'Leave a little love on someone’s photo. Your comments will appear here.'} <a href="#/">Explore the galleries →</a></p> : <ul className="my-activity-list">{data.items.map(r=><li key={r.id}><a href={`#/e/${r.slug}/p/${r.photo_id}`}><img src={mediaUrl({storage:r.storage,thumbKey:r.thumb_key},'thumb')} alt="" loading="lazy" /><div><b>{r.title}</b>{kind==='comments' && <p>{r.body}</p>}<small>{kind==='likes'?'Liked':'Commented'} {new Date(r.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})} · Shared by {r.uploader_name || 'an Amistad family'}</small></div></a></li>)}</ul>}
    {(page>0 || (page+1)*20<data.total) && <div className="row activity-pagination"><button className="btn small ghost" disabled={page===0} onClick={()=>setPage(n=>n-1)}>Previous</button><span>Page {page+1}</span><button className="btn small ghost" disabled={(page+1)*20>=data.total} onClick={()=>setPage(n=>n+1)}>Next</button></div>}
  </section>;
}
