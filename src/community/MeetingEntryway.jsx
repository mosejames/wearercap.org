import React, { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import './meeting-entryway.css';

export default function MeetingEntryway({ item }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (item.endsAt && now >= Date.parse(item.endsAt)) return null;

  const seconds = Math.max(0, Math.ceil((Date.parse(item.meetingStartsAt) - now) / 1000));
  const countdown = [
    ['Days', Math.floor(seconds / 86400)],
    ['Hours', Math.floor(seconds / 3600) % 24],
    ['Minutes', Math.floor(seconds / 60) % 60],
    ['Seconds', seconds % 60],
  ];

  return (
    <section className="meeting-entryway" aria-label={item.title}>
      <p className="meeting-entryway-brand">{item.kicker}</p>
      <p className="meeting-entryway-status">
        {seconds > 0 ? 'Waiting for the meeting' : 'It’s time to join'}
      </p>
      <h2>{item.title}</h2>
      <p className="meeting-entryway-detail">{item.body}</p>
      {seconds > 0 && (
        <div className="meeting-entryway-clock" role="timer" aria-label="Time until the meeting starts">
          {countdown.map(([label, value]) => (
            <div key={label}>
              <strong>{String(value).padStart(2, '0')}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      )}
      <div className="meeting-entryway-actions">
        <a href={item.href}>{item.cta} <ArrowUpRight size={18} aria-hidden="true" /></a>
        <a href={item.secondaryHref}>{item.secondaryCta} <ArrowUpRight size={18} aria-hidden="true" /></a>
      </div>
    </section>
  );
}
