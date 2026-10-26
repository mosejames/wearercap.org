import data from './raffle-results.json';
import { milestones, segmentWidths, money, findStudentsByName } from './raffleResults.js';

const HOUSE_CLASS = { Amistad: 'amistad', Isibindi: 'isibindi', Altruismo: 'altruismo', 'Rêveur': 'reveur', Unassigned: 'unassigned' };
const $ = (key) => document.querySelector(`[data-rr="${key}"]`);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};
const short = (n) => (n >= 1000 ? `$${n % 1000 ? (n / 1000).toFixed(1) : n / 1000}K` : money(n));

function renderProgress(d) {
  $('total').textContent = money(d.total);
  $('of').textContent = ` of our ${money(d.goal)} goal`;

  const bar = $('bar');
  bar.setAttribute('aria-valuemax', String(d.goal));
  bar.setAttribute('aria-valuenow', String(Math.min(d.total, d.goal)));
  bar.setAttribute('aria-valuetext', `${money(d.total)} raised of a ${money(d.goal)} goal`);

  const fill = $('segments');
  for (const s of segmentWidths(d)) {
    const seg = el('span', `rr-seg rr-${HOUSE_CLASS[s.name] || 'unassigned'}`);
    seg.style.setProperty('--w', `${s.width}%`);
    seg.title = `${s.name}: ${money(s.amount)}`;
    fill.appendChild(seg);
  }

  const marks = milestones(d.goal);
  const scale = Math.max(d.goal, d.total);
  const ticks = $('ticks');
  const list = $('milestones');
  marks.forEach((m, i) => {
    const tick = el('span', 'rr-tick');
    tick.style.left = `${(m / scale) * 100}%`;
    ticks.appendChild(tick);
    const reached = d.total >= m;
    const item = el('li', reached ? 'reached' : '');
    item.append(el('strong', null, i === marks.length - 1 ? 'Goal' : short(m)));
    item.append(el('span', null, reached ? 'Reached' : short(m)));
    item.style.left = `${(m / scale) * 100}%`;
    list.appendChild(item);
  });

  const next = marks.find((m) => d.total < m);
  $('next').textContent = next
    ? `${money(next - d.total)} more reaches the ${money(next)} mark.`
    : 'We passed our goal. Every ticket from here is extra thanks.';

  $('asof').textContent = d.asOf ? `Updated ${d.asOf} Eastern.` : '';
}

function renderRows(target, items, label, swatch) {
  const max = Math.max(...items.map((i) => i.amount), 1);
  items.forEach((item, idx) => {
    const li = el('li');
    li.append(el('span', 'rr-rank', String(idx + 1)));
    const body = el('div', 'rr-row-body');
    const head = el('div', 'rr-row-head');
    const value = el('div', 'rr-bar-value');
    value.append(el('b', null, money(item.amount)), el('span', 'rr-pct', `${Math.round(data.total ? item.amount / data.total * 100 : 0)}%`));
    head.append(el('span', null, label(item)), value);
    const track = el('div', 'rr-track');
    const fill = el('span', `rr-track-fill ${swatch(item)}`);
    fill.style.setProperty('--w', `${(item.amount / max) * 100}%`);
    track.appendChild(fill);
    body.append(head, track);
    li.appendChild(body);
    target.appendChild(li);
  });
}

function renderLocked(d) {
  if (Array.isArray(d.winners) && d.winners.length) {
    const list = $('winner-list');
    for (const w of d.winners) {
      const li = el('li');
      if (w.video) {
        const video = el('video', 'rr-winner-video');
        video.controls = true; video.playsInline = true; video.preload = 'metadata';
        if (w.poster) video.poster = w.poster;
        video.setAttribute('aria-label', `Raffle winner announcement for ${w.drawing}`);
        const source = el('source'); source.src = w.video; source.type = 'video/mp4';
        video.append(source, el('p', null, `The winner is ${w.name}. ${w.prize}.`));
        li.append(video);
      }
      const caption = el('div', 'rr-winner-caption');
      caption.append(el('small', null, `THIS WEEK’S DRAWING · ${w.drawing}`), el('h2', null, w.name), el('p', null, `Winner of a ${w.prize}.`), el('p', 'rr-winner-thanks', 'Congratulations, and thank you to every family taking part.'));
      if (w.announcer) {
        const spotlight = el('div', 'rr-announcer');
        spotlight.append(
          el('small', null, 'OUR TOP TICKET SELLER THIS WEEK'),
          el('h3', null, `Take a bow, ${w.announcer.name}`),
          el('p', 'rr-announcer-class', `Class of ${w.announcer.classOf}`),
          el('p', 'rr-announcer-count', `${w.announcer.tickets.toLocaleString('en-US')} tickets sold`),
          el('p', null, 'A big RCAP thank-you for leading the way. Watch her announce this week’s winner.'),
        );
        caption.prepend(spotlight);
        $('celebration-title').textContent = `Take a bow, ${w.announcer.name.split(' ')[0]}.`;
      }
      li.append(caption);
      list.appendChild(li);
    }
    $('winners').hidden = false;
  }
}

renderProgress(data);
renderRows($('houses'), data.houses, (h) => h.name, (h) => `rr-${HOUSE_CLASS[h.name]}`);
renderRows($('classes'), data.classes, (c) => `Class of ${c.name}`, () => 'rr-class');
renderLocked(data);
const students = data.students || [];
function studentCard(student) {
  const item = el('li', 'rr-student-card');
  const info = el('div');
  info.append(el('h3', null, student.name), el('p', null, `Class of ${student.classOf || 'not given'} · ${student.house || 'House not given'}`));
  const standing = el('div', 'rr-standing');
  standing.append(el('strong', null, `${student.amount.toLocaleString('en-US')} tickets`), el('span', null, `No. ${student.rank} overall`));
  item.append(info, standing);
  return item;
}
for (const student of students.filter(student => student.rank <= 5)) $('top-students').append(studentCard(student));
function renderStudents() {
  const query = $('search').value.trim();
  const list = findStudentsByName(students, query);
  $('students').replaceChildren(...list.map(studentCard));
  $('count').textContent = query.length < 2 ? 'Your child’s progress will appear here.' : list.length ? `${list.length} ${list.length === 1 ? 'match' : 'matches'} found. Standing is based on all credited tickets, not just these results.` : 'No match yet. Check the first-name spelling. Newly credited tickets may appear in the next update.';
}
$('search').addEventListener('input', renderStudents);
renderStudents();
requestAnimationFrame(() => document.body.classList.add('rr-ready'));
