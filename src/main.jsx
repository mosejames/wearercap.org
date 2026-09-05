import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight,
  ArrowUpRight,
  Camera,
  Car,
  Clock,
  Instagram,
  Lightbulb,
  Mail,
  MapPin,
  PlayCircle,
  Shirt,
  Users,
  X,
} from 'lucide-react';
import { COMMITTEES } from './committee/data.js';
import './styles.css';

// Pulled straight from the Find Your Place data so the two can never drift.
// Editing src/committee/data.js updates the pills, the count, and the form.
const committeeNames = COMMITTEES.map((c) => c.name);

// Pre-launch gate. Flip to false to release the homepage; nothing else needs
// changing. Only covers the React homepage — static pages under public/ (e.g.
// /invite/) are served directly and stay reachable.
// Note: this is a visual cover, not access control. The markup still ships to
// the browser and is readable via view-source or with CSS disabled.
const COMING_SOON = false;

// Entry gate. Flip to true to put the question in front of the homepage.
//
// READ THIS BEFORE RELYING ON IT. This is a front door, not a lock. The answers
// are in the JavaScript bundle, the gate is bypassed by disabling JS, and it
// only wraps the React homepage: /carpool/, /uniform-exchange/,
// /committee-interest/, /wish-i-knew/, /rcap-recap/, /invite/ and
// /what-to-expect/ are separate entry points that never see it. Anything that
// has to be genuinely private needs protection at the server, not here.
const GATE_ENABLED = true;
const GATE_KEY = 'rcap-entry';
const GATE_SECONDS = 10;

// Typed answers, not multiple choice. Four options gave a stranger a one in four
// shot per try, and the retry loop meant they could just keep clicking. A typed
// answer with an accept list makes guessing impractical without making it
// harder for anyone who actually knows the place.
//
// `accept` is matched after normalising: lowercased, accents stripped,
// punctuation dropped, whitespace collapsed. So "Margaret St." and "margaret"
// both pass. Add spellings generously; the cost of a wrong rejection is a
// locked-out parent, and the cost of a loose accept is nearly nothing.
const GATE_QUESTIONS = [
  {
    ask: 'What street does RCA sit on?',
    accept: ['margaret', 'margaret st', 'margaret street', 'margaret st se'],
  },
  {
    ask: 'What reality show was Ron Clark on?',
    accept: ['survivor'],
  },
  {
    ask: 'Name one of the two ladies at the front desk.',
    // Staff names date. If either of them moves on, edit this row or drop it.
    accept: ['stacy', 'stacey', 'leah', 'lea'],
  },
  {
    ask: 'What year did the school open?',
    accept: ['2007', '07'],
  },
  {
    ask: 'What does Mr. Bonner call his classroom?',
    accept: ['bonnerville', 'bonner ville'],
  },
  {
    ask: 'How many Collins work at the school?',
    accept: ['4', 'four'],
  },
  {
    ask: 'What is the school\'s weekly note to families called?',
    accept: ['in the loop', 'the loop', 'loop'],
  },
  {
    ask: 'Name one of the four houses.',
    accept: [
      'amistad', 'ami',
      'isibindi', 'bindi',
      'altruismo', 'rismo',
      'reveur', 're',
    ],
  },
  {
    ask: 'What are the two-day educator conferences at RCA called?',
    accept: ['exp', 'rca exp', 'the exp'],
  },
];

// Normalise before comparing so spelling, case, accents and stray punctuation
// never stand between a parent and the front door.
function normaliseAnswer(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}



// Next time the RCAP Recap vault opens for submissions. Local time, which is
// what a parent in Atlanta is reading it in.
// Next vault opening. 09:00 on 2026-09-10 in New York; the offset is -04:00
// because Eastern is still on daylight time in September.
const VAULT_OPENS = new Date('2026-09-10T09:00:00-04:00');
const ROLL_MS = 420;
const contactEmail = 'hello@wearercap.org';
const contactHref = `mailto:${contactEmail}`;
const socials = [
  { icon: Instagram, label: '@rcaparents', href: 'https://www.instagram.com/rcaparents/' },
];
// The RCA calendar PDF as released. It predates the July 31 and Aug 30
// reconciliations, so the Google Calendar is the fresher source.
const calendarHref = '/rca-calendar-2026-2027.pdf';
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
  { label: 'EXP', href: '#exp' },
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
  { month: 'Sept', year: '2026', weekday: 'Thu', day: '10', label: 'Parent Orientation Day', time: '8am to 3pm', description: 'A new year. Familiar faces. A whole community to meet.', image: '/images/rcap-community-table.jpg' },
  { month: 'Sept', year: '2026', weekday: 'Tue', day: '15', label: 'Bingo Night, games at 5:30pm' },
  { month: 'Sept', year: '2026', weekday: 'Thu', day: '17', label: 'Open House' },
  { month: 'Sept', year: '2026', weekday: 'Thu + Fri', day: '24 & 25', label: 'RCA EXP, parent volunteers needed' },
  { month: 'Sept', year: '2026', weekday: 'Tue', day: '29', label: 'Picture Day' },
];

