import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import {
  parseDashboard, buildPublicResults, publicName, cleanAsOf, normalizeHouse,
  weeklyDashboard, segmentWidths, progressSegments, milestones, rankStudents, selectStudents, findStudentsByName,
} from './raffleResults.js';
import published from './raffle-results.json';

const rows = [
  { student: 'Ryleigh Baker', cls: '2031', house: 'Isibindi', n: 1217 },
  { student: 'Kamden White', cls: '2028', house: 'Amistad', n: 216 },
  { student: 'Ian Watson', cls: '2030', house: 'Reveur', n: 190 },
  { student: 'Xavier Carter Jr.', cls: '2028', house: 'Reveur', n: 125 },
  { student: 'Gywinn (Jr) Lewis', cls: '2030', house: 'Amistad', n: 111 },
  { student: 'Karson', cls: '2031', house: 'Altruismo', n: 111 },
  { student: 'Drew Thomas', cls: '2031', house: 'Altruismo', n: 3 },
  { student: 'No student named', cls: 'Not given', house: 'Not given', n: 2 },
];
const html = `<p class="asof">Updates as of Saturday, October 24th at 11:59PM.</p>
<script>const DATA = ${JSON.stringify(rows)};\nconst NONE = 'x';</script>`;

describe('reading the committee dashboard', () => {
  it('pulls the rows and the as-of line from the dashboard file', () => {
    const parsed = parseDashboard(html);
    expect(parsed.rows).toHaveLength(8);
    expect(parsed.asOf).toBe('Saturday, October 24 at 11:59 p.m.');
  });
  it('fails loudly when the format changes instead of publishing zeros', () => {
    expect(() => parseDashboard('<p>no data</p>')).toThrow(/DATA block/);
    expect(() => parseDashboard('const DATA = [{"n":-4}];')).toThrow(/Unexpected amount/);
  });
});

describe('public results', () => {
  const results = buildPublicResults(parseDashboard(html), { goal: 20000 });

  it('reconciles houses and classes with the total', () => {
    expect(results.total).toBe(1975);
    const houses = results.houses.reduce((s, h) => s + h.amount, 0);
    const classes = results.classes.reduce((s, c) => s + c.amount, 0);
    expect(houses + results.unassigned).toBe(results.total);
    expect(classes + results.unassigned).toBe(results.total);
  });

  it('spells Rêveur with its accent and keeps all four houses', () => {
    expect(results.houses.map((h) => h.name).sort()).toEqual(['Altruismo', 'Amistad', 'Isibindi', 'Rêveur']);
    expect(normalizeHouse('Alturismo')).toBe('Altruismo');
  });

  it('publishes no student names while the top five is locked', () => {
    expect(results.topFive).toBeNull();
    const text = JSON.stringify(results);
    for (const r of rows) expect(text).not.toContain(r.student.split(' ')[0]);
  });

  it('shows first name and last initial once the top five is released', () => {
    const released = buildPublicResults(parseDashboard(html), { goal: 20000, releaseTopFive: true });
    expect(released.topFive.map((s) => s.name)).toEqual(['Ryleigh B.', 'Kamden W.', 'Ian W.', 'Xavier C.', 'Gywinn L.', 'Karson']);
    expect(JSON.stringify(released)).not.toContain('Baker');
  });
});

describe('name and date formatting', () => {
  it('handles suffixes, parentheticals and single names', () => {
    expect(publicName('Mose James IV')).toBe('Mose J.');
    expect(publicName('Dean-Arrington Jones')).toBe('Dean-Arrington J.');
    expect(publicName('Karson')).toBe('Karson');
    expect(publicName('  ')).toBeNull();
  });
  it('writes times the RCAP way', () => {
    expect(cleanAsOf('Updates as of Wednesday, November 4th at 11AM.')).toBe('Wednesday, November 4 at 11 a.m.');
    expect(cleanAsOf('Updates as of Friday, November 6th at 9:30am.')).toBe('Friday, November 6 at 9:30 a.m.');
  });
});

