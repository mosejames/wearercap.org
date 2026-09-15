import { useEffect, useState } from 'react';
import { CalendarPlus, Link as LinkIcon, X } from 'lucide-react';
import { Chip } from './Chip.jsx';

/* Replaces the sheet after a yes. Their chip, the calendar, and the private
   link, which is the only way back in from another phone. */
export default function Done({ person, calendarUrl, link, photoNote, onEdit, onClose }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('rv-locked');
    return () => document.documentElement.classList.remove('rv-locked');
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt('Your private link', link);
    }
  }

  return (
    <div className="rv-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="rv-sheet rv-done" role="dialog" aria-modal="true" aria-labelledby="rv-done-title">
        <div className="rv-sheet-grab" aria-hidden="true" />
        <button type="button" className="rv-icon-btn rv-done-x" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <ul className="rv-done-chip"><Chip person={person} you /></ul>
        <h2 id="rv-done-title">You're on the wall.</h2>
        <p>Your link to change or cancel is on its way to your email.</p>
        {photoNote && <p className="rv-failure">{photoNote}</p>}
        <div className="rv-done-actions">
          <a className="rv-cta rv-cta-block" href={calendarUrl}><CalendarPlus size={18} /> Add to calendar</a>
          <button type="button" className="rv-ghost" onClick={copy}><LinkIcon size={16} /> {copied ? 'Copied' : 'Copy your private link'}</button>
          <button type="button" className="rv-link" onClick={onEdit}>Change or cancel</button>
        </div>
      </div>
    </div>
  );
}
