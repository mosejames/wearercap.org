import { describe, it, expect } from 'vitest';
import { todayISO, msUntilNextDay, acceptsUploads } from './config.js';

// A moment is a real instant; what differs is which wall clock you read it on.
const at = (iso) => new Date(iso);

describe('todayISO is Eastern, not the device', () => {
  it('is still the previous day at 11pm Eastern', () => {
    expect(todayISO(at('2026-09-12T03:30:00Z'))).toBe('2026-09-11'); // 11:30pm EDT
  });
  it('has turned over at 12:01am Eastern', () => {
    expect(todayISO(at('2026-09-12T04:01:00Z'))).toBe('2026-09-12'); // 12:01am EDT
  });
  it('does not roll early for a phone in London', () => {
    // 1am in London on the 12th is still 8pm Eastern on the 11th. This is the
    // 7th Grade London trip case, and the reason this function exists.
    expect(todayISO(at('2026-10-12T00:00:00Z'))).toBe('2026-10-11');
  });
  it('handles standard time as well as daylight time', () => {
    expect(todayISO(at('2026-12-19T04:30:00Z'))).toBe('2026-12-18'); // 11:30pm EST
    expect(todayISO(at('2026-12-19T05:01:00Z'))).toBe('2026-12-19'); // 12:01am EST
  });
});

describe('msUntilNextDay lands just after Eastern midnight', () => {
  const check = (iso) => {
    const now = at(iso);
    const then = new Date(now.getTime() + msUntilNextDay(now));
    expect(todayISO(then)).not.toBe(todayISO(now));   // we crossed
    // and only just: a minute earlier we had not.
    expect(todayISO(new Date(then.getTime() - 120_000))).toBe(todayISO(now));
  };
  it('from late evening', () => check('2026-09-11T23:50:00-04:00'));
  it('from the middle of the day', () => check('2026-09-11T13:00:00-04:00'));
  it('from just after midnight', () => check('2026-09-11T00:05:00-04:00'));
  it('in standard time', () => check('2026-12-18T22:00:00-05:00'));
});

describe('acceptsUploads', () => {
  const ev = (o) => ({ open: true, hidden: false, ongoing: false, kind: 'school', startsOn: '2026-09-15', ...o });
  const TODAY = '2026-09-11';

  it('is shut before the day of the event', () => {
    expect(acceptsUploads(ev({}), TODAY)).toBe(false);
  });
  it('opens on the day itself', () => {
    expect(acceptsUploads(ev({ startsOn: TODAY }), TODAY)).toBe(true);
  });
  it('stays open afterwards', () => {
    expect(acceptsUploads(ev({ startsOn: '2026-08-26' }), TODAY)).toBe(true);
  });
  it('never closes, however old the event', () => {
    // A photo found in March from the October trip still belongs in October.
    expect(acceptsUploads(ev({ startsOn: '2026-10-11' }), '2027-03-01')).toBe(true);
    // And the legacy open column cannot shut an album any more.
    expect(acceptsUploads(ev({ startsOn: '2026-08-26', open: false }), TODAY)).toBe(true);
  });
  it('never opens a hidden album', () => {
    expect(acceptsUploads(ev({ startsOn: '2026-08-26', hidden: true }), TODAY)).toBe(false);
  });
  it('lets Everyday Amistad and ongoing albums through whatever the date', () => {
    expect(acceptsUploads(ev({ kind: 'everyday', startsOn: '2027-01-01' }), TODAY)).toBe(true);
    expect(acceptsUploads(ev({ ongoing: true, startsOn: '2027-01-01' }), TODAY)).toBe(true);
  });
  it('survives a missing event', () => {
    expect(acceptsUploads(null, TODAY)).toBe(false);
  });
});
