import data from './raffle-results.json';
import { milestones, segmentWidths, money } from './raffleResults.js';

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
    head.append(el('span', null, label(item)), el('b', null, money(item.amount)));
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
      li.append(el('strong', null, w.name), el('span', null, [w.drawing, w.prize].filter(Boolean).join(' · ')));
      list.appendChild(li);
    }
    $('winners').hidden = false;
  }
  if (Array.isArray(d.topFive) && d.topFive.length) {
    renderRows(
      $('top-list'),
      d.topFive,
      (s) => [s.name, s.classOf && `Class of ${s.classOf}`].filter(Boolean).join(' · '),
      (s) => `rr-${HOUSE_CLASS[s.house] || 'unassigned'}`,
    );
    $('top').hidden = false;
  }
}

renderProgress(data);
renderRows($('houses'), data.houses, (h) => h.name, (h) => `rr-${HOUSE_CLASS[h.name]}`);
renderRows($('classes'), data.classes, (c) => `Class of ${c.name}`, () => 'rr-class');
renderLocked(data);
requestAnimationFrame(() => document.body.classList.add('rr-ready'));
