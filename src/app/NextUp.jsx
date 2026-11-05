import React from 'react';
import {ArrowRight,CalendarDays} from 'lucide-react';
import {useCommunityContent} from '../community/CommunityContent.jsx';
import {useEasternDay} from '../community/useEasternDay.js';
import {upcomingItems} from '../community/model.js';
import {dateLabel} from '../community/calendar.js';
export default function NextUp() {
  const content=useCommunityContent(), today=useEasternDay();
  const next=upcomingItems(content,today)[0];
  const href=next?.href || (next?.kind==='exp'?content.tools.find(tool=>tool.id==='volunteer')?.href:'/app/#calendar');
  return <section className="next-up" aria-labelledby="next-up-title">
    <div className="next-up-heading"><h2 id="next-up-title">Next up</h2><a href="/app/#calendar">All dates <ArrowRight size={13} aria-hidden="true"/></a></div>
    {next?<a className="next-up-event" href={href}>
      <span className="next-up-icon"><CalendarDays size={25} aria-hidden="true"/></span>
      <span className="next-up-copy"><small>{next.start<=today?'Happening now · ':''}{dateLabel(next)}</small><strong>{next.title}</strong>{next.detail&&<span>{next.detail}</span>}<b>{next.cta || (next.kind==='exp'?'Serve at EXP':'See the calendar')} <ArrowRight size={14} aria-hidden="true"/></b></span>
    </a>:<a className="next-up-empty" href={content.calendar.source}>New dates will appear here as they’re added. View the school calendar <ArrowRight size={14}/></a>}
  </section>;
}
