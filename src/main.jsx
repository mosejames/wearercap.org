import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Clock,
  HeartHandshake,
  LockKeyhole,
  Mail,
  Megaphone,
  PlayCircle,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import './styles.css';

// Pre-launch gate. Flip to false to release the homepage; nothing else needs
// changing. Only covers the React homepage — static pages under public/ (e.g.
// /invite/) are served directly and stay reachable.
// Note: this is a visual cover, not access control. The markup still ships to
// the browser and is readable via view-source or with CSS disabled.
const COMING_SOON = true;

const contactEmail = 'hello@wearercap.org';
const contactHref = `mailto:${contactEmail}`;
const volunteerHref = 'https://www.signupgenius.com/go/60B0949A4AB29A2F94-rcaexp2#/';
const hoursHref = 'https://www.trackitforward.com/site/the-ron-clark-academy';
const youtubeEmbedUrl = 'https://www.youtube.com/embed/6UA9ZZjm66c?rel=0&modestbranding=1';
const heroPoster = '/images/rcap-video-hero.jpg';

const communityLinks = [
  {
    variant: 'announcements',
    icon: Megaphone,
    title: 'Announcements',
    body: 'Important RCAP updates, reminders, and links for families.',
    href: '#announcements',
  },
  {
    variant: 'events',
    icon: CalendarDays,
    title: 'Upcoming Events',
    body: 'Known dates, EXP opportunities, and family moments.',
    href: '#events',
  },
  {
    variant: 'volunteer',
    icon: HeartHandshake,
    title: 'Volunteer',
    body: 'Sign up, serve, and log your volunteer hours.',
    href: '#volunteer',
  },
  {
    variant: 'resources',
    icon: ShieldCheck,
    title: 'Family Resources',
    body: 'Helpful parent information, contacts, and school-year links.',
    href: '#resources',
  },
];

const announcementFramework = [
  {
    title: 'News and reminders',
    body: 'Quick updates for RCAP families, written plainly and easy to scan.',
  },
  {
    title: 'Dates and details',
    body: 'Event notes, deadlines, and the details families need before they arrive.',
  },
  {
    title: 'Family actions',
    body: 'Sign-ups, forms, contacts, and next steps gathered in one place.',
  },
];

const knownEvents = [
  { weekday: 'Sat', date: 'Jul 18, 2026', label: 'Known EXP date' },
  { weekday: 'Sun', date: 'Jul 19, 2026', label: 'Known EXP date' },
  { weekday: 'Tue', date: 'Jul 21, 2026', label: 'Known EXP date' },
  { weekday: 'Wed', date: 'Jul 22, 2026', label: 'Known EXP date' },
  { weekday: 'Fri', date: 'Jul 24, 2026', label: 'Known EXP date' },
  { weekday: 'Sat', date: 'Jul 25, 2026', label: 'Known EXP date' },
];

const volunteerActions = [
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
    icon: Mail,
    title: 'Ask or offer help',
    body: 'Send questions, ideas, and offers to help to the current contact.',
    href: contactHref,
    label: 'Email RCAP',
    external: false,
  },
];

const resourceNotes = [
  {
    icon: ShieldCheck,
    title: 'Family links',
    body: 'Useful links for staying connected, volunteering, and finding RCAP information quickly.',
  },
  {
    icon: LockKeyhole,
    title: 'Parent-only details',
    body: 'Sensitive details stay off the public web and are shared through trusted parent channels.',
  },
  {
    icon: Users,
    title: 'Questions and ideas',
    body: 'Parents can reach RCAP with questions, corrections, ideas, and ways to help.',
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
            <a className="button secondary" href="#get-involved">
              Get involved
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section id="community" className="community-feature">
        <div className="community-copy">
          <p className="section-label">Our Community</p>
          <h2>Parents showing up for RCA, our kids, and each other.</h2>
          <p>
            We Are RCAP is the parent community of Ron Clark Academy. This is where
            families come to stay connected, celebrate what is happening, and find
            simple ways to support the school.
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

      <section className="image-band" aria-label="RCAP community">
        <img src="/images/rcap-hero-campus.jpg" alt="RCA families walking near campus" />
        <img src="/images/rcap-hero-volunteer.jpg" alt="RCAP volunteer welcoming families" />
      </section>

      <section id="get-involved" className="content-section get-involved-section">
        <div className="section-heading">
          <p className="section-label">Get Involved</p>
          <h2>Find what you need and jump in.</h2>
          <p>
            Start with the most common RCAP needs: updates, dates, volunteer
            opportunities, and family resources.
          </p>
        </div>
        <div className="quick-links" aria-label="Get involved with RCAP">
          {communityLinks.map(({ variant, icon: Icon, title, body, href }) => (
            <a className={`quick-link ${variant}`} key={title} href={href}>
              <Icon size={26} aria-hidden="true" />
              <div className="quick-link-text">
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
              <ArrowUpRight className="quick-arrow" size={20} aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>

      <section id="announcements" className="content-section announcements-section">
        <div className="section-heading">
          <p className="section-label">Announcements</p>
          <h2>Stay connected with RCAP.</h2>
          <p>
            Announcements, reminders, and next steps from RCAP live here for
            families to reference without digging through scattered messages.
          </p>
        </div>
        <div className="framework-grid">
          {announcementFramework.map(({ title, body }) => (
            <article className="framework-card" key={title}>
              <Bell size={22} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="events" className="content-section events-section">
        <div className="section-heading">
          <p className="section-label">Upcoming Events</p>
          <h2>Upcoming EXP dates.</h2>
          <p>
            These are the confirmed upcoming EXP dates families can plan around.
          </p>
        </div>
        <div className="event-grid" aria-label="Known upcoming EXP dates">
          {knownEvents.map(({ weekday, date, label }) => (
            <article className="event-card" key={date}>
              <span className="event-weekday">{weekday}</span>
              <strong>{date}</strong>
              <span>{label}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="volunteer" className="content-section volunteer-section">
        <div className="section-heading">
          <p className="section-label">Volunteer</p>
          <h2>Pitch in, then log the hours.</h2>
          <p>
            Ready to help? Sign up for current needs, record your hours, or send
            RCAP a question.
          </p>
        </div>
        <div className="action-list">
          {volunteerActions.map(({ icon: Icon, title, body, href, label, external }) => (
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

      <section id="resources" className="content-section resources-section">
        <div className="section-heading">
          <p className="section-label">Family Resources</p>
          <h2>Resources for RCAP families.</h2>
          <p>
            Find useful public links here. Family-only details are shared through
            trusted parent channels.
          </p>
        </div>
        <div className="resource-grid">
          {resourceNotes.map(({ icon: Icon, title, body }) => (
            <article className="resource-note" key={title}>
              <Icon size={24} aria-hidden="true" />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="closing">
        <p className="section-label">We Are RCAP</p>
        <h2>Connected families make the community stronger.</h2>
        <p>
          Questions, corrections, ideas, and ways to help are welcome. Email{' '}
          <a href={contactHref}>{contactEmail}</a>.
        </p>
      </section>

      <VideoModal open={isVideoOpen} onClose={closeVideo} />
    </main>
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
        <p className="prelaunch-mark">
          WeAreRCAP<span className="prelaunch-tld">.org</span>
        </p>
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
