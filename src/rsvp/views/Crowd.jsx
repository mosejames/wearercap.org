import { useState } from 'react';
import { Avatar, Chip } from './Chip.jsx';

export default function Crowd({ wall, mine, loaded, children }) {
  const [expanded, setExpanded] = useState(false);
  const visible = [...wall].sort((a, b) => Number(!!b.photo_url) - Number(!!a.photo_url)).slice(0, 6);
  return <section className="rv-section rv-crowd" aria-labelledby="crowd-title">
    <h2 className="rv-h" id="crowd-title">Who's coming</h2>
    <div className="rv-crowd-bar">
      {wall.length ? <button type="button" className="rv-crowd-toggle" aria-expanded={expanded} aria-controls="parent-crowd" onClick={() => setExpanded(!expanded)}>
        <span className="rv-avatar-stack" aria-hidden="true">{visible.map(p => <Avatar key={p.id} person={p} size={42} />)}{wall.length > visible.length && <span className="rv-crowd-more">+{wall.length - visible.length}</span>}</span>
        <span className="rv-crowd-caption">{expanded ? 'Hide names' : 'See who’s coming'}<span aria-hidden="true">{expanded ? ' −' : ' + '}</span></span>
      </button> : <p className="rv-empty">{loaded ? 'Be the first to join us.' : 'Loading the parents.'}</p>}
      {children}
    </div>
    <div id="parent-crowd" hidden={!expanded}>
      <ul className="rv-wall">{expanded && wall.map((p, i) => <Chip key={p.id} person={p} index={i} you={mine?.id === p.id} />)}</ul>
    </div>
  </section>;
}
