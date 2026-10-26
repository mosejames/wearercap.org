// Fall Raffle results: turns the raffle committee's dashboard file into the
// public totals and approved abbreviated rankings.
//
// Privacy rule: full student names never enter public output. Aggregates are
// the default. Abbreviated student rankings require explicit release.

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

// Student-level output is opt-in. Both release options must be deliberate.
export function buildPublicResults({ rows, asOf }, { goal, releaseTopFive = false, releaseStudents = false, winners = [] } = {}) {
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

  if (releaseStudents) {
    result.students = rankStudents(rows
      .filter((r) => String(r.student || '').trim().toLowerCase() !== UNNAMED && publicName(r.student))
      .map((r) => ({ name: publicName(r.student), house: normalizeHouse(r.house), classOf: normalizeClass(r.cls), amount: r.n })));
  }

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

// Competition ranks are established before any search or column sorting.
export function rankStudents(students) {
  const sorted = [...students].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
  let rank = 0;
  return sorted.map((student, index) => {
    if (!index || student.amount !== sorted[index - 1].amount) rank = index + 1;
    return { ...student, rank };
  });
}

export function selectStudents(students, query = '', key = 'rank', ascending = true) {
  const q = query.trim().toLocaleLowerCase();
  return students.filter(s => !q || [s.name, s.classOf, s.house].join(' ').toLocaleLowerCase().includes(q))
    .sort((a, b) => {
      const comparison = ['rank', 'amount'].includes(key) ? a[key] - b[key] : String(a[key] || '').localeCompare(String(b[key] || ''));
      return (ascending ? comparison : -comparison) || a.rank - b.rank;
    });
}

// Name lookup is deliberate: no empty-query directory or class/house browsing.
export function findStudentsByName(students, query = '') {
  const normalize = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim().replace(/\s+/g, ' ');
  const q = normalize(query);
  if (q.length < 2 || !/\p{L}/u.test(q)) return [];
  return students.filter(student => normalize(student.name).startsWith(q)).sort((a, b) => a.rank - b.rank);
}

export function progressSegments(results, view = 'house') {
  const groups = view === 'class' ? [...results.classes].sort((a, b) => a.name.localeCompare(b.name)) : results.houses;
  return segmentWidths({ ...results, houses: groups });
}

// Compare private source rows before abbreviating names: public initials are not unique IDs.
export function weeklyDashboard(current, baseline) {
  const key = row => JSON.stringify([String(row.student || '').trim().toLowerCase(), normalizeClass(row.cls), normalizeHouse(row.house)]);
  const group = rows => {
    const entries = new Map();
    for (const row of rows) {
      const id = key(row);
      entries.set(id, { ...row, n: (entries.get(id)?.n || 0) + row.n });
    }
    return entries;
  };
  const before = group(baseline.rows);
  const now = group(current.rows);
  for (const [id, row] of before) {
    if ((now.get(id)?.n || 0) < row.n) throw new Error('A prior total decreased or a student identity changed. Reconcile the private sources before publishing weekly results.');
  }
  return { asOf: current.asOf, rows: [...now].map(([id, row]) => ({ ...row, n: row.n - (before.get(id)?.n || 0) })).filter(row => row.n > 0) };
}
