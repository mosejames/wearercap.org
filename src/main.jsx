import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight,
  CalendarDays,
  Car,
  Clock,
  HeartHandshake,
  Mail,
  Megaphone,
  PlayCircle,
  Users,
  X,
} from 'lucide-react';
import './styles.css';

// Pre-launch gate. Flip to false to release the homepage; nothing else needs
// changing. Only covers the React homepage — static pages under public/ (e.g.
// /invite/) are served directly and stay reachable.
// Note: this is a visual cover, not access control. The markup still ships to
// the browser and is readable via view-source or with CSS disabled.
const COMING_SOON = false;

const contactEmail = 'hello@wearercap.org';
const contactHref = `mailto:${contactEmail}`;
const volunteerHref = 'https://www.signupgenius.com/go/60B0949A4AB29A2F94-rcaexp2#/';
const hoursHref = 'https://www.trackitforward.com/site/the-ron-clark-academy';
const youtubeEmbedUrl = 'https://www.youtube.com/embed/6UA9ZZjm66c?rel=0&modestbranding=1';
const heroPoster = '/images/rcap-video-hero.jpg';

/* ------------------------------------------------------------------------
 * EDIT ZONE — the content below changes during the year.
 * Everything in this block is plain data: no code knowledge needed beyond
 * matching the surrounding punctuation. Until the admin screens exist, this
 * is the one place to update events and open calls.
 * ---------------------------------------------------------------------- */

// Happening now — the next few real dates families can plan around.
// Keep this list SHORT (2-4 items) and CURRENT: delete dates once they pass.
const upcomingEvents = [
  { weekday: 'Fri', date: 'Jul 24, 2026', label: 'Summer EXP — educator welcome' },
  { weekday: 'Sat', date: 'Jul 25, 2026', label: 'Summer EXP — educator welcome' },
  // PLACEHOLDER — confirm after the July 24 board meeting (Agenda Item E
  // sets the year's meeting calendar; September dates below are from the
  // school calendar and should be confirmed before the gate comes off):
  { weekday: 'Thu', date: 'Sept 10, 2026', label: 'Parent Orientation' },
  { weekday: 'Tue', date: 'Sept 15, 2026', label: 'Bingo Night — season kickoff' },
];

// The single most time-sensitive ask. One item, not a list — if everything
// is urgent, nothing is. Set to null to hide the banner entirely.
const openCall = {
  label: 'Coming soon',
  title: 'Committee seats and Advisory Board nominations open for 2026-27',
  body:
    'RCAP is widening the bench this year: committee chairs, grade-level ' +
    'representatives, and more. Details land here after the board sets the ' +
    'timeline — check back, or email us to raise your hand early.',
  href: contactHref,
  linkLabel: 'Raise your hand',
};

/* ---------------------------- end edit zone --------------------------- */

// The doors — the four main things a family comes here to do. These are the
// site's top-level sections; each will grow into its own page as it firms up.
const doors = [
  {
    variant: 'carpool',
    icon: Car,
    title: 'Carpool',
    body: 'Find RCA families near you and share the driving.',
    href: '/carpool/',
    badge: 'Live',
    external: false,
  },
  {
    variant: 'serve',
    icon: HeartHandshake,
    title: 'Serve',
    body: 'Volunteer, log your hours, and step up for a committee.',
    href: '#serve',
    external: false,
  },
  {
    variant: 'events',
    icon: CalendarDays,
    title: 'Events',
    body: 'What is happening and when, all in one place.',
    href: '#events',
    external: false,
  },
  {
    variant: 'committees',
    icon: Users,
    title: 'Committees',
    body: 'The teams that carry RCAP, and the seats that are open.',
    href: '#committees',
    external: false,
  },
];

const serveActions = [
  {
    icon: HeartHandshake,
    title: 'Volunteer sign-up',
    body: 'See current needs and claim a spot when help is needed.',
    href: volunteerHref,
    label: 'Open sign-up',
    external: true,
  },
  {
    icon: Clock,
    title: 'Log volunteer hours',
    body: 'Already helped? Record your time through Track It Forward.',
    href: hoursHref,
    label: 'Log hours',
    external: true,
  },
  {
    icon: Megaphone,
    title: 'Nominate — coming soon',
    body:
      'Advisory Board grade seats and committee interest open here soon. ' +
      'Until then, email RCAP to put a name forward.',
    href: contactHref,
    label: 'Email RCAP',
    external: false,
  },
];

