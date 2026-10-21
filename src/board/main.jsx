import Brand from '../components/Brand.jsx';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, ArrowUpRight, Mail, Candy, Ticket, HeartHandshake, TreePine, Popcorn, Megaphone, HandHelping, Shirt, DoorOpen, Gift } from 'lucide-react';
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

// Confirmed committee leads from the October newsletter roster.
const committeeLeads = [
  { name: 'Trunk or Treat', icon: Candy, lead: 'Donna Jenkins', about: 'Brings families together for decorated trunks, candy and a fall celebration for our students.' },
  { name: 'Fall Raffle', icon: Ticket, lead: 'Jamelia Jones and Ashley Carter', about: 'Organizes ticket sales, prize donations and drawings that support Teacher Appreciation Week.' },
  { name: 'Teacher Appreciation Week', icon: HeartHandshake, lead: 'Amanda Brown', about: 'Plans a week of thoughtful ways to thank the faculty and staff who pour into our children.' },
  { name: 'Holiday Decor', icon: TreePine, lead: 'Brandy Mahaffey', about: 'Helps make the school feel festive, from planning decorations to setting them up and taking them down.' },
  { name: 'Concessions', icon: Popcorn, lead: 'Tim Evans', about: 'Keeps the concession stand stocked and staffed for home basketball games.' },
  { name: 'Marketing and Communications', icon: Megaphone, lead: 'Tamara Smith', about: 'Helps families stay connected through photos, video, writing and community updates.' },
  { name: 'Men of RCAP', icon: HandHelping, lead: 'Steve Johnson', about: 'Brings hands and a welcoming presence to events, setup, teardown and the work that needs doing.' },
  { name: 'Uniform Swap', icon: Shirt, lead: 'Shekita James', about: 'Connects outgrown uniforms with the families who can use them, through sorting and handoffs.' },
  { name: 'EXP Support', icon: DoorOpen, lead: 'Nathan Jones', about: 'Helps recruit and welcome parent volunteers when educators visit for the RCA Experience.' },
];
const christmasLeads = [
  ['2027', 'Brooke Everette'],
  ['2028', 'Josette Berksteiner'],
  ['2029', 'Adrienne Greene'],
  ['2030', 'LaTerrica Bellamy'],
  ['2031', 'Angelia Lumpkin'],
];

const committeeTiles = [...committeeLeads, {
  name: '4 Days of Christmas', icon: Gift, lead: 'Your class teams',
  about: 'Each class helps bring a little holiday joy to our faculty and staff. Your class lead brings the parents together and helps plan its part of the celebration.',
  classes: christmasLeads,
}];

