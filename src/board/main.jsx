import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowUpRight, Mail } from 'lucide-react';
import '../styles.css';
import './board.css';

// Contact addresses are placeholders on purpose. The plan is one shared inbox
// with a plus-address per officer that forwards to them, but that has not been
// set up yet. Until it is, every card points at the general inbox so nothing
// on this page can send a parent into the void.
const contactEmail = 'hello@wearercap.org';

// Headshots: drop a file at /public/images/board/<key>.jpg and set `photo` to
// its path. Cards without one show initials on a house-coloured field.
// Bios follow one shape, four beats: name and who you parent, a turn that says
// one true thing a little too plainly, what you are like in the building, then
// "in his free time" written in full board-bio register about something
// completely ordinary. The joke is the mismatch between the grammar and the
// content, so keep the sentences straight and let the detail be small.
//
// Grades, never ages. These were written from what the board has seen of each
// other this year rather than from a questionnaire, so each officer should read
// her own and change anything that does not sound like her.
const officers = [
  {
    key: 'mose',
    name: 'Mose James IV',
    role: 'Chairperson',
    // Drop the file at public/images/board/mose.jpg and this turns on.
    photo: '/images/board/mose.jpg',
    email: contactEmail,
    bio:
      'Mose James IV, father of Mose James V, a seventh grader. Yes, there are ' +
      'five of them. He is happiest building something with a group and letting ' +
      'somebody else stand in front of it. In his free time, he enjoys long walks ' +
      'around his neighborhood and sipping his favorite beverage on the porch.',
  },
  {
    key: 'crystal',
    name: 'Crystal Claybrooks Jones',
    role: 'Co-Chairperson',
    photo: '/images/board/crystal.jpg',
    email: contactEmail,
    bio:
      'Crystal Claybrooks Jones, mother of Dean, a sixth grader. She will say the ' +
      'thing everyone else in the room was already thinking, and she is usually ' +
      'right. She can run a meeting, cook dinner, and plan a party in the same ' +
      'hour. If something good is happening this year, she is already three steps ' +
      'into organizing it.',
  },
  {
    key: 'latasha',
    name: 'Latasha Emeri',
    role: 'Treasurer',
    photo: '/images/board/latasha.jpg',
    email: contactEmail,
    bio:
      'Latasha Emeri, mother of Braylen, a seventh grader. She keeps the receipts. ' +
      'All of them. She will ask what something costs before you have finished ' +
      'describing it, and she will be right to. On the rare occasion she cannot ' +
      'make a meeting, her notes arrive beforehand so the work happens anyway.',
  },
  {
    key: 'farren',
    name: 'Farren Salter',
    role: 'Secretary',
    photo: '/images/board/farren.jpg',
    email: contactEmail,
    bio:
      'Farren Salter, mother of Logan, a sixth grader, with two more at home keeping ' +
      'her busy. She is the reason anything said in a meeting can be found again. ' +
      'Quietly precise, and the first to check that we spelled a name right. ' +
      'If it got written down, sorted, or followed up this year, her name is on it.',
  },
];

// One parent per grade level, nominated by the officers. Names to come.
// General membership meetings, set by the board at its third meeting. Quarterly,
// Mondays at 7pm. Only April is in person, because that is the election.
// May 10 is its backup. Same shape as the homepage tiles so they render through
// the same markup and stylesheet; nothing here is styled twice.
// After every general meeting, build its page and add `recap` to that row. The
// tile then carries a "Read the recap" link and nothing else needs touching:
// the meetings still to come simply have no recap yet, which is the honest
// state rather than a dead link.
// After every general meeting, add an entry to the TOP of this list and the
// section renders itself. `points` is the short version for a parent who will
// not click; `href` is the full recap page. Keep it to three or four points:
// this is the summary, not the minutes.
const recaps = [
  {
    key: 'sept-14',
    date: 'Monday, September 14',
    href: '/meeting/sept-14/',
    headline: 'The room hit its limit before 7:00.',
    points: [
      'Dues are $25 per family for the whole year, and every RCA family is already a member.',
      'The year ahead: the parents\u2019 social on Sept 27, the fall raffle, Trunk or Treat, holiday decor, 4 Days of Christmas, and Teacher Appreciation Week in the last week of April.',
      'We started the year with $6,716.14 on hand. Last year\u2019s raffle brought in $25,120.',
      'Committee sign-ups opened, and Latasha asked for two or three parents to join a new audit team.',
    ],
  },
];