// The single most time-sensitive ask. One item, not a list — if everything
// is urgent, nothing is. Set to null to hide the banner entirely.
const POP_SEEN = 'rcap-committee-pop';
// Beat between reaching Serve and the modal arriving. Long enough to read the
// heading, short enough that it never feels like waiting.
const DWELL_MS = 900;

// The committee invitation lives in the Serve section.
const committeePop = {
  label: 'Open now',
  title: 'Explore committees',
  body: 'Parent committees are how we support the school. See where you fit, then raise your hand.',
  href: '/committee-interest/',
  linkLabel: 'Find your place',
};

/* ---------------------------- end edit zone --------------------------- */

// Tools — the apps RCAP has actually built and shipped. Each one lives under
// wearercap.org as its own page. Add a row here when a new one goes live; the
// section renders straight from this list.
const tools = [
  {
    variant: 'committee',
    icon: Users,
    title: 'Find Your Place',
    body:
      'Tell us your committee interests and see where you fit. Raise your ' +
      'hand to chair one, or just join in.',
    href: '/committee-interest/',
    badge: 'New',
    action: 'Open the form',
  },
  {
    variant: 'exchange',
    icon: Shirt,
    title: 'Uniform Exchange',
    body:
      'Uniforms that grow with you. Gently loved pieces passed from one RCA ' +
      'family to the next.',
    href: '/uniform-exchange/',
    badge: 'Live',
    action: 'Open exchange',
  },
  {
    variant: 'carpool',
    icon: Car,
    title: 'Carpool',
    body:
      'Only if it helps. If you drive in from a way out and would rather share ' +
      'the trip, find families near you. Your address stays private.',
    href: '/carpool/',
    badge: 'Live',
    action: 'Find a ride',
  },
  {
    variant: 'wik',
    icon: Lightbulb,
    title: 'One Thing I Wish I Knew',
    body:
      'RCA is a big place and learning it takes a minute. See what other ' +
      'parents have shared, and add a best practice of your own.',
    href: '/wish-i-knew/',
    // The only row whose action goes somewhere other than the row itself.
    action: 'Read what parents said',
    actionHref: '/wish-i-knew/read/',
  },
  {
    variant: 'recap',
    icon: Camera,
    title: 'The RCAP Recap',
    body:
      'After a big day, the vault opens and everyone drops in their photos ' +
      'and their one word. Right now you are looking at the last one.',
    href: '/rcap-recap/',
    action: 'See the last vault',
    countdown: VAULT_OPENS,
  },
];


// The 2026-27 EXP schedule, straight off the RCA calendar. Every session runs a
// Thursday and a Friday. Delete a row once it has passed.
// This semester only. The spring sessions live on the schedule page, which the
// second card points at, so the chips stay a short list of what is actually
// close enough to plan around.
const expDates = [
  { label: 'Sept 24 & 25', next: true },
  { label: 'Nov 5 & 6' },
  { label: 'Nov 19 & 20' },
  { label: 'Dec 10 & 11' },
];

