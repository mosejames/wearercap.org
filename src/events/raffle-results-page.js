import data from './raffle-results.json';
import { milestones, segmentWidths, money, selectStudents } from './raffleResults.js';

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
      caption.append(el('small', null, w.drawing), el('h2', null, w.name), el('p', null, `Winner of a ${w.prize}.`), el('p', 'rr-winner-thanks', 'Congratulations, and thank you to every family taking part.'));
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
$('summary-total').textContent = money(data.total);
$('summary-students').textContent = String(students.filter(s => s.amount > 0).length);
$('summary-house').textContent = data.houses[0]?.name || 'Pending';
$('summary-house-sub').textContent = `${money(data.houses[0]?.amount || 0)} raised`;
$('summary-class').textContent = `Class of ${data.classes[0]?.name || 'pending'}`;
$('summary-class-sub').textContent = `${money(data.classes[0]?.amount || 0)} raised`;
$('take').textContent = students.length ? `${students[0].name} leads the students. ${data.houses[0].name} leads the houses, and the Class of ${data.classes[0].name} leads the classes.` : '';
$('unassigned').textContent = data.unassigned ? `${money(data.unassigned)} has no house assigned and is included in the overall total. Entries without a named student are excluded from student rankings.` : '';
let sortKey = 'rank', ascending = true;
function renderStudents() {
  const list = selectStudents(students, $('search').value, sortKey, ascending);
  const body = $('students');
  body.replaceChildren();
  for (const student of list) {
    const row = el('tr', student.rank <= 5 ? 'rr-top-student' : '');
    row.append(el('td', 'rr-student-rank', String(student.rank)));
    const name = el('th', 'rr-student-name');
    name.scope = 'row';
    name.append(el('span', null, student.name), el('small', 'rr-mobile-meta', `Class of ${student.classOf || 'not given'} · ${student.house || 'House not given'}`));
    row.append(name, el('td', 'rr-desktop', student.classOf || 'Not given'), el('td', 'rr-desktop', student.house || 'Not given'));
    const amount = el('td', 'rr-numeric');
    const contribution = el('div', 'rr-contribution');
    const track = el('span', 'rr-student-track');
    const fill = el('span');
    fill.style.width = `${(student.amount / Math.max(students[0]?.amount || 0, 1)) * 100}%`;
    track.append(fill);
    contribution.append(track, el('b', null, money(student.amount)));
    amount.append(contribution); row.append(amount); body.append(row);
  }
  if (!list.length) {
    const row = el('tr'); const cell = el('td', 'rr-empty', 'No students match. Try a first name, class year or house.');
    cell.colSpan = 5; row.append(cell); body.append(row);
  }
  $('count').textContent = `${list.length} of ${students.length} students`;
  document.querySelectorAll('.rr-table thead th').forEach(th => {
    if (th.dataset.key === sortKey) th.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
    else th.removeAttribute('aria-sort');
  });
}
$('search').addEventListener('input', renderStudents);
document.querySelectorAll('.rr-table thead button').forEach(button => button.addEventListener('click', () => {
  const key = button.parentElement.dataset.key;
  if (key === sortKey) ascending = !ascending;
  else { sortKey = key; ascending = key !== 'amount'; }
  renderStudents();
}));
renderStudents();
requestAnimationFrame(() => document.body.classList.add('rr-ready'));
