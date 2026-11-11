import { useState } from 'react';
import { readStoredOpen, writeStoredOpen } from './Collapsible.jsx';

export default function HowItWorks() {
  const [videoOpen, setVideoOpen] = useState(false);
  // Collapsed by default (Mose, 2026-11-10) so the signup form sits higher.
  // The choice survives the app's in-session remounts, like other sections.
  const [open, setOpen] = useState(() => readStoredOpen('howto', false));
  const toggle = () => setOpen((prev) => { writeStoredOpen('howto', !prev); return !prev; });

  return (
    <section className={`cp-howto${open ? '' : ' cp-howto--closed'}`} aria-labelledby="cp-howto-title">
      <h2 className="cp-howto-heading" id="cp-howto-title">
        <button type="button" className="cp-howto-toggle" aria-expanded={open} aria-controls="cp-howto-body" onClick={toggle}>
          <span className="cp-howto-toggle-text">
            <span className="cp-label cp-label--bar">A quick introduction</span>
            <span className="cp-h3">How it works</span>
          </span>
          <span className={`cp-collapse-chevron${open ? ' cp-collapse-chevron--open' : ''}`} aria-hidden="true">
            <svg viewBox="0 0 20 20" width="18" height="18" focusable="false">
              <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </h2>
      <div id="cp-howto-body" hidden={!open}>
      <p className="cp-howto-intro">Three steps, at your own pace. Watch the guide or read below.</p>
      <button type="button" className="cp-btn cp-btn--dark cp-btn--block cp-howto-watch"
        aria-expanded={videoOpen} aria-controls="cp-howto-video"
        onClick={() => setVideoOpen((open) => !open)}>
        <span aria-hidden="true">{videoOpen ? '−' : '▶'}</span>
        {videoOpen ? 'Close video' : 'Watch the 55-second guide'}
      </button>
      <div id="cp-howto-video" hidden={!videoOpen}>
        {/* Mount on demand so the guide never downloads during signup.
            Unmounting also stops playback when a parent closes it. */}
        {videoOpen && (
          <div className="cp-howto-player">
            <video controls playsInline preload="none"
              poster="/carpool/media/how-it-works-v1.jpg"
              aria-label="RCAP Carpool: three steps in 55 seconds">
              <source src="/carpool/media/how-it-works-v1.mp4" type="video/mp4" />
              <track kind="captions" src="/carpool/media/how-it-works-v1.vtt" srcLang="en" label="English" />
              Your browser cannot play this video. Read the three steps below instead.
            </video>
            <p className="cp-help">55 seconds. Captions included in the video.</p>
            <a className="cp-howto-video-link" href="/carpool/media/how-it-works-v1.mp4">Open the video on its own</a>
          </div>
        )}
      </div>
      <ol className="cp-howto-steps">
        <li>
          <span className="cp-howto-number" aria-hidden="true">1</span>
          <div>
            <h3>Add your family</h3>
            <p>Add your family, a location, and the days and rides you need. Use Google sign-in or verify your email, then wait for approval.</p>
          </div>
        </li>
        <li>
          <span className="cp-howto-number" aria-hidden="true">2</span>
          <div>
            <h3>Find nearby families</h3>
            <p>See families near you who drive some of the same days. You see their general area, never a name or address.</p>
          </div>
        </li>
        <li>
          <span className="cp-howto-number" aria-hidden="true">3</span>
          <div>
            <h3>Say you're interested</h3>
            <p>Tap I'm interested on any family. They only find out if they say yes too. Then you both get an email, see each other's contact, and plan the rides together.</p>
          </div>
        </li>
      </ol>
      <p className="cp-howto-sharing">
        <strong>You choose to share.</strong> Your name and contact stay private until you and another family both say yes. Then only that family sees them.{' '}
        <a href="#sharing">How sharing works</a>
      </p>
      <p className="cp-howto-note">Completely optional. Independent and parent-run, not school-sponsored. RCAP introduces families; parents arrange the rides.</p>
      </div>
    </section>
  );
}
