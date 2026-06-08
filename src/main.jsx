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

const contactEmail = 'mose@mosejames.com';
const contactHref = `mailto:${contactEmail}`;
const volunteerHref = 'https://www.signupgenius.com/go/60B0949A4AB29A2F94-rcaexp2#/';
const hoursHref = 'https://www.trackitforward.com/site/the-ron-clark-academy';
const youtubeEmbedUrl = 'https://www.youtube.com/embed/6UA9ZZjm66c?rel=0&modestbranding=1';

const heroSlides = [
  {
    src: '/images/rcap-hero-parents.jpg',
    position: 'center center',
  },
  {
    src: '/images/rcap-hero-students.jpg',
    position: 'center center',
  },
  {
    src: '/images/rcap-hero-campus.jpg',
    position: 'center center',
  },
  {
    src: '/images/rcap-hero-volunteer.jpg',
    position: 'center center',
  },
];

const communityLinks = [
  {
    variant: 'announcements',
    icon: Megaphone,
    title: 'Announcements',
    body: 'Key RCAP updates, reminders, and next steps will have a clear home.',
    href: '#announcements',
  },
  {
    variant: 'events',
    icon: CalendarDays,
    title: 'Events',
    body: 'Upcoming EXP dates and family moments will be easy to find.',
    href: '#events',
  },
  {
    variant: 'volunteer',
    icon: HeartHandshake,
    title: 'Volunteer',
    body: 'Find ways to pitch in, sign up, and log your service hours.',
    href: '#volunteer',
  },
  {
    variant: 'resources',
    icon: ShieldCheck,
    title: 'Family Resources',
    body: 'Helpful links and parent-only info can grow here with care.',
    href: '#resources',
  },
];

const announcementFramework = [
  {
    title: 'Parent updates',
    body: 'Short, dated announcements with the information families need first.',
  },
  {
    title: 'Upcoming moments',
    body: 'Pointers to events, deadlines, and school-adjacent opportunities.',
  },
  {
    title: 'What to do next',
    body: 'Clear actions, links, contacts, and follow-up when an update needs a response.',
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
    title: 'Public by design',
    body: 'The open site should stay focused on welcoming information, announcements, events, and ways to help.',
  },
  {
    icon: LockKeyhole,
    title: 'Parent-only later',
    body: 'Anything that should not sit on the public web can move behind a light family check before it is published.',
  },
  {
    icon: Users,
    title: 'Soft access',
    body: 'When it is time, access can feel simple and phone-friendly instead of like a heavy portal.',
  },
];

function HeroSlides() {
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(() => {
      setActive((current) => (current + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hero-slides" aria-hidden="true">
      {heroSlides.map((slide, index) => (
        <div
          className={`hero-slide${index === active ? ' is-active' : ''}`}
          key={slide.src}
        >
          <img src={slide.src} alt="" style={{ objectPosition: slide.position }} />
        </div>
      ))}
    </div>
  );
}

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
        <HeroSlides />
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

        <div className="hero-content">
          <p className="kicker">Ron Clark Academy Parents</p>
          <h1 aria-label="We Are RCAP">
            <span>We Are</span>
            {' '}
            <span>RCAP</span>
          </h1>
          <p className="hero-copy">
            The parent community of Ron Clark Academy. One place to stay informed,
            get involved, and support the school, our kids, and one another.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#get-involved">
              Get involved
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <a className="button secondary" href="#community">
              Our Community
            </a>
            <button className="button secondary" type="button" onClick={openVideo}>
              <PlayCircle size={18} aria-hidden="true" />
              Watch video
            </button>
          </div>
        </div>
      </section>

      <section id="get-involved" className="quick-links" aria-label="Get involved with RCAP">
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
      </section>

      <section id="community" className="intro">
        <div>
          <p className="section-label">Our Community</p>
          <h2>We Are RCAP, and this is our shared home base.</h2>
        </div>
        <p>
          RCAP is parents and guardians showing up for Ron Clark Academy, our kids,
          and one another. This site gives families a simple place to look first:
          announcements, known dates, ways to volunteer, and resources that can grow
          as the parent community grows.
        </p>
      </section>

      <section className="video-callout" aria-label="RCAP video preview">
        <div className="video-copy">
          <p className="section-label">Video Preview</p>
          <h2>See the energy behind RCAP.</h2>
          <p>
            Watch a quick look at the people and energy behind RCAP. The popup keeps
            it easy to view on a phone without taking over the page.
          </p>
        </div>
        <button className="video-card" type="button" onClick={openVideo}>
          <img src="/images/rcap-community-table.jpg" alt="" />
          <span className="video-play">
            <PlayCircle size={34} aria-hidden="true" />
          </span>
          <span className="video-card-text">
            <strong>Watch the RCAP video</strong>
            <span>Opens in a responsive popup</span>
          </span>
        </button>
      </section>

      <section className="image-band" aria-label="RCAP community">
        <img src="/images/rcap-community-smiles.jpg" alt="RCAP parents smiling together" />
        <img src="/images/rcap-volunteer-hours.jpg" alt="RCAP volunteers reviewing materials together" />
      </section>

      <section id="announcements" className="content-section announcements-section">
        <div className="section-heading">
          <p className="section-label">Announcements</p>
          <h2>Updates will have a clear place to land.</h2>
          <p>
            As RCAP announcements are ready to share, this section can become the
            parent-facing record of what changed, what matters, and what families
            should do next.
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
          <h2>Known EXP dates are the first anchors.</h2>
          <p>
            More events can be added as they are confirmed. For now, these are the
            upcoming EXP dates families can plan around.
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
            Use this section when you are ready to volunteer, record hours, or ask
            where help is needed next.
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
          <h2>Helpful now, protected when it needs to be.</h2>
          <p>
            The public site can welcome families and make action easy. As deeper
            parent resources come online, anything sensitive can move behind a soft
            access step before it is published.
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
        <p className="section-label">More to come</p>
        <h2>The RCAP hub can grow as the community grows.</h2>
        <p>
          Announcements, events, volunteer coordination, and family resources now
          have a foundation. For questions or updates, email{' '}
          <a href={contactHref}>{contactEmail}</a>.
        </p>
      </section>

      <VideoModal open={isVideoOpen} onClose={closeVideo} />
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