function CommitteeDirectory() {
  const [selected, setSelected] = React.useState(null);
  const [closing, setClosing] = React.useState(false);
  const dialog = React.useRef(null);
  React.useEffect(() => {
    if (!selected) return undefined;
    const node = dialog.current;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    node.showModal();
    return () => {
      node.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [selected]);
  function close() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setSelected(null);
    else setClosing(true);
  }
  const Icon = selected?.icon;
  return <>
    <ul className="bd-committee-grid">
      {committeeTiles.map((team) => {
        const TileIcon = team.icon;
        return <li key={team.name}>
          <button type="button" className="bd-team-tile" aria-haspopup="dialog"
            aria-label={`Meet the ${team.name} team`} onClick={() => { setClosing(false); setSelected(team); }}>
            <span className="bd-committee-icon" aria-hidden="true"><TileIcon size={32} strokeWidth={2.2} /></span>
            <span className="bd-tile-name">{team.name}</span>
            <span className="bd-committee-lead">{team.lead}</span>
            <span className="bd-tile-hint">Meet the team <ArrowUpRight size={14} aria-hidden="true" /></span>
          </button>
        </li>;
      })}
    </ul>
    <dialog ref={dialog} className={`bd-team-dialog${closing ? ' is-closing' : ''}`}
      aria-labelledby="team-title" onCancel={(event) => { event.preventDefault(); close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      onClose={() => { setSelected(null); setClosing(false); }}>
      {selected && <article className="bd-team-detail" onAnimationEnd={(event) => {
        if (closing && event.target === event.currentTarget) { setSelected(null); setClosing(false); }
      }}>
        <button type="button" className="bd-team-back" onClick={close}><ArrowLeft size={16} aria-hidden="true" /> Back to committees</button>
        <span className="bd-committee-icon" aria-hidden="true"><Icon size={32} strokeWidth={2.2} /></span>
        <h3 id="team-title">{selected.name}</h3>
        <p className="bd-committee-lead">{selected.lead}</p>
        <p className="bd-team-about">{selected.about}</p>
        {selected.classes && <dl className="bd-class-leads">
          {selected.classes.map(([year, name]) => <div key={year}><dt>Class of {year}</dt><dd>{name}</dd></div>)}
        </dl>}
        <a className="button primary" href="/committee-interest/" onClick={() => { setSelected(null); setClosing(false); }}>Join the team <ArrowUpRight size={18} aria-hidden="true" /></a>
      </article>}
    </dialog>
  </>;
}

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
  // The newsletter links straight into a section rendered by React.
  React.useEffect(() => {
    if (window.location.hash !== '#committees') return undefined;
    const frame = window.requestAnimationFrame(() => document.getElementById('committees')?.scrollIntoView());
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return (
    <main className="site-shell board-page">
      <header className="bd-top">
        <a className="bd-back" href="/">
          <ArrowLeft size={16} aria-hidden="true" />
          <Brand width={170} />
        </a>
      </header>

      <section className="content-section bd-hero" aria-labelledby="officers-h">
        <p className="section-label">Your 2026-27 board</p>
        <h1 id="officers-h">Your parent leadership team.</h1>
        <p className="bd-lede">We are RCA parents, here to support our families, scholars and teachers. Thank you for trusting us with this year. Bring us your questions and ideas, or come say hello at carline.</p>
        <a className="text-link bd-jump" href="#committees">Meet the committee leads <ArrowUpRight size={16} aria-hidden="true" /></a>
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

      <section className="content-section band story-section bd-advisory" aria-labelledby="advisory-h">
        <div className="section-heading">
          <p className="section-label">Advisory board</p>
          <h2 id="advisory-h">A voice from every grade.</h2>
          <p>
            These parents bring perspectives from each grade to the board's conversations.
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

      <section id="committees" className="content-section bd-committees" aria-labelledby="committees-h">
        <div className="section-heading">
          <p className="section-label">Your 2026-27 committee leads</p>
          <h2 id="committees-h">Meet your committee leads.</h2>
          <p>Good things happen when families bring their time, ideas and care together. Get to know the parents coordinating our committees and the teams you can be part of.</p>
        </div>
        <CommitteeDirectory />
        <div className="bd-committee-invite">
          <div><h3>There is room for you, too.</h3><p>You do not have to lead a committee to make a difference. Explore the teams and tell us where you would like to help.</p></div>
          <a className="button primary" href="/committee-interest/">Join a committee <ArrowUpRight size={18} aria-hidden="true" /></a>
        </div>
      </section>

      <section className="content-section bd-meetings" aria-labelledby="meetings-h">
        <div className="section-heading">
          <p className="section-label">Meeting calendar</p>
          <h2 id="meetings-h">Join the next meeting.</h2>
          <p>
            Every RCA parent is welcome. Bring a question, an idea or a friend.
            Our next meeting is Monday, November 16 at 7 p.m., online.
          </p>
        </div>

        <div className="event-grid">
          {meetings.filter((meeting) => !meeting.recap).map(({ month, year, weekday, day, label, recap }) => (
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

        <div className="bd-past-meeting">
          <span>Past meeting: September 14, 2026</span>
          <a className="text-link" href="/meeting/sept-14/">Read the recap <ArrowUpRight size={15} aria-hidden="true" /></a>
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
