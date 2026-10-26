import data from './raffle-results.json';
import { segmentWidths, findStudentsByName } from './raffleResults.js';

const HOUSE_CLASS = { Amistad: 'amistad', Isibindi: 'isibindi', Altruismo: 'altruismo', 'Rêveur': 'reveur', Unassigned: 'unassigned' };
const $ = (key) => document.querySelector(`[data-rr="${key}"]`);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};
const HOUSE_COLORS = { Amistad: '#c8362f', Isibindi: '#1f9a68', Altruismo: '#141414', 'Rêveur': '#2d63c8' };
const CLASS_COLORS = ['#1b2c56', '#f7a81c', '#7281a3', '#b17b24', '#c8d0e0'];
function renderProgress(d) {
  const fill = $('segments');
  for (const s of segmentWidths(d)) {
    const seg = el('span', `rr-seg rr-${HOUSE_CLASS[s.name] || 'unassigned'}`);
    seg.style.setProperty('--w', `${s.width}%`);
    fill.appendChild(seg);
  }
  const progress = d.total >= d.goal ? 'Our shared goal has been reached.' : 'Together, we’re making progress toward our shared goal.';
  $('bar').setAttribute('aria-label', progress);
  $('next').textContent = progress;
  $('asof').textContent = d.asOf ? `Updated ${d.asOf} Eastern.` : '';
}
function renderPie(target, items, label, color) {
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const chart = el('div', 'rr-pie');
  chart.setAttribute('role', 'img');
  chart.setAttribute('aria-label', total ? `Relative contributions from ${items.map(label).join(', ')}. Each slice represents a share of our collective effort.` : 'Contributions will appear here after the next update.');
  let start = 0;
  const stops = items.map((item, index) => {
    const end = start + (total ? item.amount / total * 100 : 0);
    const stop = `${color(item, index)} ${start}% ${end}%`;
    start = end;
    return stop;
  });
  chart.style.background = total ? `conic-gradient(${stops.join(',')})` : '#e8dfcf';
  const legend = el('ul', 'rr-pie-legend');
  for (const [index, item] of items.entries()) {
    const row = el('li');
    const swatch = el('span', 'rr-pie-swatch');
    swatch.style.background = color(item, index);
    swatch.setAttribute('aria-hidden', 'true');
    row.append(swatch, el('span', null, label(item)));
    legend.append(row);
  }
  target.append(chart, legend);
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
renderPie($('houses'), data.houses, h => h.name, h => HOUSE_COLORS[h.name] || '#b9ad99');
renderPie($('classes'), [...data.classes].sort((a, b) => a.name.localeCompare(b.name)), c => `Class of ${c.name}`, (_, i) => CLASS_COLORS[i % CLASS_COLORS.length]);
renderLocked(data);
const students = data.students || [];
function studentCard(student, showTickets = false) {
  const item = el('li', 'rr-student-card');
  const info = el('div');
  info.append(el('h3', null, student.name), el('p', null, `Class of ${student.classOf || 'not given'} · ${student.house || 'House not given'}`));
  const standing = el('div', 'rr-standing');
  if (showTickets) standing.append(el('strong', null, `${student.amount.toLocaleString('en-US')} tickets`));
  standing.append(el(showTickets ? 'span' : 'strong', null, `No. ${student.rank} overall`));
  item.append(info, standing);
  return item;
}
for (const student of students.filter(student => student.rank <= 5)) $('top-students').append(studentCard(student));
function renderStudents() {
  const query = $('search').value.trim();
  const list = findStudentsByName(students, query);
  $('students').replaceChildren(...list.map(student => studentCard(student, true)));
  $('count').textContent = query.length < 2 ? 'Your child’s progress will appear here.' : list.length ? `${list.length} ${list.length === 1 ? 'match' : 'matches'} found. Standing is based on all credited tickets, not just these results.` : 'No match yet. Check the first-name spelling. Newly credited tickets may appear in the next update.';
}
$('search').addEventListener('input', renderStudents);
renderStudents();
requestAnimationFrame(() => document.body.classList.add('rr-ready'));
