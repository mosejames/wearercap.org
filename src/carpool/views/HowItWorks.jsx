import { useState } from 'react';

export default function HowItWorks() {
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <section className="cp-howto" aria-labelledby="cp-howto-title">
      <p className="cp-label cp-label--bar">A quick introduction</p>
      <h2 id="cp-howto-title" className="cp-h3">How it works</h2>
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
            <p>After approval, compare families and shared ride times. The map shows general areas, never home addresses. Nearby does not guarantee a match.</p>
          </div>
        </li>
        <li>
          <span className="cp-howto-number" aria-hidden="true">3</span>
          <div>
            <h3>Connect and plan</h3>
            <p>Ask to join a group, or create one once a parent volunteer enables organizer access. Creating a group does not add or invite anyone. Families connect, meet, and agree on rides themselves.</p>
          </div>
        </li>
      </ol>
      <p className="cp-howto-sharing">
        <strong>You choose to share.</strong> Before creating or requesting to join a group, you agree to share your email and phone with its members, including those the organizer accepts later. A join request must be accepted before sharing starts.{' '}
        <a href="#sharing">How sharing works</a>
      </p>
      <p className="cp-howto-note">Completely optional. Independent and parent-run, not school-sponsored. RCAP introduces families; parents arrange the rides.</p>
    </section>
  );
}