// Committees — the standing teams. Chairs and open seats get confirmed at the
// board's first meeting; keep descriptions evergreen so this list stays true.
const committees = [
  {
    title: 'Teacher & Staff Appreciation',
    body: 'The flagship. Teacher Appreciation Week every spring since 2011.',
  },
  {
    title: 'Men of RCAP',
    body: 'Event muscle since 2011 — setup, teardown, and showing up. Open to any man in an RCA family.',
  },
  {
    title: 'Fall Raffle',
    body: 'The engine of the budget. Beat its $20,000 goal in 2025.',
  },
  {
    title: 'Christmas / Holiday Decor',
    body: 'Transforms the whole school every November.',
  },
  {
    title: 'Uniform Swap',
    body: 'Free uniform exchanges since 2010 — the longest-running family service RCAP offers.',
  },
  {
    title: 'Concessions',
    body: 'Feeds every event and game night.',
  },
];

function VideoModal({ open, onClose }) {
  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="video-modal" role="dialog" aria-modal="true" aria-label="RCAP video">
      <button
        className="video-backdrop"
        type="button"
        onClick={onClose}
        tabIndex={-1}
        aria-hidden="true"
      />
      <div className="video-dialog">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close video">
          <X size={22} aria-hidden="true" />
        </button>
        <div className="video-frame">
          <iframe
            title="We Are RCAP video"
            src={youtubeEmbedUrl}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

function App() {
  const [isVideoOpen, setIsVideoOpen] = React.useState(false);
  const openVideo = React.useCallback(() => setIsVideoOpen(true), []);
  const closeVideo = React.useCallback(() => setIsVideoOpen(false), []);

  return (
    <main className="site-shell">
      <section className="hero" aria-label="We Are RCAP">
        <div className="hero-poster" aria-hidden="true">
          <img src={heroPoster} alt="" />
        </div>
        <div className="hero-scrim" />

        <header className="nav">
          <a className="brand" href="/">
            <span className="brand-mark">RCAP</span>
            <span>We Are RCAP</span>
          </a>
          <a className="nav-link" href={contactHref}>
            <Mail size={18} aria-hidden="true" />
            Contact
          </a>
        </header>

        <button className="hero-play-button" type="button" onClick={openVideo}>
          <span className="play-disc">
            <PlayCircle size={56} aria-hidden="true" />
          </span>
          <span>Watch the RCAP video</span>
        </button>

        <div className="hero-content">
          <p className="kicker">Ron Clark Academy Parents</p>
          <h1 aria-label="We Are RCAP">
            <span>We Are</span>
            {' '}
            <span>RCAP</span>
          </h1>
          <p className="hero-copy">
            The parent community of Ron Clark Academy, showing up for our kids,
            our school, and one another.
          </p>
          <div className="hero-actions">
            <button className="button primary" type="button" onClick={openVideo}>
              <PlayCircle size={18} aria-hidden="true" />
              Watch the RCAP video
            </button>
            <a className="button secondary" href="#doors">
              Start here
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      {/* The doors — route people, don't explain everything. */}
      <section id="doors" className="doors" aria-label="Where do you want to go?">
        {doors.map(({ variant, icon: Icon, title, body, href, badge }) => (
          <a className={`door-card ${variant}`} key={title} href={href}>
            <div className="door-top">
              <Icon size={28} aria-hidden="true" />
              {badge ? <span className="door-badge">{badge}</span> : null}
            </div>
            <h3>{title}</h3>
            <p>{body}</p>
            <span className="door-go" aria-hidden="true">
              <ArrowUpRight size={18} />
            </span>
          </a>
        ))}
      </section>

      {/* Happening now — short, current, dated. The part that must never rot. */}
      <section id="events" className="content-section events-section">
        <div className="section-heading">
          <p className="section-label">Happening Now</p>
          <h2>The next dates to plan around.</h2>
        </div>
        <div className="event-grid" aria-label="Upcoming RCAP dates">
          {upcomingEvents.map(({ weekday, date, label }) => (
            <article className="event-card" key={`${date}-${label}`}>
              <span className="event-weekday">{weekday}</span>
              <strong>{date}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>

        {openCall ? (
          <a className="open-call" href={openCall.href}>
            <span className="open-call-label">{openCall.label}</span>
            <div className="open-call-text">
              <h3>{openCall.title}</h3>
              <p>{openCall.body}</p>
            </div>
            <em>
              {openCall.linkLabel}
              <ArrowUpRight size={16} aria-hidden="true" />
            </em>
          </a>
        ) : null}
      </section>

      {/* Serve — one place for stepping up: hands, hours, and names. */}
      <section id="serve" className="content-section volunteer-section">
        <div className="section-heading">
          <p className="section-label">Serve</p>
          <h2>Step up in the way that fits.</h2>
          <p>
            Give an hour, give a season, or put a name forward — including your
            own. It all counts, and it all starts here.
          </p>
        </div>
        <div className="action-list">
          {serveActions.map(({ icon: Icon, title, body, href, label, external }) => (
            <a
              className="action-link"
              key={title}
              href={href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              <Icon size={24} aria-hidden="true" />
              <span>
                <strong>{title}</strong>
                <span>{body}</span>
              </span>
              <em>
                {label}
                <ArrowUpRight size={16} aria-hidden="true" />
              </em>
            </a>
          ))}
        </div>
      </section>

      {/* Committees — the recruitment surface. Chairs/open seats added after
          the board confirms them; descriptions stay evergreen. */}
      <section id="committees" className="content-section committees-section">
        <div className="section-heading">
          <p className="section-label">Committees</p>
          <h2>The teams that carry RCAP.</h2>
          <p>
            Sixteen years of traditions run through these committees. Chairs and
            open seats for 2026-27 will be posted here as the board confirms
            them.
          </p>
        </div>
        <div className="committee-grid" aria-label="RCAP standing committees">
          {committees.map(({ title, body }) => (
            <article className="committee-card" key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Who we are — short; the fuller story gets its own page later. */}
      <section id="community" className="community-feature">
        <div className="community-copy">
          <p className="section-label">Who We Are</p>
          <h2>Parents showing up for RCA, our kids, and each other.</h2>
          <p>
            We Are RCAP is the parent community of Ron Clark Academy — sixteen
            years of families welcoming, building, decorating, feeding, funding,
            and cheering. Every RCA parent is a member. That includes you.
          </p>
        </div>

        <div className="photo-mosaic" aria-label="RCAP parents and students">
          <img
            className="photo-large"
            src="/images/rcap-community-smiles.jpg"
            alt="RCAP parents smiling together"
          />
          <img
            className="photo-small"
            src="/images/rcap-hero-students.jpg"
            alt="Ron Clark Academy students standing together"
          />
          <img
            className="photo-small"
            src="/images/rcap-hero-volunteer.jpg"
            alt="RCAP volunteer welcoming families"
          />
          <img
            className="photo-small"
            src="/images/rcap-volunteer-hours.jpg"
            alt="RCAP volunteers reviewing materials together"
          />
        </div>
      </section>

      {/* Footer — contact now; member sign-in joins when the member area ships. */}
      <section className="closing">
        <p className="section-label">We Are RCAP</p>
        <h2>Connected families make the community stronger.</h2>
        <p>
          Questions, corrections, ideas, and ways to help are welcome. Email{' '}
          <a href={contactHref}>{contactEmail}</a>.
        </p>
        <nav className="footer-map" aria-label="Site sections">
          <a href="/carpool/">Carpool</a>
          <a href="#serve">Serve</a>
          <a href="#events">Events</a>
          <a href="#committees">Committees</a>
          <a href="/what-to-expect/">What to Expect at EXP</a>
          <a href="/wish-i-knew/">One Thing I Wish I Knew</a>
        </nav>
      </section>

      <VideoModal open={isVideoOpen} onClose={closeVideo} />
    </main>
  );
}

// "We are [reel] -> RCAP" slot-machine reveal, ported from the standalone
// we-are-rcap_1.html prototype. The reel spins through the words at constant
// velocity, then decays smoothly to rest on RCAP — one continuous motion,
// no discrete steps.
const SPIN_WORDS = [
  'Present',
  'Volunteers',
  'Support',
  'Advocates',
  'Hands',
  'Here',
  'Ready',
  'Backup',
  'Family',
  'The Village',
];
const SPIN_FINAL = 'RCAP';
const SPIN_MS = 5200; // total time from first movement to rest
const SPIN_FLURRY_END = 0.3; // fraction of SPIN_MS spent at full speed
const SPIN_REVS = 3.2; // times the list rips past before decelerating
const SPIN_HOLD_FINAL = 2200; // ms RCAP sits before the loop restarts

function SpinLine() {
  const lineRef = React.useRef(null);
  const reelRef = React.useRef(null);
  const trackRef = React.useRef(null);

  React.useEffect(() => {
    const line = lineRef.current;
    const reel = reelRef.current;
    const track = trackRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let seq = [];
    let rafId = null;
    let timerId = null;

    function build() {
      track.innerHTML = '';
      if (reduced) {
        seq = [SPIN_FINAL];
      } else {
        seq = [];
        const passes = Math.ceil(SPIN_REVS) + 1;
        for (let p = 0; p < passes; p += 1) seq.push(...SPIN_WORDS);
        seq.push(SPIN_FINAL);
      }
      seq.forEach((w, i) => {
        const el = document.createElement('span');
        el.className = 'prelaunch-word' + (i === seq.length - 1 ? ' final' : '');
        el.textContent = w;
        track.appendChild(el);
      });
    }

    function fit() {
      const REF = 100;
      line.style.fontSize = REF + 'px';
      reel.style.width = 'auto';

      let widest = 0;
      [...track.children].forEach((el) => {
        widest = Math.max(widest, el.getBoundingClientRect().width);
      });
      reel.style.width = widest + 'px';

      const lineW = line.getBoundingClientRect().width;
      const avail = window.innerWidth * 0.88;
      const availH = window.innerHeight * 0.5;

      let size = REF * (avail / lineW);
      size = Math.min(size, availH, 150);
      size = Math.max(size, 20);
      line.style.fontSize = size + 'px';

      reel.style.width = 'auto';
      let w2 = 0;
      [...track.children].forEach((el) => {
        w2 = Math.max(w2, el.getBoundingClientRect().width);
      });
      reel.style.width = w2 + 'px';
    }

    // Constant velocity through the flurry, then a cubic velocity decay to
    // zero; progress(1) === 1 so the reel rests exactly on the final word.
    function progress(t) {
      const f = SPIN_FLURRY_END;
      const decayArea = (1 - f) * 0.25;
      const total = f + decayArea;
      if (t <= f) return t / total;
      const u = (t - f) / (1 - f);
      const area = (1 - Math.pow(1 - u, 4)) / 4;
      return (f + area * (1 - f)) / total;
    }

    function run() {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      line.classList.remove('landed');

      build();
      fit();

      if (reduced) {
        line.classList.add('landed');
        return;
      }

      const step = reel.getBoundingClientRect().height;
      const dist = (seq.length - 1) * step;
      const start = performance.now() + 220;
      let landed = false;

      function frame(now) {
        const t = (now - start) / SPIN_MS;
        if (t < 0) {
          track.style.transform = 'translateY(0px)';
          rafId = requestAnimationFrame(frame);
          return;
        }
        if (t >= 1) {
          track.style.transform = 'translateY(' + -dist + 'px)';
          if (!landed) {
            landed = true;
            line.classList.add('landed');
            timerId = setTimeout(run, SPIN_HOLD_FINAL);
          }
          return;
        }
        track.style.transform = 'translateY(' + -dist * progress(t) + 'px)';
        rafId = requestAnimationFrame(frame);
      }

      rafId = requestAnimationFrame(frame);
    }

    // Background tabs suspend rAF and can report zero-width text during fit();
    // restart the cycle when the page becomes visible so neither sticks.
    function onVisible() {
      if (document.visibilityState === 'visible') run();
    }

    window.addEventListener('resize', fit);
    document.addEventListener('visibilitychange', onVisible);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(run);
    } else {
      run();
    }

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      window.removeEventListener('resize', fit);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <div className="prelaunch-line" ref={lineRef} aria-label="We are RCAP">
      <span className="prelaunch-fixed">We are</span>
      <span className="prelaunch-reel" ref={reelRef} aria-hidden="true">
        <span className="prelaunch-track" ref={trackRef} />
      </span>
    </div>
  );
}

function ComingSoonGate({ children }) {
  // inert keeps the blurred site out of the tab order and off screen readers;
  // the scale hides the blur's transparent fringe at the viewport edges.
  return (
    <div className="prelaunch">
      <div className="prelaunch-blur" inert aria-hidden="true">
        {children}
      </div>
      <div className="prelaunch-notice">
        <SpinLine />
        <p className="prelaunch-status">Coming soon</p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  COMING_SOON ? (
    <ComingSoonGate>
      <App />
    </ComingSoonGate>
  ) : (
    <App />
  ),
);