describe('progress bar math', () => {
  it('fills to total over goal, and never overflows past the goal', () => {
    const under = segmentWidths({ goal: 1000, total: 500, unassigned: 0, houses: [{ name: 'Amistad', amount: 500 }] });
    expect(under[0].width).toBe(50);
    const over = segmentWidths({ goal: 1000, total: 2000, unassigned: 0, houses: [{ name: 'Amistad', amount: 2000 }] });
    expect(over[0].width).toBe(100);
    expect(milestones(20000)).toEqual([5000, 10000, 15000, 20000]);
  });
});

describe('what is actually published', () => {
  it('ships only approved abbreviated student data and approved winner announcements', () => {
    expect(published.topFive).toBeNull();
    expect(published.winners).toEqual([expect.objectContaining({name: 'Sherinda Tolbert', prize: '$75 Amazon gift card', drawing: 'Sunday, October 25'})]);
    for (const winner of published.winners) {
      if (winner.announcer) expect(winner.announcer.name).toMatch(/^[\p{L}’-]+(?: [\p{L}]\.)?$/u);
    }
    expect(Object.keys(published).sort()).toEqual(['asOf', 'goal', 'total', 'unassigned', 'houses', 'classes', 'topFive', 'winners', 'students'].sort());
    for (const group of [published.houses, published.classes]) {
      for (const row of group) expect(Object.keys(row).sort()).toEqual(['amount', 'name']);
    }
    for (const student of published.students) {
      expect(Object.keys(student).sort()).toEqual(['name', 'house', 'classOf', 'amount', 'rank'].sort());
      expect(student.name).toMatch(/^[\p{L}’-]+(?: [\p{L}]\.)?$/u);
    }
    for (const row of rows.filter(r => r.student.includes(' ') && r.student !== 'No student named')) expect(JSON.stringify(published)).not.toContain(row.student);
  });
  it('keeps the page out of search and off the menus', () => {
    const page = readFileSync(`${process.cwd()}/events/2026/fall-raffle/results/index.html`, 'utf8');
    expect(page).toContain('noindex');
    expect(page).not.toMatch(/—/);
    expect(page).not.toMatch(/[^<]!/);
  });
});

describe('approved full rankings', () => {
  const ranked = rankStudents([
    { name: 'Avery T.', classOf: '2030', house: 'Amistad', amount: 20 },
    { name: 'Blair S.', classOf: '2031', house: 'Rêveur', amount: 50 },
    { name: 'Casey J.', classOf: '2030', house: 'Isibindi', amount: 20 },
    { name: 'Devon P.', classOf: '2029', house: 'Altruismo', amount: 5 },
  ]);
  it('gives tied totals equal ranks and skips the next position', () => {
    expect(ranked.map(s => s.rank)).toEqual([1, 2, 2, 4]);
  });
  it('keeps overall ranks when searching or changing column order', () => {
    expect(selectStudents(ranked, 'Casey')[0].rank).toBe(2);
    expect(selectStudents(ranked, '2030')).toHaveLength(2);
    expect(selectStudents(ranked, 'rêveur')[0].name).toBe('Blair S.');
    expect(selectStudents(ranked, '', 'amount', true).map(s => s.rank)).toEqual([4, 2, 2, 1]);
    expect(selectStudents(ranked, 'no match')).toEqual([]);
  });
  it('requires explicit approval to include abbreviated rankings', () => {
    const locked = buildPublicResults(parseDashboard(html), { goal: 20000 });
    expect(locked.students).toBeUndefined();
    const approved = buildPublicResults(parseDashboard(html), { goal: 20000, releaseStudents: true });
    expect(approved.students).toHaveLength(7);
    expect(approved.students[0].name).toBe('Ryleigh B.');
    expect(JSON.stringify(approved.students)).not.toContain('Baker');
    expect(approved.winners).toEqual([]);
  });
});

