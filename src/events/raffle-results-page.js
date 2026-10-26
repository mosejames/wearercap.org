import data from './raffle-results.json';
import { progressSegments, findStudentsByName } from './raffleResults.js';

const $ = (key) => document.querySelector(`[data-rr="${key}"]`);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};
const HOUSE_COLORS = { Amistad: '#c8362f', Isibindi: '#1f9a68', Altruismo: '#141414', 'Rêveur': '#2d63c8' };
const CLASS_COLORS = ['#58729a', '#7790b0', '#98adc5', '#b9c9dc', '#e0e7ef'];
function renderProgress(d, view = 'house') {
  const fill = $('segments');
  const legend = $('progress-legend');
  fill.replaceChildren(); legend.replaceChildren();
  $('progress-toggle').dataset.view = view;
  const segments = progressSegments(d, view);
  segments.forEach((s, index) => {
    const color = s.name === 'Unassigned' ? '#b9ad99' : view === 'house' ? HOUSE_COLORS[s.name] : CLASS_COLORS[index % CLASS_COLORS.length];
    const label = s.name === 'Unassigned' ? 'Awaiting a group' : view === 'class' ? `Class of ${s.name}` : s.name;
    const seg = el('span', 'rr-seg');
    seg.style.setProperty('--w', `${s.width}%`);
    seg.style.background = color;
    fill.appendChild(seg);
    const item = el('li');
    const swatch = el('span', 'rr-progress-swatch');
    swatch.style.background = color; swatch.setAttribute('aria-hidden', 'true');
    item.append(swatch, el('span', null, label)); legend.append(item);
  });
  const progress = d.total >= d.goal ? 'Our shared goal has been reached.' : 'Together, we’re making progress toward our shared goal.';
  $('bar').setAttribute('aria-label', `${progress} Colored sections show contributions by ${view}.`);
  $('next').textContent = progress;
  $('progress-explanation').textContent = `Each colored section shows how a ${view} has contributed to our shared progress. The space ahead is what we’re working toward together.`;
  $('asof').textContent = d.asOf ? `Updated ${d.asOf} Eastern.` : '';
}
document.querySelectorAll('input[name="progress-view"]').forEach(input => input.addEventListener('change', () => {
  if (input.checked) renderProgress(data, input.value);
}));

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
