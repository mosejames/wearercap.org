import React, {useEffect, useState} from 'react';
import {ArrowUpRight, CalendarDays} from 'lucide-react';
import {CALENDAR_SOURCE, CALENDAR_EDITION, easternToday, upcomingMonths, monthLabel, dateLabel} from './calendar.js';

export function useEasternDay() {
  const [today,setToday] = useState(easternToday);
  useEffect(() => {
    const update = () => setToday(easternToday());
    const interval = window.setInterval(update, 60000);
    window.addEventListener('focus',update);
    document.addEventListener('visibilitychange',update);
    return () => {window.clearInterval(interval);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);};
  }, []);
  return today;
}

export default function Calendar() {
  const today = useEasternDay();
  const months = upcomingMonths(today);
  return <div className="calendar-screen">
    <div className="calendar-note"><CalendarDays size={22} aria-hidden="true"/><p>Just what’s ahead.<span>Past dates leave this list automatically. Dates follow Atlanta time.</span></p></div>
    <a className="calendar-original" href={CALENDAR_SOURCE} target="_blank" rel="noopener noreferrer">Full school calendar <ArrowUpRight size={17} aria-hidden="true"/></a>
    {months.length ? months.map(({month,items},index) => <section className="calendar-month" key={month} aria-labelledby={`month-${month}`}>
      <div className="month-heading"><h2 id={`month-${month}`}>{monthLabel(month)}</h2>{index===0&&<span>UP NEXT</span>}</div>
      <ol>{items.map(item => {
        const happening = item.start <= today;
        return <li key={`${item.start}-${item.title}`} className={happening?'happening':''}>
          <div className="calendar-when"><time dateTime={item.start}>{dateLabel(item)}</time>{happening&&<span>{item.start===item.end?'Today':'Happening now'}</span>}</div>
          <div className="calendar-what"><h3>{item.title}</h3>{item.detail&&<p>{item.detail}</p>}{item.kind==='exp'&&<a href="/invite/">Serve at EXP <ArrowUpRight size={13} aria-hidden="true"/></a>}</div>
        </li>;
      })}</ol>
    </section>) : <div className="empty"><h2>You’re all caught up.</h2><p>No upcoming dates remain in this calendar. Check the full school calendar for the next edition.</p></div>}
    <p className="calendar-source">From the {CALENDAR_EDITION}. School updates may change these dates. Check RCA’s latest notices for changes.</p>
  </div>;
}