describe('individual name lookup', () => {
  const students = [
    { name: 'Avery T.', classOf: '2030', house: 'Amistad', amount: 8, rank: 12 },
    { name: 'Avery S.', classOf: '2031', house: 'Rêveur', amount: 10, rank: 8 },
    { name: 'Élodie J.', classOf: '2030', house: 'Amistad', amount: 5, rank: 18 },
  ];
  it('never returns a directory for empty, short, class or house searches', () => {
    for (const query of ['', ' ', 'a', '2030', 'Amistad', '*']) expect(findStudentsByName(students, query)).toEqual([]);
  });
  it('matches first names and preserves overall standing and same-name choices', () => {
    expect(findStudentsByName(students, '  AVERY  ').map(s => s.rank)).toEqual([8, 12]);
    expect(findStudentsByName(students, 'Avery T.')[0].rank).toBe(12);
    expect(findStudentsByName(students, 'elodie')[0].rank).toBe(18);
    expect(findStudentsByName(students, 'no match')).toEqual([]);
  });
});

describe('shared progress views', () => {
  it('retains the same goal progress including unassigned contributions in both views', () => {
    for (const view of ['house', 'class']) {
      const segments = progressSegments(published, view);
      expect(segments.reduce((sum, s) => sum + s.amount, 0)).toBe(published.total);
      expect(segments.reduce((sum, s) => sum + s.width, 0)).toBeCloseTo(published.total / published.goal * 100);
      expect(segments.filter(s => s.name === 'Unassigned')).toHaveLength(1);
    }
    expect(progressSegments(published, 'class').filter(s => s.name !== 'Unassigned').map(s => s.name)).toEqual(['2027','2028','2029','2030','2031']);
  });
});


describe('dated weekly editions', () => {
  it('ranks only new contributions and matches private full names before abbreviation', () => {
    const before = { rows: [{student:'Avery Taylor',cls:'2030',house:'Amistad',n:100},{student:'Avery Thomas',cls:'2030',house:'Amistad',n:5}] };
    const current = { asOf:'new cutoff', rows:[{...before.rows[0],n:103},{...before.rows[1],n:25},{student:'Blair Smith',cls:'2031',house:'Reveur',n:12}] };
    const weekly = buildPublicResults(weeklyDashboard(current,before),{goal:20000,releaseStudents:true});
    expect(weekly.total).toBe(35);
    expect(weekly.students.map(s=>s.amount)).toEqual([20,12,3]);
    expect(weekly.students[0].name).toBe('Avery T.');
    expect(weekly.winners).toEqual([]);
    expect(before.rows[0].n).toBe(100);
  });
  it('blocks corrections or missing prior rows instead of silently changing weekly rankings', () => {
    const prior = {rows:[{student:'Avery Taylor',cls:'2030',house:'Amistad',n:100}]};
    expect(()=>weeklyDashboard({rows:[]},prior)).toThrow(/Reconcile/);
    expect(()=>weeklyDashboard({rows:[{...prior.rows[0],n:90}]},prior)).toThrow(/Reconcile/);
    expect(weeklyDashboard(prior,prior).rows).toEqual([]);
  });
  it('keeps archived student names abbreviated and totals reconciled', () => {
    const directory = `${process.cwd()}/src/events/raffle-weeks`;
    for (const file of readdirSync(directory).filter(f=>f.endsWith('.json'))) {
      const {period,results} = JSON.parse(readFileSync(`${directory}/${file}`,'utf8'));
      expect(file).toBe(`${period.id}.json`);
      expect(period.end < period.published).toBe(true);
      for (const student of results.students || []) {
        expect(student.name).toMatch(/^[\p{L}’-]+(?: [\p{L}]\.)?$/u);
        expect(Object.keys(student).sort()).toEqual(['amount','classOf','house','name','rank']);
      }
      for (const row of rows.filter(r=>r.student.includes(' ') && r.student !== 'No student named')) expect(JSON.stringify(results)).not.toContain(row.student);
      expect(results.houses.reduce((n,h)=>n+h.amount,results.unassigned)).toBe(results.total);
    }
  });
});
