import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, CalendarDays, HeartHandshake, Mail, Megaphone, Users } from 'lucide-react';
import './styles.css';

const heroImage = 'https://mosejames.github.io/rcap-exp-2026/img/hero-celebrate.jpg';
const communityImage = 'https://mosejames.github.io/rcap-exp-2026/img/joy-trio.jpg';
const serviceImage = 'https://mosejames.github.io/rcap-exp-2026/img/hall-lead.jpg';

const priorities = [
  {
    icon: Megaphone,
    title: 'Clear communication',
    body: 'Shared updates, timely announcements, and the context families need to stay connected.',
  },
  {
    icon: CalendarDays,
    title: 'Meaningful events',
    body: 'Parent-led support for gatherings, school moments, and experiences that bring the community together.',
  },
  {
    icon: HeartHandshake,
    title: 'Service in motion',
    body: 'Volunteers showing up with energy, care, and practical help wherever the school community needs it.',
  },
  {
    icon: Users,
    title: 'Family connection',
    body: 'A welcoming place for parents and guardians to meet, collaborate, and build lasting relationships.',
  },
];

function App() {
  return (
    <main className="site-shell">
      <section className="hero" aria-label="We Are RCAP">
        <img className="hero-image" src={heroImage} alt="RCAP volunteers celebrating together" />
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
            The parent community supporting Ron Clark Academy families through communication,
            service, events, fundraising, and volunteer leadership.
          </p>
          <div className="hero-actions">
            <a className="button primary" href="mailto:hello@wearercap.org">
              Get in touch
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <a className="button secondary" href="#community">
              See our focus
            </a>
          </div>
        </div>
      </section>

      <section id="community" className="intro">
        <div>
          <p className="section-label">Parent powered</p>
          <h2>Built for the families who show up, pitch in, and keep the community moving.</h2>
        </div>
        <p>
          RCAP helps organize the everyday work behind a strong parent community:
          announcements, board meetings, budgets, events, fundraising, communications,
          volunteer coordination, and transition notes.
        </p>
      </section>

      <section className="image-band" aria-label="RCAP community">
        <img src={communityImage} alt="RCAP volunteers smiling together" />
        <img src={serviceImage} alt="Volunteer guiding educators through a hallway" />
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
        <p className="section-label">More soon</p>
        <h2>A public home for We Are RCAP is underway.</h2>
        <p>
          This site will grow into the central public place for updates, parent resources,
          volunteer coordination, and community information.
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
