import overallData from './raffle-results.json';
const editions = Object.values(import.meta.glob('./raffle-weeks/*.json', { eager: true, import: 'default' })).sort((a, b) => b.period.id.localeCompare(a.period.id));
const params = new URLSearchParams(location.search);
const overall = params.get('view') === 'overall';
const requestedWeek = params.get('week');
const edition = editions.find(item => item.period.id === requestedWeek) || editions[0];
const data = overall ? overallData : edition.results;
const archive = Boolean(requestedWeek) && !overall;
const progressData = archive ? data : overallData;
const weekNumber = editions.length - editions.indexOf(edition);
const dateLabel = value => new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const periodLabel = period => period.start ? `${dateLabel(period.start)} to ${dateLabel(period.end)}` : `Opening week, through ${dateLabel(period.end)}`;
import { studentCard } from './raffleStudentCard.js';

const $ = (key) => document.querySelector(`[data-rr="${key}"]`);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};
const HOUSE_COLORS = { Amistad: '#c8362f', Isibindi: '#1f9a68', Altruismo: '#141414', 'Rêveur': '#2d63c8' };
const CLASS_COLORS = ['#58729a', '#7790b0', '#98adc5', '#b9c9dc', '#e0e7ef'];
const money = value => '$' + value.toLocaleString('en-US');
function renderProgress(d, view = 'house') {
  $('progress-toggle').dataset.view = view;
  const rows = view === 'house' ? d.houses : d.classes;
  const max = Math.max(1, ...rows.map(row => row.amount));
  $('group-rows').replaceChildren(...rows.map((row, index) => {
    const li = el('li');
    const label = view === 'class' ? `Class of ${row.name}` : row.name;
    const track = el('span', 'rr-compare-track');
    const fill = el('span');
    fill.style.width = `${row.amount / max * 100}%`;
    fill.style.background = view === 'house' ? HOUSE_COLORS[row.name] : CLASS_COLORS[index % CLASS_COLORS.length];
    track.setAttribute('aria-hidden', 'true'); track.append(fill);
    const count = el('strong', 'rr-group-count', row.amount.toLocaleString('en-US'));
    count.append(el('small', null, 'tickets'));
    li.append(el('span', 'rr-group-name', label), track, count);
    return li;
  }));
  $('group-period').textContent = overall ? `All credited tickets through ${d.asOf} Eastern.` : `Week ${weekNumber} contributions through ${dateLabel(edition.period.end)}.`;
}
document.querySelectorAll('input[name="progress-view"]').forEach(input => input.addEventListener('change', () => {
  if (input.checked) renderProgress(data, input.value);
}));
const percent = Math.round(progressData.total / progressData.goal * 100);
$('raised').textContent = money(progressData.total);
$('percent').textContent = `${percent}%`;
$('remaining').textContent = progressData.total < progressData.goal ? `${money(progressData.goal - progressData.total)} to go. Let’s keep moving together.` : 'Our goal is reached. Let’s keep the good going.';
$('goal-fill').style.width = `${Math.min(100, percent)}%`;
$('goal-ring').style.setProperty('--progress', `${Math.min(100, percent)}%`);
$('goal-meter').setAttribute('aria-valuenow', String(progressData.total));
$('goal-meter').setAttribute('aria-valuetext', `${money(progressData.total)} raised of our ${money(progressData.goal)} goal`);
$('asof').textContent = archive ? `Week ${weekNumber}, through ${dateLabel(edition.period.end)}. Posted results, not live tracking.` : `Updated ${progressData.asOf} Eastern. Posted results, not live tracking.`;
$(overall ? 'overall-tab' : 'weekly-tab').setAttribute('aria-current', 'page');

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
      caption.append(el('small', null, `WEEK ${weekNumber} DRAWING · ${w.drawing}`), el('h2', null, w.name), el('p', null, `Winner of a ${w.prize}.`), el('p', 'rr-winner-thanks', 'Congratulations, and thank you to every family taking part.'));
      if (w.announcer) {
        const spotlight = el('div', 'rr-announcer');
        spotlight.append(
          el('small', null, `WEEK ${weekNumber} RAFFLE STAR`),
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

const title = overall ? 'Overall progress. Weekly celebrations.' : `Week ${weekNumber}: our raffle stars`;
$('edition-title').textContent = title;
const snapshotCutoff = overall ? `${data.asOf} Eastern` : `${dateLabel(edition.period.end)} at 11:59 p.m. Eastern`;
$('snapshot-top').textContent = `Results through ${snapshotCutoff}.`;
$('edition-kicker').textContent = overall ? 'THE FULL RAFFLE SO FAR' : 'WEEKLY RAFFLE RESULTS';
$('edition-dates').textContent = overall ? `All credited tickets through ${data.asOf} Eastern.` : `${edition.period.start ? 'Reporting period' : 'First reporting period'}: ${periodLabel(edition.period)}. Cutoff: 11:59 p.m. Eastern. Published ${dateLabel(edition.period.published)}.`;
$('edition-note').textContent = 'Each week brings a fresh top five. We celebrate that week’s contributions, so every family has another chance to shine.';
$('edition-next').textContent = `Who will be our Week ${weekNumber + 1} raffle stars? Find out ${dateLabel(edition.period.nextPublication)}.`;
if (requestedWeek && !editions.some(item => item.period.id === requestedWeek) && !overall) $('edition-note').textContent = 'That weekly update is not available yet. You’re viewing the latest published results.';
const addLink = (target, text, href) => { const a = el('a', null, text); a.href = href; target.append(a); };
if (overall || archive || edition !== editions[0]) addLink($('edition-links'), 'Back to the latest weekly results', '?');
const older = editions[editions.indexOf(edition) + 1];
if (!overall && older) addLink($('edition-links'), 'View the previous week', `?week=${older.period.id}`);
for (const item of editions) { const li = el('li'); addLink(li, periodLabel(item.period), `?week=${item.period.id}`); $('history').append(li); }
document.querySelector('#rr-top-title').textContent = overall ? 'Overall raffle stars' : `Week ${weekNumber} top five raffle stars`;
if (overall) $('top-note').textContent = 'All credited tickets so far. Weekly recognition is based on each week separately.';
renderProgress(data);
if (!overall) renderLocked(data);
const students = data.students || [];

for (const student of students.filter(student => student.rank <= 5)) {
  const card = studentCard(student, false, overall, weekNumber);
  const medal = el('span', `rr-medal rr-medal-${student.rank}`, String(student.rank));
  medal.setAttribute('aria-label', `Rank ${student.rank}`);
  card.prepend(medal);
  $('top-students').append(card);
}
requestAnimationFrame(() => document.body.classList.add('rr-ready'));
