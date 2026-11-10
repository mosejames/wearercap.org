// @vitest-environment jsdom
import {beforeEach,expect,it,vi} from 'vitest';
import fs from 'node:fs';
const html=fs.readFileSync('events/2026/fall-raffle/results/index.html','utf8');
beforeEach(()=>{vi.resetModules();document.documentElement.innerHTML=html;});
it('labels the weekly snapshot and links to cumulative results without losing the week',async()=>{
 history.replaceState({},'', '/events/2026/fall-raffle/results/?week=2026-11-08');
 await import('./raffle-results-page.js');
 expect(document.querySelector('[data-rr="raised-label"]').textContent).toBe('Raised this week');
 expect(document.querySelector('[data-rr="raised"]').textContent).toBe('$3,030');
 expect(document.querySelector('[data-rr="raised-overall-link"]').getAttribute('href')).toBe('?view=overall&week=2026-11-08#raised-progress');
});
it('labels cumulative results and provides the matching weekly return link',async()=>{
 history.replaceState({},'', '/events/2026/fall-raffle/results/?view=overall&week=2026-11-08');
 await import('./raffle-results-page.js');
 expect(document.querySelector('[data-rr="raised-label"]').textContent).toBe('Raised overall');
 expect(document.querySelector('[data-rr="raised"]').textContent).toBe('$9,746');
 expect(document.querySelector('[data-rr="raised-week-link"]').getAttribute('href')).toBe('?week=2026-11-08#raised-progress');
 expect(document.querySelector('[data-rr="raised-overall-link"]').getAttribute('aria-current')).toBe('page');
});
