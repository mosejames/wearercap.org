import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, Mail } from 'lucide-react';
import '../styles.css';
import './board.css';

// Contact addresses are placeholders on purpose. The plan is one shared inbox
// with a plus-address per officer that forwards to them, but that has not been
// set up yet. Until it is, every card points at the general inbox so nothing
// on this page can send a parent into the void.
const contactEmail = 'hello@wearercap.org';

// Headshots: drop a file at /public/images/board/<key>.jpg and set `photo` to
// its path. Cards without one show initials on a house-coloured field.
const officers = [
  {
    key: 'mose',
    name: 'Mose James IV',
    role: 'Chairperson',
    photo: null,
    email: contactEmail,
    bio: 'A short paragraph about Mose goes here. Two or three sentences: who he is, what he does when he is not doing this, and what he hopes the year looks like.',
  },
  {
    key: 'crystal',
    name: 'Crystal Claybrooks Jones',
    role: 'Co-Chairperson',
    photo: null,
    email: contactEmail,
    bio: 'A short paragraph about Crystal goes here.',
  },
  {
    key: 'latasha',
    name: 'Latasha Emeri',
    role: 'Treasurer',
    photo: null,
    email: contactEmail,
    bio: 'A short paragraph about Latasha goes here.',
  },
  {
    key: 'farren',
    name: 'Farren Salter',
    role: 'Secretary',
    photo: null,
    email: contactEmail,
    bio: 'A short paragraph about Farren goes here.',
  },
];

// One parent per grade level, nominated by the officers. Names to come.
const advisors = [
  { key: 'g4', grade: '4th grade', name: 'To be announced', photo: null },
  { key: 'g5', grade: '5th grade', name: 'To be announced', photo: null },
  { key: 'g6', grade: '6th grade', name: 'To be announced', photo: null },
  { key: 'g7', grade: '7th grade', name: 'To be announced', photo: null },
  { key: 'g8', grade: '8th grade', name: 'To be announced', photo: null },
];

function initials(name) {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function Headshot({ name, photo, tone }) {
  if (photo) {
    return <img className="bd-photo" src={photo} alt="" loading="lazy" width="480" height="600" />;
  }
  return (
    <div className={`bd-photo bd-photo-empty tone-${tone}`} aria-hidden="true">
      <span>{initials(name)}</span>
    </div>
  );
}

function App() {
  return (
    <main className="site-shell board-page">
      <header className="bd-top">
        <a className="bd-back" href="/">
          <ArrowLeft size={16} aria-hidden="true" />
          wearercap.org
        </a>
      </header>

      <section className="content-section bd-hero">
        <p className="section-label">Your 2026-27 board</p>
        <h1>The parents who said yes this year.</h1>
        <p className="bd-lede">
          Four officers, one parent from every grade, and a lot of other people
          who show up without a title. If you see one of these faces at carline
          or at an event, come say hello. That is the whole point of putting
          them here.
        </p>
      </section>

      <section className="content-section" aria-labelledby="officers-h">
        <div className="section-heading">
          <p className="section-label">Executive board</p>
          <h2 id="officers-h">Four seats, one year.</h2>
        </div>
        <ul className="bd-grid">
          {officers.map((o, i) => (
            <li className="bd-card" key={o.key}>
              <Headshot name={o.name} photo={o.photo} tone={i % 4} />
              <div className="bd-body">
                <p className="bd-role">{o.role}</p>
                <h3 className="bd-name">{o.name}</h3>
                <p className="bd-bio">{o.bio}</p>
                <a className="text-link" href={`mailto:${o.email}`}>
                  <Mail size={15} aria-hidden="true" />
                  Email {o.name.split(' ')[0]}
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="content-section band story-section" aria-labelledby="advisory-h">
        <div className="section-heading">
          <p className="section-label">Advisory board</p>
          <h2 id="advisory-h">One voice from every grade.</h2>
          <p>
            Each officer nominated a parent from a different grade level, so
            every hallway in the building has someone at the table. They are
            the ones we ask before we decide anything that touches your child.
          </p>
        </div>
        <ul className="bd-grid bd-grid-five">
          {advisors.map((a, i) => (
            <li className="bd-card bd-card-sm" key={a.key}>
              <Headshot name={a.name} photo={a.photo} tone={(i + 1) % 4} />
              <div className="bd-body">
                <p className="bd-role">{a.grade}</p>
                <h3 className="bd-name">{a.name}</h3>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="content-section bd-letter" aria-labelledby="letter-h">
        <p className="section-label">From the board</p>
        <h2 id="letter-h">We are excited to serve.</h2>
        <div className="bd-letter-body">
          <p>
            Thank you for trusting us with this year. None of us took a seat
            because we wanted to be in front. We took it because RCA gives our
            children something rare, and the least we can do is hold up our end.
          </p>
          <p>
            So here is the ask. If you see one of our faces, please come up and
            speak. Tell us what is working and what is not. Tell us what your
            family needs. We would rather hear it in the hallway than never hear
            it at all.
          </p>
          <p>
            We are here to make this the best experience it can be, for every one
            of our children and for the school that pours into them. We are not
            here to run anything. We are here to be the support. That is the job,
            and we are glad to have it.
          </p>
          <p className="bd-sign">Your 2026-27 RCAP Board</p>
        </div>
      </section>

      <footer className="closing">
        <nav className="footer-map" aria-label="Site sections">
          <a href="/">Home</a>
          <a href="/committee-interest/">Find Your Place</a>
          <a href="/uniform-exchange/">Uniform Exchange</a>
          <a href="/carpool/">Carpool</a>
          <a href="/wish-i-knew/">One Thing I Wish I Knew</a>
          <a href="/rcap-recap/">The RCAP Recap</a>
        </nav>
        <div className="footer-contact">
          <a className="footer-reach" href={`mailto:${contactEmail}`}>
            <Mail size={17} aria-hidden="true" />
            {contactEmail}
          </a>
        </div>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
