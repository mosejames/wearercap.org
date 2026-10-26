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
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDashboard, buildPublicResults, money } from '../src/events/raffleResults.js';

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

writeFileSync(out, JSON.stringify(results, null, 2) + '\n');
console.log(`Updated ${out}`);
console.log(`As of: ${results.asOf || '(no date found)'}`);
console.log(`Total: ${money(results.total)} of ${money(results.goal)} goal`);
console.log(`Houses: ${results.houses.map((h) => `${h.name} ${money(h.amount)}`).join(', ')}`);
console.log(`Top five: ${results.topFive ? 'RELEASED' : 'locked'}`);
console.log(`Student rankings: ${results.students ? results.students.length : 'withheld'}`);
console.log(`Winners shown: ${results.winners.length}`);