const expActions = [
  {
    image: '/images/rcap-exp-day.jpg',
    alt: 'An RCAP parent in an XPERTS shirt leading visitors through the building',
    title: 'See what a day looks like',
    body: 'The posts, the energy, the people. Our recap from a recent EXP.',
    href: '/what-to-expect/',
    label: 'Read the recap',
    external: false,
  },
  {
    image: '/images/rcap-exp-schedule.jpg',
    alt: 'Two RCAP dads walking the courtyard during EXP',
    title: 'The whole schedule',
    body: 'All ten sessions, what each post involves, and the other weeks the building fills up.',
    href: '/invite/',
    label: 'See the year',
    external: false,
  },
  {
    image: '/images/rcap-exp-shift.jpg',
    alt: 'An RCAP parent carrying a stack of folding chairs in the gym',
    title: 'Take a shift',
    body: 'Grab a spot on SignUpGenius. Shifts for the later sessions post closer to the date.',
    href: volunteerHref,
    label: 'Sign up',
    external: true,
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

// Committees — the standing committees. Chairs and open seats get confirmed at the
// board's first meeting; keep descriptions evergreen so this list stays true.

// A single digit in a masked window, borrowed from the prelaunch reel: fixed
// height, overflow hidden, and the glyph slides through it. The counter only
// ever runs down, so the old digit leaves through the bottom and the new one
// arrives from the top, wraps included.
function RollDigit({ value }) {
  const [shown, setShown] = React.useState(value);

  React.useEffect(() => {
    if (shown === value) return undefined;
    const id = window.setTimeout(() => setShown(value), ROLL_MS);
    return () => window.clearTimeout(id);
  }, [value, shown]);

  const rolling = shown !== value;

  return (
    <span className="roll">
      {rolling ? <span className="roll-out">{shown}</span> : null}
      <span className={rolling ? 'roll-in' : undefined} key={value}>
        {value}
      </span>
    </span>
  );
}

function RollPair({ value, label }) {
  const pair = String(Math.min(value, 99)).padStart(2, '0');
  return (
    <span className="vault-unit">
      <span className="vault-digits">
        <RollDigit value={Number(pair[0])} />
        <RollDigit value={Number(pair[1])} />
      </span>
      <span className="vault-label">{label}</span>
    </span>
  );
}

// Live countdown to the next vault opening. Recomputed from the target on every
// tick rather than decremented, so a throttled background tab or a sleeping
// laptop cannot make it drift. Renders nothing once the date has passed, so a
// stale constant degrades to silence rather than to a row of zeros.
// Locking the page behind a modal. `overflow: hidden` on body is enough on a
// desktop browser and does nothing on iOS Safari: the page keeps scrolling
// underneath, which also collapses the toolbars, which resizes the visual
// viewport, which slides the fixed panel around. Pinning body with position
// fixed at its current offset is the technique that actually holds, so long as
// the scroll position is put back on the way out.
function lockScroll() {
  const body = document.body;
  const before = {
    overflow: body.style.overflow,
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
  };
  const y = window.scrollY;

  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${y}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';

  return function unlock() {
    Object.assign(body.style, before);
    // Restoring position removes the offset, so the page jumps to the top
    // unless it is put back in the same frame.
    window.scrollTo(0, y);
  };
}

function VaultCountdown({ opensAt }) {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const left = opensAt.getTime() - now;
  if (left <= 0) return null;

  const days = Math.floor(left / 86400000);
  const hours = Math.floor((left % 86400000) / 3600000);
  const mins = Math.floor((left % 3600000) / 60000);
  const secs = Math.floor((left % 60000) / 1000);

  // Pinned to New York so every parent reads the same clock, wherever they are.
  const opens = opensAt.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="vault-countdown">
      <p className="vault-when">Vault opens {opens} ET</p>
      <p className="vault-clock" aria-label={`${days} days, ${hours} hours, ${mins} minutes, ${secs} seconds until the vault opens`}>
        <RollPair value={days} label="days" />
        <RollPair value={hours} label="hrs" />
        <RollPair value={mins} label="min" />
        <RollPair value={secs} label="sec" />
      </p>
    </div>
  );
}

function VideoModal({ open, onClose }) {
  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    const unlock = lockScroll();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unlock();
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

  // Serve gets the screen first, then the modal follows shortly after. The
  // arming test is just "you have reached Serve": its top has come above the
  // middle of the viewport. Once armed the timer is not cancelled, so scrolling
  // onward does not strand the modal and nobody has to sit still waiting.
  React.useEffect(() => {
    const node = serveRef.current;
    if (!node) return undefined;
    try {
      if (window.sessionStorage.getItem(POP_SEEN)) return undefined;
    } catch {
      // storage unavailable; fall through and let it show
    }

    let timer = null;
    let observer = null;

    const teardown = () => {
      if (observer) observer.disconnect();
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };

    function check() {
      if (timer !== null) return;
      const box = node.getBoundingClientRect();
      if (box.top > window.innerHeight * 0.55 || box.bottom <= 0) return;
      teardown();
      timer = window.setTimeout(() => setIsPopOpen(true), DWELL_MS);
    }

    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(check, { threshold: [0, 0.2, 0.5] });
      observer.observe(node);
    }
    // The scroll listener is the belt: it needs no compositor callback.
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      teardown();
    };
  }, []);

  // Now that it covers the page, it behaves like a dialog: Escape closes it,
  // focus moves in so the keyboard is not stranded behind the backdrop, and it
  // goes back where it came from on the way out.
  React.useEffect(() => {
    if (!isPopOpen) return undefined;

    const returnTo = document.activeElement;
    const unlock = lockScroll();
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
      unlock();
      window.removeEventListener('keydown', onKey);
      if (returnTo && typeof returnTo.focus === 'function') returnTo.focus();
    };
  }, [isPopOpen, closePop]);
  const openVideo = React.useCallback(() => setIsVideoOpen(true), []);
  const closeVideo = React.useCallback(() => setIsVideoOpen(false), []);

  return (
    <main className="site-shell homepage-refresh">
      <section className="hero" aria-label="We Are RCAP">
        {/* Photo, scrim and edge travel together. Above 1100px this block is
            absolutely positioned behind the copy; below it, it becomes a band
            in the flow with the copy stacked underneath on solid ink. Same
            markup, two layouts. */}
        <div className="hero-media" aria-hidden="true">
          <img className="hero-img" src={heroImage} alt="" />
          <div className="hero-scrim" />
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
          <h1>If your child is at RCA,<br /> you are already <span>RCAP.</span></h1>
          <p className="hero-copy">
            First year or fifth, an hour or a whole season. There is a place
            here with your name on it.
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

        {/* Single diagonal into the paper below. */}
        <div className="hero-edge" aria-hidden="true">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <path className="edge-paper" d="M0,22 L1440,60 L1440,60 L0,60 Z" />
          </svg>
        </div>
      </section>

      {/* Happening now — short, current, dated. The part that must never rot.
          Dates come off the RCA 2026-2027 calendar; delete them once they
          pass and pull the next few forward. */}
      <section id="events" className="content-section events-section">
        <div className="section-heading">
          <p className="section-label">Happening Now</p>
          <h2>Make room for a little RCA.</h2>
          <p>Come connect, cheer someone on, or lend a hand. Here is what is next.</p>
          <a className="text-link heading-link" href={calendarHref} target="_blank" rel="noopener noreferrer">
            Open the full school calendar
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        </div>
        <article className="featured-event">
          <div className="featured-event-photo">
            <img src={upcomingEvents[0].image} alt="Parents gathered at RCA" loading="lazy" width="1800" height="1200" />
            <span className="featured-event-tag">Next on the calendar</span>
          </div>
          <div className="featured-event-copy">
            <p className="section-label">{upcomingEvents[0].weekday}, {upcomingEvents[0].month} {upcomingEvents[0].day} · {upcomingEvents[0].year}</p>
            <h3>{upcomingEvents[0].label}</h3>
            <p className="featured-event-time"><Clock size={18} aria-hidden="true" />{upcomingEvents[0].time}</p>
            <p>{upcomingEvents[0].description}</p>
            <a className="button primary" href={calendarHref} target="_blank" rel="noopener noreferrer">View school calendar <ArrowUpRight size={18} aria-hidden="true" /></a>
          </div>
        </article>
        <div className="event-grid" aria-label="More upcoming RCAP dates">
          {upcomingEvents.slice(1).map(({ month, year, weekday, day, label }) => (
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
      <section id="story" className="content-section band story-section">
        <div className="video-callout">
          <div className="video-copy">
            <p className="section-label">We Are The Support</p>
            <h2>Nothing here is done halfway. That includes us.</h2>
            <p>
              RCA builds experiences most schools never attempt, and the bar
              never drops. Parents are the support underneath all of it. We
              welcome the visitors, feed the teachers, decorate the halls,
              raise the money, and fill the seats.
            </p>
            <p>
              Here is why we do it, from the parents doing it.
            </p>
          </div>

          <button className="video-card" type="button" onClick={openVideo}>
            <img src={videoPoster} alt="" />
            <span className="video-play">
              <PlayCircle size={54} aria-hidden="true" />
            </span>
            <span className="video-card-text">
              <strong>Hear it from RCA parents</strong>
              <span>Why we show up, in their own words</span>
            </span>
          </button>
        </div>
      </section>

      {/* Serve — full width, no card. Three actions across, hairlines between. */}
      <section id="serve" className="content-section band serve-band" ref={serveRef}>

        <div className="section-heading">
          <p className="section-label">We Are Here To Serve</p>
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

      {/* EXP — its own section, directly after Serve, so the volunteer thread
          runs general then specific. It used to be two links in the tail of
          Tools, which is the wrong shape for the biggest repeat ask RCAP makes.
          The ten dates sit on the page rather than behind a control: seeing the
          whole year at once is the argument. */}
      <section id="exp" className="content-section band exp-band">
        <div className="section-heading">
          <p className="section-label">We Are The Welcome</p>
          <h2>Ten times a year, the world comes to RCA.</h2>
          <p>
            EXP is the Ron Clark Academy Experience. Educators fly in from all
            over to watch our teachers and our kids work, and parents are the
            first people they meet. This is where you show up and show out.
          </p>
        </div>

        <p className="exp-dates-title">What is coming up this semester</p>
        <ul className="exp-dates" aria-label="EXP sessions this semester">
          {expDates.map(({ label, next }) => (
            <li className={next ? 'is-next' : undefined} key={label}>
              {label}
              {next ? <span className="exp-next">Next</span> : null}
            </li>
          ))}
        </ul>

        <div className="serve-actions">
          {expActions.map(({ image, alt, title, body, href, label, external }) => (
            <article className="serve-action" key={title}>
              <img className="exp-shot" src={image} alt={alt} loading="lazy" width="1000" height="667" />
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

      {/* Tools — a numbered list rather than a grid of cards. Each row is a
          whole-row link to the tool; the action link on the right sits above
          that stretched link, which matters for Wish I Knew, the one row whose
          action points somewhere else. */}
      <section id="tools" className="content-section">
        <div className="section-heading">
          <p className="section-label">We Are The Builders</p>
          <h2>Built for RCA families. Pick what you need.</h2>
          <p>
            Things to make our community stronger and, hopefully, your life a
            little easier.
          </p>
        </div>

        <ol className="tool-list">
          {tools.map(({ variant, icon: Icon, title, body, href, badge, action, actionHref, countdown }, index) => (
            <li className={`tool-row ${variant}`} key={title}>
              <span className="tool-num" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>

              <span className="tool-name">
                {badge ? (
                  <span className="tool-badge">{badge}</span>
                ) : (
                  <Icon className="tool-icon" size={26} strokeWidth={1.6} aria-hidden="true" />
                )}
                <h3>
                  <a href={href}>{title}</a>
                </h3>
                <ArrowRight className="tool-arrow" size={26} aria-hidden="true" />
              </span>

              <span className="tool-detail">
                <p>{body}</p>
                {countdown ? <VaultCountdown opensAt={countdown} /> : null}
                <a className="tool-action" href={actionHref || href}>
                  {action}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Footer — the site map plus the two ways to reach RCAP. The old closing
          block had a headline and a paragraph that repeated the welcome without
          adding anything, so it is just the footer now. */}
      <footer className="closing">
        <p className="footer-heading">Jump to the cheat sheet</p>
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

        <div className="footer-contact">
          <a className="footer-reach" href={contactHref}>
            <Mail size={17} aria-hidden="true" />
            {contactEmail}
          </a>
          {socials
            .filter((s) => s.href)
            .map(({ icon: Icon, label, href }) => (
              <a
                className="footer-reach"
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon size={17} aria-hidden="true" />
                {label}
              </a>
            ))}
        </div>

        <div className="footer-legal">
          <p className="footer-mark">wearercap.org &middot; Established 2026</p>
          <p>
            This is a parent-led site. It is not owned, operated, sponsored, or
            endorsed by the Ron Clark Academy, and nothing here is an official
            statement of the school. It is built by Ron Clark Academy Parents as
            a resource for current RCA families.
          </p>
          <p>
            Dates, details, and links are shared in good faith and can change
            without notice. Always check with the school for anything official.
            Use of this site and the tools on it is at your own discretion. Any
            information you enter is shared with the other families and
            volunteers those tools are built for, so please do not post anything
            you would not want seen. Questions, corrections, and takedown
            requests go to <a href={contactHref}>{contactEmail}</a>.
          </p>
        </div>
      </footer>

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
              {committeeNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
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

function SpinLine({ max = 150 }) {
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

      // max-content, not the rendered box. The line is a flex container clamped
      // by its parent, so its border box reports the parent's width however far
      // the reel overflows inside it. Measuring the box made fit() circular: it
      // always looked like it fitted, so it never shrank, and on a phone the
      // words ran off the screen.
      line.style.width = 'max-content';
      const lineW = line.getBoundingClientRect().width;
      line.style.width = '';
      // Measure against whatever box the line is actually in. The prelaunch
      // screen is full width so this matched the viewport; inside the gate the
      // line sits in a 560px column and the viewport figure overflowed it.
      const host = line.parentElement;
      const avail = (host ? host.clientWidth : window.innerWidth) * 0.92;
      const availH = window.innerHeight * 0.5;

      let size = REF * (avail / lineW);
      size = Math.min(size, availH, max);
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

    // fit() runs once on mount, when the surrounding column may not have its
    // final width yet, and the window never resizes afterwards. Watching the
    // host means the line re-measures as soon as the layout settles.
    const host = line.parentElement;
    const ro =
      host && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fit()) : null;
    if (ro) ro.observe(host);
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
      if (ro) ro.disconnect();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [max]);

  return (
    <div className="prelaunch-line" ref={lineRef} aria-label="We are RCAP">
      <span className="prelaunch-fixed">We are</span>
      <span className="prelaunch-reel" ref={reelRef} aria-hidden="true">
        <span className="prelaunch-track" ref={trackRef} />
      </span>
    </div>
  );
}

// One question, drawn at random, shuffled, on a ten second clock. Miss it or run
// out and a fresh one takes its place, so there is no way to sit and grind at a
// single answer. A pass is remembered in localStorage, so a parent answers once
// per device rather than once per visit.
function pickRound() {
  const q = GATE_QUESTIONS[Math.floor(Math.random() * GATE_QUESTIONS.length)];
  return { ask: q.ask, accept: q.accept.map(normaliseAnswer) };
}

function EntryGate({ children }) {
  const [open, setOpen] = React.useState(() => {
    try {
      return window.localStorage.getItem(GATE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [round, setRound] = React.useState(pickRound);
  const [deadline, setDeadline] = React.useState(() => Date.now() + GATE_SECONDS * 1000);
  const [now, setNow] = React.useState(() => Date.now());
  const [missed, setMissed] = React.useState(false);
  const [guess, setGuess] = React.useState('');

  const nextRound = React.useCallback((wasMiss) => {
    setRound(pickRound());
    setDeadline(Date.now() + GATE_SECONDS * 1000);
    setNow(Date.now());
    setMissed(wasMiss);
    setGuess('');
  }, []);

  React.useEffect(() => {
    if (open) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [open]);

  const left = Math.max(0, deadline - now);

  React.useEffect(() => {
    if (!open && left === 0) nextRound(true);
  }, [open, left, nextRound]);

  if (open) return children;

  const submit = (event) => {
    event.preventDefault();
    const given = normaliseAnswer(guess);
    if (given && round.accept.includes(given)) {
      try {
        window.localStorage.setItem(GATE_KEY, '1');
      } catch {
        // Private mode. They are still let in; it just asks again next time.
      }
      setOpen(true);
      return;
    }
    setGuess('');
    nextRound(true);
  };

  return (
    <div className="gate">
      <div className="gate-inner">
        <SpinLine max={60} />

        <form className="gate-ask" onSubmit={submit}>
          <label className="gate-question" htmlFor="gate-input">
            {round.ask}
          </label>

          <div
            className="gate-clock"
            role="timer"
            aria-label={`${Math.ceil(left / 1000)} seconds left`}
          >
            <span
              className="gate-bar"
              style={{ transform: `scaleX(${left / (GATE_SECONDS * 1000)})` }}
            />
          </div>

          <div className="gate-field">
            <input
              id="gate-input"
              className="gate-input"
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              /* eslint-disable-next-line jsx-a11y/no-autofocus */
              autoFocus
              placeholder="Type your answer"
              aria-describedby="gate-note"
            />
            <button className="gate-go" type="submit">
              Enter
            </button>
          </div>

          <p className="gate-note" id="gate-note" role="status">
            {missed ? 'Not it. Here is another one.' : 'For RCA families.'}
          </p>
        </form>
      </div>
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

function Root() {
  if (COMING_SOON) {
    return (
      <ComingSoonGate>
        <App />
      </ComingSoonGate>
    );
  }
  if (GATE_ENABLED) {
    return (
      <EntryGate>
        <App />
      </EntryGate>
    );
  }
  return <App />;
}

createRoot(document.getElementById('root')).render(<Root />);