const meetings = [
  { month: 'Sept', year: '2026', weekday: 'Mon', day: '14', label: '7:00pm, virtual', recap: '/meeting/sept-14/' },
  { month: 'Nov', year: '2026', weekday: 'Mon', day: '16', label: '7:00pm, virtual' },
  { month: 'Jan', year: '2027', weekday: 'Mon', day: '25', label: '7:00pm, virtual' },
  { month: 'Apr', year: '2027', weekday: 'Mon', day: '26', label: '7:00pm, in person' },
];


const advisors = [
  // One per grade. A name goes up only once we have it right, and a photo only
  // once we are certain whose face it is.
  { key: 'g4', grade: '4th grade', name: 'Will Wesley', photo: '/images/board/will.jpg' },
  { key: 'g5', grade: '5th grade', name: 'Sidonie Holloman', photo: '/images/board/sidonie.jpg' },
  { key: 'g6', grade: '6th grade', name: 'Adriane Simpson', photo: '/images/board/adriane.jpg' },
  { key: 'g7', grade: '7th grade', name: 'Sara White', photo: '/images/board/sara.jpg' },
  { key: 'g8', grade: '8th grade', name: 'Camille Cunningham', photo: '/images/board/camille.jpg' },
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
        <h1>Meet your RCAP board.</h1>
        <p className="bd-lede">
          We are RCA parents, here to support our families and school. Have a
          question, an idea, or something you would like us to know? Reach out
          anytime, or come say hello at carline or the next event.
        </p>
      </section>

      <section className="content-section" aria-labelledby="officers-h">
        <div className="section-heading">
          <p className="section-label">Executive board</p>
          <h2 id="officers-h">Your parent leadership team.</h2>
        </div>
        <ul className="bd-grid">
          {officers.map((o, i) => (
            <li className="bd-card" key={o.key}>
              <Headshot name={o.name} photo={o.photo} tone={i % 4} />
              {/* Bio and the mail link are siblings of the body, not children,
                  so on a phone the photo can sit beside the name while the bio
                  runs the full width underneath. */}
              <div className="bd-body">
                <p className="bd-role">{o.role}</p>
                <h3 className="bd-name">{o.name}</h3>
              </div>
              <p className="bd-bio">{o.bio}</p>
              <a className="bd-mail text-link" href={`mailto:${o.email}`}>
                <Mail size={15} aria-hidden="true" />
                Email {o.name.split(' ')[0]}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="content-section band story-section" aria-labelledby="advisory-h">
        <div className="section-heading">
          <p className="section-label">Advisory board</p>
          <h2 id="advisory-h">Someone from your child&rsquo;s grade, at the table.</h2>
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

      {recaps.length ? (
        <section className="content-section bd-recaps" aria-labelledby="recaps-h">
          <div className="section-heading">
            <p className="section-label">Last meeting</p>
            <h2 id="recaps-h">{recaps[0].headline}</h2>
            <p>
              {recaps[0].date}. Here is the short version for anyone who could
              not make it.
            </p>
          </div>

          <ul className="bd-recap-points">
            {recaps[0].points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>

          <a className="button primary" href={recaps[0].href}>
            Everything from the meeting
            <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        </section>
      ) : null}

      <section className="content-section" aria-labelledby="meetings-h">
        <div className="section-heading">
          <p className="section-label">Meeting calendar</p>
          <h2 id="meetings-h">Join us at the next RCAP meeting.</h2>
          <p>
            Every RCA parent is a member, so every one of these is yours. Please
            come. This is where the decisions get made, and the parents in the
            room are the ones who make them. Bring a question, bring an idea, or
            bring a friend who has been meaning to get involved.
          </p>
        </div>

        <div className="event-grid">
          {meetings.map(({ month, year, weekday, day, label, recap }) => (
            <article className="event-card" key={`${month}-${day}`}>
              <header className="event-banner">
                <span>
                  {month} {year}
                </span>
                <span>{weekday}</span>
              </header>
              <p className="event-day">{day}</p>
              <p className="event-what">{label}</p>
              {recap ? (
                <a className="event-recap" href={recap}>
                  Read the recap
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              ) : null}
            </article>
          ))}
        </div>

        <p className="bd-social">
          The parents&rsquo; social is Sunday, September 27, in person.
        </p>
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
