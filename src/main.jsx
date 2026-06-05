import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight,
  CalendarDays,
  Clock,
  HeartHandshake,
  Mail,
  Megaphone,
  Users,
} from 'lucide-react';
import './styles.css';

const imageBase = 'https://mosejames.github.io/rcap-exp-2026/img/';

const heroSlides = [
  { src: `${imageBase}hero-celebrate.jpg`, alt: 'RCAP families celebrating together' },
  { src: `${imageBase}joy-laugh.jpg`, alt: 'RCAP parents laughing together' },
  { src: `${imageBase}joy-trio.jpg`, alt: 'Three RCAP volunteers smiling' },
  { src: `${imageBase}students-group.jpg`, alt: 'Ron Clark Academy students together' },
];

const communityImage = `${imageBase}joy-trio.jpg`;
const serviceImage = `${imageBase}hall-lead.jpg`;

// Prominent quick links — the two most-used family actions plus contact.
const quickLinks = [
  {
    variant: 'volunteer',
    icon: HeartHandshake,
    title: 'Volunteer with RCAP',
    body: 'See where help is needed and sign up to lend a hand.',
    href: 'https://www.signupgenius.com/go/60B0949A4AB29A2F94-rcaexp2#/',
    external: true,
  },
  {
    variant: 'hours',
    icon: Clock,
    title: 'Log your volunteer hours',
    body: 'Already pitched in? Record your hours with Track It Forward.',
    href: 'https://www.trackitforward.com/site/the-ron-clark-academy',
    external: true,
  },
  {
    variant: 'contact',
    icon: Mail,
    title: 'Get in touch',
    body: 'Questions, ideas, or ready to help? Reach the RCAP team.',
    href: 'mailto:hello@wearercap.org',
    external: false,
  },
];

const priorities = [
  {
    icon: Megaphone,
    title: 'Clear communication',
    body: 'The information families actually need, in one place, so no one is left guessing.',
  },
  {
    icon: CalendarDays,
    title: 'Meaningful events',
    body: 'Parent energy behind the gatherings and school moments that bring RCAP families together.',
  },
  {
    icon: HeartHandshake,
    title: 'Service in motion',
    body: 'Volunteers showing up for the school and its students with real, hands-on help.',
  },
  {
    icon: Users,
    title: 'Family connection',
    body: 'A welcoming place for parents and guardians to meet, support one another, and build something lasting.',
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
          <img src={slide.src} alt="" />
        </div>
      ))}
    </div>
  );
}

function App() {
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
          <a className="nav-link" href="mailto:hello@wearercap.org">
            <Mail size={18} aria-hidden="true" />
            Contact
          </a>
        </header>

        <div className="hero-content">
          <p className="kicker">Ron Clark Academy Parents</p>
          <h1>
            <span>We Are</span>
            <span>RCAP</span>
          </h1>
          <p className="hero-copy">
            The parent community of Ron Clark Academy. One place to stay informed,
            get involved, and support the school, our kids, and one another.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="#quick-links">
              Get involved
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <a className="button secondary" href="#community">
              Why this site
            </a>
          </div>
        </div>
      </section>

      <section id="quick-links" className="quick-links" aria-label="Quick links">
        {quickLinks.map(({ variant, icon: Icon, title, body, href, external }) => (
          <a
            className={`quick-link ${variant}`}
            key={title}
            href={href}
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
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
          <p className="section-label">Why this site</p>
          <h2>One place where RCAP families know where to look.</h2>
        </div>
        <p>
          We Are RCAP is the parent community of Ron Clark Academy. This site is the
          home base: a single, trusted place to find what's happening, how to help,
          and where to get the right information. No more digging through scattered
          threads. If it matters to RCAP families, you'll find your way to it here.
        </p>
      </section>

      <section className="image-band" aria-label="RCAP community">
        <img src={communityImage} alt="RCAP volunteers smiling together" />
        <img src={serviceImage} alt="Volunteer guiding educators through a hallway" />
      </section>

      <section className="priorities-intro" aria-label="What we are here for">
        <p className="section-label">What we're here for</p>
        <h2>Support the school. Support our kids. Support one another.</h2>
      </section>

      <section className="priorities" aria-label="RCAP priorities">
        {priorities.map(({ icon: Icon, title, body }) => (
          <article className="priority-card" key={title}>
            <Icon size={24} aria-hidden="true" />
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>

      <section className="closing">
        <p className="section-label">Coming soon</p>
        <h2>More is on the way.</h2>
        <p>
          We're building out the full RCAP hub: events, resources, ways to get
          involved, and everything families need in one place. Check back soon, and
          reach out anytime.
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
