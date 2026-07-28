import { describe, it, expect } from 'vitest';
import { nextSlots, slotLabel, handoffSummary, availabilityLine, myRequestsLead } from './handoff.js';

// Friday, July 31 2026 as the fixed "today" for every test.
const FRI = new Date(2026, 6, 31);

describe('nextSlots', () => {
  it('offers the holder’s days only, starting tomorrow', () => {
    const bin = { offers_carline: true, carline_days: [2, 4], carline_when: 'am' };
    const s = nextSlots(bin, FRI, 4);
    expect(s.map((x) => x.date)).toEqual(['2026-08-04', '2026-08-06', '2026-08-11', '2026-08-13']);
    expect(s.every((x) => x.slot === 'am')).toBe(true);
  });

  it('never offers today (nobody can make a handoff happen in an hour)', () => {
    const bin = { offers_carline: true, carline_days: [5], carline_when: 'am' };
    const s = nextSlots(bin, FRI, 2);
    expect(s[0].date).toBe('2026-08-07'); // the following Friday, not today
  });

  it('skips weekends even when asked for every day', () => {
    const bin = { offers_carline: true, carline_days: [1, 2, 3, 4, 5], carline_when: 'am' };
    const s = nextSlots(bin, FRI, 3);
    // Sat 8/1 and Sun 8/2 are skipped
    expect(s.map((x) => x.date)).toEqual(['2026-08-03', '2026-08-04', '2026-08-05']);
  });

  it('only ever offers mornings — afternoon carline is too chaotic', () => {
    const bin = { offers_carline: true, carline_days: [1, 3], carline_when: 'both' };
    const s = nextSlots(bin, FRI, 4);
    expect(s.every((x) => x.slot === 'am')).toBe(true);
    // one slot per day, not two
    expect(s.map((x) => x.date)).toEqual(['2026-08-03', '2026-08-05', '2026-08-10', '2026-08-12']);
  });

  it('returns nothing when the holder does not do carline', () => {
    expect(nextSlots({ offers_carline: false, carline_days: [1] }, FRI)).toEqual([]);
    expect(nextSlots({ offers_carline: true, carline_days: [] }, FRI).length).toBeGreaterThan(0);
    expect(nextSlots({ offers_carline: true, carline_days: [6, 7] }, FRI)).toEqual([]);
  });

  it('handles a missing bin', () => {
    expect(nextSlots(null, FRI)).toEqual([]);
  });
});

describe('slotLabel', () => {
  it('reads like a person wrote it', () => {
    expect(slotLabel({ date: '2026-08-03', slot: 'am' })).toBe('Mon, Aug 3 · morning carline');
  });
});

describe('handoffSummary', () => {
  it('describes each mode', () => {
    expect(handoffSummary({ handoff_mode: 'student' })).toBe('Student to student');
    expect(handoffSummary({ handoff_mode: 'carline', handoff_date: '2026-08-04', handoff_slot: 'am' }))
      .toBe('Tue, Aug 4 · morning carline');
    expect(handoffSummary({ handoff_mode: '' })).toBe('');
  });
});

describe('availabilityLine', () => {
  it('summarises what a holder offers', () => {
    expect(availabilityLine({ offers_carline: true, carline_days: [2, 4], carline_when: 'am', offers_student: false }))
      .toBe('Carline Tue · Thu, mornings');
    expect(availabilityLine({ offers_carline: true, carline_days: [1, 2, 3, 4, 5], carline_when: 'am', offers_student: true }))
      .toBe('Carline any weekday, mornings  ·  Student to student');
    expect(availabilityLine({ offers_carline: false, offers_student: false }))
      .toBe('No handoff options set yet');
  });
});

describe('myRequestsLead', () => {
  const r = (status) => ({ status });

  it('does not tell a waitlisted family to pick a handoff', () => {
    const lead = myRequestsLead([r('open')]);
    expect(lead).toMatch(/waitlist/i);
    expect(lead).not.toMatch(/pick a handoff that fits/i);
  });

  it('asks for a time once something is actually theirs', () => {
    expect(myRequestsLead([r('assigned')])).toMatch(/pick a handoff/i);
  });

  it('leads with the actionable one when a list is mixed', () => {
    const lead = myRequestsLead([r('open'), r('assigned')]);
    expect(lead).toMatch(/pick a handoff/i);
    expect(lead).toMatch(/rest when they turn up/i);
  });

  it('nudges the confirmation once a handoff is set', () => {
    expect(myRequestsLead([r('scheduled')])).toMatch(/Got it/);
    expect(myRequestsLead([r('handed_off')])).toMatch(/Got it/);
  });

  it('stays quiet when everything is done', () => {
    expect(myRequestsLead([r('fulfilled'), r('canceled')])).toBe('Nothing needs you right now.');
    expect(myRequestsLead([])).toBe('Nothing needs you right now.');
  });
});
