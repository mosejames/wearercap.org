import {describe,it,expect} from 'vitest';
import {easternDeadline,countdownConfig,countdownImageUrl} from './countdown.js';
import {editableCardBlock,renderEmail,plainText,styleCheck} from './render.js';
describe('newsletter countdowns',()=>{
 it('uses Eastern time in daylight and standard time',()=>{
  expect(new Date(easternDeadline('2026-10-24T23:59')).toISOString()).toBe('2026-10-25T03:59:00.000Z');
  expect(new Date(easternDeadline('2026-12-24T23:59')).toISOString()).toBe('2026-12-25T04:59:00.000Z');
 });
 it('rejects nonexistent dates and daylight saving gaps',()=>{for(const value of ['', 'not a date','2026-02-30T12:00','2026-03-08T02:30'])expect(Number.isNaN(easternDeadline(value))).toBe(true);});
 it('encodes labels safely and bounds image copy',()=>{const url=new URL(countdownImageUrl({deadline:'2026-10-24T23:59',label:'A&B <deadline>',finished:'All done'}));expect(url.searchParams.get('label')).toBe('A&B <deadline>');expect(countdownConfig({label:'x'.repeat(200)}).label).toHaveLength(60);});
 it('provides usable fallback text and rejects invalid countdowns',()=>{const c={subject:'Update',blocks:[{type:'countdown',countdown:{deadline:'2026-10-24T23:59',label:'Entry closes'},button:{label:'Buy tickets',url:'https://example.org'}}]};expect(renderEmail(c)).toContain('card=newsletter-countdown');expect(renderEmail(c)).toContain('Deadline 2026-10-24 at 23:59 Eastern.');expect(plainText(c)).toContain('2026-10-24 at 23:59 Eastern');c.blocks[0].countdown.deadline='';expect(renderEmail(c)).not.toContain('card=newsletter-countdown');expect(styleCheck(c).some(n=>n.kind==='deadline')).toBe(true);});
 it('upgrades the legacy raffle and lets a removed countdown stay removed',()=>{const block={id:'raffle',type:'story',button:{label:'Buy',url:'https://www.zeffy.com/en-US/ticketing/ron-clark-academy-parents-fall-fundraiser--2026'},link:{label:'Details',url:'https://wearercap.org/events/2026/fall-raffle/'}};const upgraded=editableCardBlock(block);expect(upgraded.countdown.deadline).toBe('2026-10-24T23:59');expect(upgraded.link.label).toBe('Share the raffle with friends');expect(editableCardBlock({...block,countdown:null}).countdown).toBe(null);});
});
