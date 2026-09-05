import { createContext, useContext, useEffect, useState } from 'react';
import { BadgeIcon } from './BadgeIcon.jsx';
import { todayISO } from './config.js';
import { avatarUrl, badgeName, MILESTONES, monthNow, rewardCall } from './rewards.js';

export const AvatarContext = createContext({ keys:{}, version:0 });
export function Avatar({ owner, name, large = false, photo, hidePhoto = false }) {
  const { keys, version, badges = {} } = useContext(AvatarContext);
  const src = hidePhoto ? null : photo || avatarUrl(keys[owner]);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src, version]);
  return <span className="avatar-with-badge"><span className={`avatar${large ? ' lg' : ''}`}>{src && !broken ? <img src={`${src}${src.includes('?') ? '&' : '?'}v=${version}`} alt="" onError={() => setBroken(true)} /> : (name || '?').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase()}</span>{badges[owner] && <span className="avatar-merit" title={`${badgeName(badges[owner])} · ${badges[owner]} photos shared`}><BadgeIcon milestone={badges[owner]} /></span>}</span>;
}
export function BadgeShelf({ owner, refresh = 0 }) {
  const [rewards, setRewards] = useState(null);
  useEffect(() => { let live=true; if(owner) rewardCall('vault_my_rewards').then(r=>{if(live)setRewards(r);}).catch(()=>{}); return()=>{live=false;}; },[owner,refresh]);
  if(!rewards) return null;
  const next = MILESTONES.find(n => n > rewards.photos && !rewards.badges.includes(n));
  return <section className="badge-shelf"><h2>Your memory badges</h2><p className="badge-intro">Small badges. A whole lot of love. Each one celebrates the photos you’ve shared with our family.</p>
    <div className="merit-collection">{MILESTONES.map(n=><div className={`merit-card${rewards.badges.includes(n)?' earned':' locked'}`} key={n}><BadgeIcon milestone={n} locked={!rewards.badges.includes(n)} /><b>{badgeName(n)}</b><span>{n} photos shared</span><small>{rewards.badges.includes(n)?'Earned ✓':'Still to come'}</small></div>)}</div>
    {next && <div className="merit-progress"><label htmlFor="next-merit">{Math.max(0,next-rewards.photos)} more photos to {badgeName(next)}</label><progress id="next-merit" value={Math.min(rewards.photos,next)} max={next} /><span>{rewards.photos} / {next} photos</span></div>}
    <details className="badge-rules"><summary>How your badges work</summary><p>Earn Memory maker at 10 photos, Moment keeper at 50, House storyteller at 100, Friendship champion at 250, and Vault legend at 500. Photos count across all your galleries, including older uploads linked to your account.</p><p>Your highest earned badge appears beside your profile photo or initials. Badges stay yours once earned. Hidden or removed photos don’t count toward your next badge. Videos earn leaderboard points; these badges celebrate photos.</p></details>
  </section>;
}
export function BadgeCelebration({ milestones, onClose }) {
  if(!milestones?.length) return null;
  return <aside className="badge-celebration" role="status"><button className="icon-btn" aria-label="Dismiss badge celebration" onClick={onClose}>×</button><div className="celebration-patch"><BadgeIcon milestone={milestones.at(-1)} /></div><small className="eyebrow">New badge earned</small><b>{badgeName(milestones.at(-1))}!</b><p>{milestones.join(', ')} photos shared. Look at all the memories you’re helping our family keep.</p><a href="#/me" onClick={onClose}>See your badges →</a></aside>;
}
export function CommunityPage({ events, eventId = '', owner, rewardVersion }) {
  const eligible = events.filter(e=>e.startsOn<=todayISO() || e.photoCount>0).sort((a,b)=>b.startsOn.localeCompare(a.startsOn));
  useEffect(()=>{document.title='Memory makers · The Amistad Vault';},[]);
  const [scope,setScope] = useState(eventId ? 'event' : 'all');
  const [month,setMonth] = useState(monthNow);
  const [event,setEvent] = useState(eventId || eligible[0]?.id || '');
  const [rows,setRows] = useState(null);
  const [err,setErr] = useState('');
  const [retry,setRetry] = useState(0);
  useEffect(()=>{ let live=true;setRows(null);setErr('');
    if(scope==='event' && !event) {setRows([]);return;}
    rewardCall('vault_contributors',{p_month:scope==='month' ? `${month}-01` : null,p_event:scope==='event' ? event : null}).then(r=>{if(live)setRows(r);}).catch(e=>{if(live)setErr(e.message);});
    return()=>{live=false;};
  },[scope,month,event,retry]);
  return <main className="shell page community-page"><span className="eyebrow">Our family, showing up</span><h1>Memory makers</h1><p>Behind every memory is someone who shared it. Let’s celebrate the people keeping our story together.</p>
    <div className="community-filters"><div className="community-tabs" aria-label="Leaderboard period">{[['all','All time'],['month','By month'],['event','By event']].map(([key,label])=><button key={key} className={scope===key?'selected':''} aria-pressed={scope===key} onClick={()=>setScope(key)}>{label}</button>)}</div>
    {scope==='month' && <label className="field"><span>Month</span><input type="month" value={month} max={monthNow()} onChange={e=>{if(e.target.value)setMonth(e.target.value);}} /></label>}
    {scope==='event' && <label className="field"><span>Event</span><select value={event} onChange={e=>setEvent(e.target.value)}><option value="">Choose an event</option>{eligible.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label>}</div>
    {err ? <p className="err">{err} <button className="btn small" onClick={()=>setRetry(x=>x+1)}>Try again</button></p> : rows===null ? <p className="empty">Gathering the memories…</p> : rows.length===0 ? <p className="empty">The first memory maker could be you. Share a moment from this {scope==='event'?'event':'period'} to get things started.</p> : <ol className="leaderboard">{rows.map(r=><li key={r.owner} className={r.owner===owner?'is-you':''}><span className="leader-rank">{r.rank}</span><Avatar owner={r.owner} name={r.display_name} /><div className="leader-person"><b>{r.display_name}{r.owner===owner?' · You':''}</b><small>{r.uploads} {r.uploads===1?'upload':'uploads'} · {r.events} {r.events===1?'event':'events'} · {r.interactions} interactions</small></div><strong className="leader-score">{r.score}<small>points</small></strong></li>)}</ol>}
    <details className="score-explainer"><summary>How we celebrate contributions</summary><p>Each shared photo or video earns 5 points, plus 10 points for each different gallery you contribute to. A like on someone else’s upload earns 1 point; a comment earns 2. Only one like and one comment per person per upload count. Engagement adds up to 100 points in each selected view.</p><p>Monthly rankings follow the date you shared or engaged, in Eastern Time. Hidden and removed uploads, hidden comments, and banned contributors don’t count. Tied scores share the same rank.</p><p>Photo badges celebrate 10, 50, 100, 250, and 500 shared photos. Videos earn leaderboard points too. Your display name and optional profile photo appear here; your phone number stays private.</p></details>
    {owner && <BadgeShelf owner={owner} refresh={rewardVersion} />}
  </main>;
}
