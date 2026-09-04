import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight,
  Camera,
  Car,
  Clock,
  Instagram,
  Lightbulb,
  MapPin,
  PlayCircle,
  Shirt,
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

const POP_SEEN = 'rcap-committee-pop';
// How long Serve stays on screen before the modal interrupts it.
const DWELL_MS = 1600;
const contactEmail = 'hello@wearercap.org';
const contactHref = `mailto:${contactEmail}`;
// Social — set a URL to turn the link on in the footer. Left null until the
// account is confirmed: the archive shows a private @RCAParents from 2023, and
// a wrong or private link is worse than no link.
const socials = [
  { icon: Instagram, label: 'Instagram', href: null },
];
const volunteerHref = 'https://www.signupgenius.com/go/60B0949A4AB29A2F94-rcaexp2#/';
const hoursHref = 'https://www.trackitforward.com/site/the-ron-clark-academy';
const youtubeEmbedUrl = 'https://www.youtube.com/embed/6UA9ZZjm66c?rel=0&modestbranding=1';
const heroImage = '/images/rcap-hero-welcome.jpg';
const videoPoster = '/images/rcap-video-hero.jpg';

// Nav — labels from the design board. Change a href here and the footer map
// keeps its own list, so the two are edited separately on purpose.
const navLinks = [
  { label: 'About', href: '#story' },
  { label: 'Events', href: '#events' },
  { label: 'Committees', href: '/committee-interest/' },
  { label: 'Volunteer', href: '#serve' },
  { label: 'Resources', href: '#tools' },
];

/* ------------------------------------------------------------------------
 * EDIT ZONE — the content below changes during the year.
 * Everything in this block is plain data: no code knowledge needed beyond
 * matching the surrounding punctuation. Until the admin screens exist, this
 * is the one place to update events and open calls.
 * ---------------------------------------------------------------------- */

// Happening now — the next few real dates families can plan around.
// Keep this list SHORT (2-4 items) and CURRENT: delete dates once they pass.
// Split into month / day / weekday so each date can be set like a calendar
// tile: banner across the top, day number large underneath. `day` may be a
// range ("24 & 25"), which the card detects and sizes down for.
const upcomingEvents = [
  { month: 'Sept', year: '2026', weekday: 'Thu', day: '10', label: 'Parent Orientation Day, 8am to 3pm' },
  { month: 'Sept', year: '2026', weekday: 'Tue', day: '15', label: 'Bingo Night, games at 5:30pm' },
  { month: 'Sept', year: '2026', weekday: 'Thu', day: '17', label: 'Open House' },
  { month: 'Sept', year: '2026', weekday: 'Thu + Fri', day: '24 & 25', label: 'RCA EXP, parent volunteers needed' },
  { month: 'Sept', year: '2026', weekday: 'Tue', day: '29', label: 'Picture Day' },
];

// The single most time-sensitive ask. One item, not a list — if everything
// is urgent, nothing is. Set to null to hide the banner entirely.
// The committee prompt. Rendered as a popup that arrives when the Serve section
// does, rather than as a banner in the flow.
const committeePop = {
  label: 'Open now',
  title: 'Explore committees',
  body: 'Nine teams carry RCAP. See which one fits, then raise your hand.',
  href: '/committee-interest/',
  linkLabel: 'Find your place',
};


/* ---------------------------- end edit zone --------------------------- */


// Tools — the apps RCAP has actually built and shipped. Each one lives under
// wearercap.org as its own page. Add a row here when a new one goes live; the
// section renders straight from this list.
const tools = [
  {
    variant: 'exchange',
    icon: Shirt,
    title: 'Uniform Exchange',
    body:
      'Ask for the sizes you need, or hold a bin for your house. Handoffs ' +
      'happen at carline, no phone numbers traded.',
    href: '/uniform-exchange/',
    badge: 'Live',
  },
  {
    variant: 'carpool',
    icon: Car,
    title: 'Carpool',
    body:
      'Find RCA families near you and share the driving. Opt-in only, and ' +
      'your address stays private.',
    href: '/carpool/',
    badge: 'Live',
  },
  {
    variant: 'committee',
    icon: Users,
    title: 'Find Your Place',
    body:
      'Answer a few questions and see which committees fit. Raise your hand ' +
      'to chair one, or just join a team.',
    href: '/committee-interest/',
    badge: 'New',
  },
  {
    variant: 'wik',
    icon: Lightbulb,
    title: 'One Thing I Wish I Knew',
    body:
      'Veteran RCA parents leave one piece of advice for the families coming ' +
      'up behind them.',
    href: '/wish-i-knew/',
    secondary: { label: 'Read what parents said', href: '/wish-i-knew/read/' },
  },
  {
    variant: 'recap',
    icon: Camera,
    title: 'The RCAP Recap',
    body:
      'Describe EXP in one word, then add the photo or video that goes with ' +
      'it. It posts straight to the board.',
    href: '/rcap-recap/',
  },
];

