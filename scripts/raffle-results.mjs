#!/usr/bin/env node
// Update the public Fall Raffle results page from the raffle committee's dashboard.
//
//   node scripts/raffle-results.mjs path/to/RCA-Fall-Raffle-2026.html
//
// Aggregates and approved abbreviated rankings only. Full names never enter
// the repo. Initial full-ranking approval uses --release-students; subsequent
// updates preserve that state. Use --withhold-students to remove rankings.
// Legacy top-five release:
//
//   node scripts/raffle-results.mjs path/to/file.html --release-top-five
//
// The goal and any approved weekly winners already in the data file are kept.
// Keep the committee's original file OUT of this repo.
import { readFileSync, writeFileSync, existsSync, realpathSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDashboard, buildPublicResults, weeklyDashboard, money } from '../src/events/raffleResults.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'src/events/raffle-results.json');
const args = process.argv.slice(2);
const source = args.find((a) => !a.startsWith('--'));
const releaseTopFive = args.includes('--release-top-five');

if (!source) {
  console.error('Usage: node scripts/raffle-results.mjs <dashboard.html> [--release-top-five]');
  process.exit(1);
}
if (realpathSync(source).startsWith(realpathSync(root) + '/')) {
  console.error('Keep the committee dashboard outside the repo. It contains every student name.');
  process.exit(1);
}

const previous = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {};
const parsed = parseDashboard(readFileSync(source, 'utf8'));
const results = buildPublicResults(parsed, {
  goal: previous.goal || 20000,
  releaseTopFive,
  releaseStudents: args.includes('--release-students') || (Array.isArray(previous.students) && !args.includes('--withhold-students')),
  winners: previous.winners || [],
});

// Publishing a dated edition is deliberate; an ordinary refresh changes overall data only.
const option = name => args.find(arg => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const week = option('week');
if (week) {
  const start = option('start'), end = option('end'), nextPublication = option('next');
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (![week, start, end, nextPublication].every(validDate) || start > end || end >= week || week >= nextPublication) throw new Error('Supply valid ordered --start, --end, --week (publication date), and --next dates.');
  const archive = resolve(root, `src/events/raffle-weeks/${week}.json`);
  if (existsSync(archive)) throw new Error('This weekly edition already exists. Review any correction explicitly; do not overwrite history.');
  const baseline = option('baseline');
  if (!baseline) throw new Error('A new weekly edition requires --baseline=/path/to/prior-cutoff-dashboard.html. Cumulative totals cannot stand in for weekly results.');
  if (realpathSync(baseline).startsWith(realpathSync(root) + '/')) throw new Error('Keep the baseline dashboard outside the repository.');
  const prior = parseDashboard(readFileSync(baseline, 'utf8'));
  const priorDate = new Date(`${start}T12:00:00Z`); priorDate.setUTCDate(priorDate.getUTCDate() - 1);
  const cutoff = date => `${new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })} at 11:59 p.m.`;
  if (parsed.asOf !== cutoff(`${end}T12:00:00Z`) || prior.asOf !== cutoff(priorDate)) throw new Error('Source timestamps must match the new and previous Saturday cutoffs at 11:59 p.m. Verify the reporting period.');
  const periodData = weeklyDashboard(parsed, prior);
  const weekly = buildPublicResults(periodData, { goal: results.goal, releaseStudents: Array.isArray(results.students), releaseTopFive, winners: [] });
  mkdirSync(dirname(archive), { recursive: true });
  writeFileSync(archive, JSON.stringify({ period: { id: week, start, end, published: week, nextPublication }, results: weekly }, null, 2) + '\n');
  console.log(`Created weekly edition ${week}. Add only the approved winner and announcer to that edition before release.`);
}
writeFileSync(out, JSON.stringify(results, null, 2) + '\n');
console.log(`Updated ${out}`);
console.log(`As of: ${results.asOf || '(no date found)'}`);
console.log(`Total: ${money(results.total)} of ${money(results.goal)} goal`);
console.log(`Houses: ${results.houses.map((h) => `${h.name} ${money(h.amount)}`).join(', ')}`);
console.log(`Top five: ${results.topFive ? 'RELEASED' : 'locked'}`);
console.log(`Student rankings: ${results.students ? results.students.length : 'withheld'}`);
console.log(`Winners shown: ${results.winners.length}`);
