// Fall Raffle results: turns the raffle committee's dashboard file into the
// small, aggregate-only data the public results page shows.
//
// Privacy rule: the full student list never leaves this module. Only totals,
// house totals and class totals are published. The top five (first name and
// last initial) appear only when explicitly released.

export const HOUSES = ['Amistad', 'Isibindi', 'Altruismo', 'Rêveur'];

const HOUSE_ALIASES = {
  amistad: 'Amistad',
  isibindi: 'Isibindi',
  altruismo: 'Altruismo',
  alturismo: 'Altruismo',
  reveur: 'Rêveur',
  'rêveur': 'Rêveur',
};

const UNNAMED = 'no student named';
const SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v', '(jr)', '(sr)']);

export function normalizeHouse(value) {
  const key = String(value || '').trim().toLowerCase();
  return HOUSE_ALIASES[key] || null;
}

export function normalizeClass(value) {
  const match = String(value || '').match(/\b(20\d\d)\b/);
  return match ? match[1] : null;
}

// "Ryleigh Baker" -> "Ryleigh B."; suffixes and parentheticals are skipped.
export function publicName(full) {
  const parts = String(full || '')
    .replace(/\([^)]*\)/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !SUFFIXES.has(p.toLowerCase()));
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1].replace(/[^\p{L}]/gu, '');
  return last ? `${parts[0]} ${last[0].toUpperCase()}.` : parts[0];
}

// "Updates as of Saturday, October 24th at 11:59PM." -> "Saturday, October 24 at 11:59 p.m."
export function cleanAsOf(text) {
  if (!text) return null;
  return String(text)
    .replace(/^\s*updates?\s+as\s+of\s+/i, '')
    .replace(/\.\s*$/, '')
    .replace(/(\d)(st|nd|rd|th)\b/gi, '$1')
    .replace(/\b(\d{1,2}(?::\d{2})?)\s*([AaPp])\.?\s*[Mm]\b\.?/g, (_, t, ap) => `${t} ${ap.toLowerCase()}.m.`)
    .trim();
}

// Reads the committee's dashboard HTML (the file built with Claude) and returns
// the raw rows plus its "as of" line. Throws if the expected data is missing,
// so a changed format fails loudly instead of publishing zeros.
export function parseDashboard(html) {
  const data = String(html).match(/const\s+DATA\s*=\s*(\[[\s\S]*?\])\s*;/);
  if (!data) throw new Error('Could not find the raffle DATA block in the dashboard file.');
  const rows = JSON.parse(data[1]);
  if (!Array.isArray(rows) || !rows.length) throw new Error('The dashboard DATA block is empty.');
  for (const r of rows) {
    if (typeof r.n !== 'number' || !Number.isFinite(r.n) || r.n < 0) {
      throw new Error('Unexpected amount in dashboard row. No data was published.');
    }
  }
  const asOf = String(html).match(/class="asof"[^>]*>([^<]*)</);
  return { rows, asOf: asOf ? cleanAsOf(asOf[1]) : null };
}

function ranked(list) {
  return list.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}

// Aggregate-only public data. `releaseTopFive` must be set deliberately.
export function buildPublicResults({ rows, asOf }, { goal, releaseTopFive = false, winners = [] } = {}) {
  const total = rows.reduce((sum, r) => sum + r.n, 0);
  const houseTotals = Object.fromEntries(HOUSES.map((h) => [h, 0]));
  const classTotals = {};
  let unassigned = 0;

  for (const r of rows) {
    const house = normalizeHouse(r.house);
    const cls = normalizeClass(r.cls);
    if (house) houseTotals[house] += r.n;
    else unassigned += r.n;
    if (cls) classTotals[cls] = (classTotals[cls] || 0) + r.n;
  }

  const result = {
    asOf,
    goal,
    total,
    unassigned,
    houses: ranked(HOUSES.map((name) => ({ name, amount: houseTotals[name] }))),
    classes: ranked(Object.entries(classTotals).map(([year, amount]) => ({ name: year, amount }))),
    topFive: null,
    winners: Array.isArray(winners) ? winners : [],
  };

  if (releaseTopFive) {
    const named = rows
      .filter((r) => String(r.student || '').trim().toLowerCase() !== UNNAMED && publicName(r.student))
      .sort((a, b) => b.n - a.n);
    const cutoff = named.length >= 5 ? named[4].n : 0;
    result.topFive = named
      .filter((r) => r.n >= cutoff)
      .map((r) => ({
        name: publicName(r.student),
        house: normalizeHouse(r.house),
        classOf: normalizeClass(r.cls),
        amount: r.n,
      }));
  }

  return result;
}

export function milestones(goal) {
  return [0.25, 0.5, 0.75, 1].map((f) => Math.round(goal * f));
}

// Widths (in percent of the bar) for each house segment, scaled so the bar
// fills to total/goal and never overflows once the goal is passed.
export function segmentWidths(results) {
  const scale = Math.max(results.goal, results.total) || 1;
  const segments = results.houses
    .filter((h) => h.amount > 0)
    .map((h) => ({ name: h.name, amount: h.amount, width: (h.amount / scale) * 100 }));
  if (results.unassigned > 0) {
    segments.push({ name: 'Unassigned', amount: results.unassigned, width: (results.unassigned / scale) * 100 });
  }
  return segments;
}

export const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