const serveActions = [
  {
    icon: MapPin,
    title: 'Find your place',
    body:
      'Tell us what you are into and see which committees fit. Chair one, ' +
      'or just join a team.',
    href: '/committee-interest/',
    label: 'Open the form',
    external: false,
  },
  {
    icon: Users,
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
    body: 'Event muscle since 2011. Setup, teardown, and showing up. Open to any man in an RCA family.',
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
    body: 'Free uniform exchanges since 2010, the longest-running family service RCAP offers.',
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
  const [isPopOpen, setIsPopOpen] = React.useState(false);
  const serveRef = React.useRef(null);
  const popRef = React.useRef(null);

  const closePop = React.useCallback(() => {
    setIsPopOpen(false);
    try {
      window.sessionStorage.setItem(POP_SEEN, '1');
    } catch {
      // Private mode or storage disabled. Losing the flag only means the popup
      // can arrive again on the next page load, which is survivable.
    }
  }, []);

  // Serve gets the screen to itself first. The section has to be properly in
  // view, not just edging in, and then stay there for a beat: this is a modal
  // that covers the page, so firing it the instant Serve appears would take the
  // screen away from the thing the person just arrived at.
  React.useEffect(() => {
    const node = serveRef.current;
    if (!node) return undefined;
    try {
      if (window.sessionStorage.getItem(POP_SEEN)) return undefined;
    } catch {
      // storage unavailable; fall through and let it show
    }

    let timer = null;
    let done = false;

    const settled = () => {
      const box = node.getBoundingClientRect();
      const shown = Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0);
      // Two thirds of the viewport filled by Serve, or the whole section if it
      // is shorter than the viewport.
      return shown > Math.min(window.innerHeight * 0.66, box.height * 0.9);
    };

    const check = () => {
      if (done) return;
      if (settled()) {
        if (timer === null) {
          timer = window.setTimeout(() => {
            if (done || !settled()) return;
            done = true;
            setIsPopOpen(true);
            teardown();
          }, DWELL_MS);
        }
      } else if (timer !== null) {
        // Scrolled back off before the dwell finished. Start over next time.
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(check, { threshold: [0, 0.25, 0.5, 0.75, 1] });

    function teardown() {
      if (timer !== null) window.clearTimeout(timer);
      if (observer) observer.disconnect();
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    }

    if (observer) observer.observe(node);
    // The scroll listener is the belt: it needs no compositor callback, so the
    // dwell still runs if the observer is starved of frames.
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();

    return teardown;
  }, []);

  // Now that it covers the page, it behaves like a dialog: Escape closes it,
  // focus moves in so the keyboard is not stranded behind the backdrop, and it
  // goes back where it came from on the way out.
  React.useEffect(() => {
    if (!isPopOpen) return undefined;

    const returnTo = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    popRef.current?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') {
        closePop();
        return;
      }
      if (event.key !== 'Tab' || !popRef.current) return;
      const focusables = popRef.current.querySelectorAll('button, a[href]');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      if (returnTo && typeof returnTo.focus === 'function') returnTo.focus();
    };
  }, [isPopOpen, closePop]);
  const openVideo = React.useCallback(() => setIsVideoOpen(true), []);
  const closeVideo = React.useCallback(() => setIsVideoOpen(false), []);

  return (
    <main className="site-shell">
      <section className="hero" aria-label="We Are RCAP">
        {/* Photo, scrim and lockup travel together. Above 1100px this block is
            absolutely positioned behind the copy; below it, it becomes a band
            in the flow with the copy stacked underneath on solid ink. Same
            markup, two layouts. */}
        <div className="hero-media" aria-hidden="true">
          <img className="hero-img" src={heroImage} alt="" />
          <div className="hero-scrim" />
          <div className="hero-lockup">
            <span className="lockup-script">We Are</span>
            <span className="lockup-mark">RCAP</span>
          </div>
        </div>

        <header className="nav">
          <a className="brand" href="/">
            <span className="brand-mark">RCAP</span>
            <span className="brand-sub">Ron Clark Academy Parents</span>
          </a>
          <nav className="nav-links" aria-label="Main">
            {navLinks.map(({ label, href }) => (
              <a key={label} href={href}>
                {label}
              </a>
            ))}
            <a className="nav-cta" href="/committee-interest/">
              Get Involved
            </a>
          </nav>
        </header>

        <div className="hero-content">
          <p className="kicker">Welcome to RCAP</p>
          <h1>If your child is at RCA, you are already RCAP.</h1>
          <p className="hero-copy">
            No sign-up sheet. No dues. Every Ron Clark Academy parent is a
            member the day their child walks through the door. That is the
            whole idea.
          </p>
          <p className="hero-copy">
            Sixteen years of families built this. Parents who welcomed,
            decorated, fed, funded, drove, and stayed late. First year or
            fifth, an hour or a whole season, there is a place here with your
            name on it.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/committee-interest/">
              Get involved
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <button className="button ghost" type="button" onClick={openVideo}>
              <PlayCircle size={18} aria-hidden="true" />
              Watch the video
            </button>
          </div>
        </div>

        {/* Angled edge into the paper below: two parallel cuts descending to
            the right, with a charcoal step between them. preserveAspectRatio
            none lets both lines stretch to any width and stay straight. */}
        <div className="hero-edge" aria-hidden="true">
          <svg viewBox="0 0 1440 90" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path className="edge-step" d="M0,12 L1440,50 L1440,90 L0,90 Z" />
            <path className="edge-paper" d="M0,44 L1440,82 L1440,90 L0,90 Z" />
          </svg>
        </div>
      </section>

      {/* Happening now — short, current, dated. The part that must never rot.
          Dates come off the RCA 2026-2027 calendar; delete them once they
          pass and pull the next few forward. */}
      <section id="events" className="content-section events-section">
        <div className="section-heading">
          <p className="section-label">Happening Now</p>
          <h2>The next dates to plan around.</h2>
        </div>
        <div className="event-grid" aria-label="Upcoming RCAP dates">
          {upcomingEvents.map(({ month, year, weekday, day, label }) => (
            <article
              className={`event-card${day.length > 2 ? ' is-range' : ''}`}
              key={`${month}-${day}-${label}`}
            >
              <header className="event-banner">
                <span>
                  {month} {year}
                </span>
                <span>{weekday}</span>
              </header>
              <p className="event-day">{day}</p>
              <p className="event-what">{label}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Story — where the hero's video went. A first-time parent gets the
          welcome and the next dates before the ninety-second version. */}
      <section id="story" className="content-section story-section">
        <div className="video-callout">
          <div className="video-copy">
            <p className="section-label">Who We Are</p>
            <h2>Ninety seconds on what this looks like.</h2>
            <p>
              Sixteen years of parents welcoming, building, decorating,
              feeding, funding, and cheering. Every RCA parent is a member.
              That includes you.
            </p>
          </div>

          <button className="video-card" type="button" onClick={openVideo}>
            <img src={videoPoster} alt="" />
            <span className="video-play">
              <PlayCircle size={54} aria-hidden="true" />
            </span>
            <span className="video-card-text">
              <strong>Watch the RCAP video</strong>
              <span>A minute and a half with the families behind it</span>
            </span>
          </button>
        </div>
      </section>

      {/* Serve — full width, no card. Three actions across, hairlines between. */}
      <section id="serve" className="content-section" ref={serveRef}>

        <div className="section-heading">
          <p className="section-label">Serve</p>
          <h2>Step up in the way that fits.</h2>
          <p>
            Give an hour, give a season, or put a name forward, including your
            own. It all counts, and it all starts here.
          </p>
        </div>


        <div className="serve-actions">
          {serveActions.map(({ icon: Icon, title, body, href, label, external }) => (
            <article className="serve-action" key={title}>
              <Icon size={30} strokeWidth={1.5} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{body}</p>
              <a
                className="text-link"
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {label}
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* Tools — everything RCAP has built for families, rendered from the
          `tools` list above. Each card is a whole-card link; Wish I Knew
          carries a second link to its reader on top of that. */}
      <section id="tools" className="content-section tools-section">
        <div className="section-heading">
          <p className="section-label">Tools</p>
          <h2>Built for RCA families, free to use.</h2>
          <p>
            All of these live right here on wearercap.org. Nothing to download,
            no account to make.
          </p>
        </div>
        <div className="tool-grid" aria-label="RCAP tools">
          {tools.map(({ variant, icon: Icon, title, body, href, badge, secondary }) => (
            <article className={`tool-card ${variant}`} key={title}>
              <div className="tool-top">
                <Icon size={26} aria-hidden="true" />
                {badge ? <span className="tool-badge">{badge}</span> : null}
              </div>
              <h3>
                <a href={href}>{title}</a>
              </h3>
              <p>{body}</p>
              {secondary ? (
                <a className="tool-secondary" href={secondary.href}>
                  {secondary.label}
                </a>
              ) : null}
              <span className="tool-go" aria-hidden="true">
                <ArrowUpRight size={18} />
              </span>
            </article>
          ))}
        </div>
        <nav className="tool-reads" aria-label="RCAP letters">
          <span>Also here:</span>
          <a href="/what-to-expect/">What to Expect at EXP</a>
          <a href="/invite/">Serve at EXP</a>
        </nav>
      </section>

      {/* Footer — contact, social, and the whole map of the site. */}
      <section className="closing">
        <p className="section-label">We Are RCAP</p>
        <h2>Connected families make the community stronger.</h2>
        <p>
          Questions, corrections, ideas, and ways to help are welcome. Email{' '}
          <a href={contactHref}>{contactEmail}</a>.
        </p>
        {socials.some((s) => s.href) ? (
          <nav className="footer-socials" aria-label="RCAP on social">
            {socials
              .filter((s) => s.href)
              .map(({ icon: Icon, label, href }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer">
                  <Icon size={18} aria-hidden="true" />
                  {label}
                </a>
              ))}
          </nav>
        ) : null}
        <nav className="footer-map" aria-label="Site sections">
          <a href="#story">Who We Are</a>
          <a href="#events">Events</a>
          <a href="#serve">Serve</a>
          <a href="#tools">Tools</a>
          <a href="/uniform-exchange/">Uniform Exchange</a>
          <a href="/carpool/">Carpool</a>
          <a href="/committee-interest/">Find Your Place</a>
          <a href="/wish-i-knew/">One Thing I Wish I Knew</a>
          <a href="/rcap-recap/">The RCAP Recap</a>
          <a href="/what-to-expect/">What to Expect at EXP</a>
          <a href="/invite/">Serve at EXP</a>
        </nav>
      </section>

      {isPopOpen ? (
        <div className="pop-scrim">
          <button className="pop-backdrop" type="button" onClick={closePop} aria-label="Close" />
          <aside
            className="committee-pop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="committee-pop-title"
            tabIndex={-1}
            ref={popRef}
          >
            <button className="pop-close" type="button" onClick={closePop} aria-label="Close">
              <X size={18} aria-hidden="true" />
            </button>
            <p className="pop-label">{committeePop.label}</p>
            <h2 id="committee-pop-title">{committeePop.title}</h2>
            <p className="pop-body">{committeePop.body}</p>

            <ul className="pop-pills">
              {committees.map(({ title }) => (
                <li key={title}>{title}</li>
              ))}
              <li className="pop-pill-more">and more</li>
            </ul>

            <div className="pop-actions">
              <a className="pop-go" href={committeePop.href}>
                {committeePop.linkLabel}
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
              <button className="pop-dismiss" type="button" onClick={closePop}>
                Not now
              </button>
            </div>
          </aside>
        </div>
      ) : null}

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
