import overallData from './raffle-results.json';
const editions = Object.values(import.meta.glob('./raffle-weeks/*.json', { eager: true, import: 'default' })).sort((a, b) => b.period.id.localeCompare(a.period.id));
const params = new URLSearchParams(location.search);
const overall = params.get('view') === 'overall';
const requestedWeek = params.get('week');
const edition = editions.find(item => item.period.id === requestedWeek) || editions[0];
const data = overall ? overallData : edition.results;
const dateLabel = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const periodLabel = period => period.start ? `${dateLabel(period.start)} to ${dateLabel(period.end)}` : `Opening week, through ${dateLabel(period.end)}`;
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
  $('asof').textContent = overall ? `All weeks through ${d.asOf} Eastern.` : `Contributions for ${periodLabel(edition.period)}. This view shows only this reporting period’s part of our shared goal.`;
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
          el('small', null, 'THIS WEEK’S RAFFLE STAR'),
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

const title = overall ? 'Overall raffle progress' : periodLabel(edition.period);
$('edition-title').textContent = title;
$('edition-kicker').textContent = overall ? 'THE FULL RAFFLE SO FAR' : 'WEEKLY RAFFLE RESULTS';
$('edition-dates').textContent = overall ? `All credited tickets through ${data.asOf} Eastern.` : `${edition.period.start ? 'Reporting period' : 'First reporting period'}: ${periodLabel(edition.period)}. Cutoff: 11:59 p.m. Eastern. Published ${dateLabel(edition.period.published)}.`;
$('edition-note').textContent = overall ? 'Every week adds to our shared effort. This view brings together all credited tickets so far.' : 'A fresh week. A fresh top five. Each Sunday, we celebrate that week’s contributions. Familiar faces or new names, everyone has another chance to shine.';
$('edition-next').textContent = overall ? '' : `Next update: ${dateLabel(edition.period.nextPublication)}. The top five will reflect the next reporting period only.`;
if (requestedWeek && !editions.some(item => item.period.id === requestedWeek) && !overall) $('edition-note').textContent = 'That weekly update is not available yet. You’re viewing the latest published results.';
const addLink = (target, text, href) => { const a = el('a', null, text); a.href = href; target.append(a); };
if (overall || edition !== editions[0]) addLink($('edition-links'), 'Back to the latest weekly results', '?');
const older = editions[editions.indexOf(edition) + 1];
if (!overall && older) addLink($('edition-links'), 'View the previous week', `?week=${older.period.id}`);
for (const item of editions) { const li = el('li'); addLink(li, periodLabel(item.period), `?week=${item.period.id}`); $('history').append(li); }
if (overall) {
  document.querySelector('#rr-top-title').textContent = 'Overall top five';
  document.querySelector('#rr-lookup-title').textContent = 'Find your child’s overall progress';
  $('top-note').textContent = 'Based on all credited tickets so far. Tied totals share a place.';
  $('lookup-note').textContent = 'Type their first name to see their tickets and overall standing.';
}
renderProgress(data);
if (!overall) renderLocked(data);
const students = data.students || [];
function studentCard(student, showTickets = false) {
  const item = el('li', 'rr-student-card');
  const info = el('div');
  info.append(el('h3', null, student.name), el('p', null, `Class of ${student.classOf || 'not given'} · ${student.house || 'House not given'}`));
  const standing = el('div', 'rr-standing');
  if (showTickets) standing.append(el('strong', null, `${student.amount.toLocaleString('en-US')} tickets`));
  standing.append(el(showTickets ? 'span' : 'strong', null, `No. ${student.rank} ${overall ? 'overall' : 'this week'}`));
  item.append(info, standing);
  return item;
}
for (const student of students.filter(student => student.rank <= 5)) $('top-students').append(studentCard(student));
function renderStudents() {
  const query = $('search').value.trim();
  const list = findStudentsByName(students, query);
  $('students').replaceChildren(...list.map(student => studentCard(student, true)));
  $('count').textContent = query.length < 2 ? 'Your child’s progress will appear here.' : list.length ? `${list.length} ${list.length === 1 ? 'match' : 'matches'} found. Standing is based on ${overall ? 'all credited tickets' : 'tickets credited in this reporting period'}, not just these search results.` : 'No match yet. Check the first-name spelling. Newly credited tickets may appear in the next update.';
}
$('search').addEventListener('input', renderStudents);
renderStudents();
requestAnimationFrame(() => document.body.classList.add('rr-ready'));
