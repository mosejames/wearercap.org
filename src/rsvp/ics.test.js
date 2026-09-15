import { describe, it, expect } from 'vitest';
import { buildIcs } from '../../api/event-ics.js';

const ev = {
  slug: 'karaoke-sept-27', title: 'Parent Social: R&B Karaoke',
  starts_at: '2026-09-27T21:00:00+00:00', ends_at: '2026-09-27T23:00:00+00:00',
  venue_name: 'Ron Clark Academy', venue_address: '228 Margaret St SE, Atlanta, GA 30315',
  blurb: 'Two hours. A mic. The parents you wave at in the carpool line. Bring a song or bring a friend who has one.',
};

describe('event calendar file', () => {
  const ics = buildIcs(ev, '2026-09-15T00:00:00Z');
  it('has the times in UTC', () => {
    expect(ics).toContain('DTSTART:20260927T210000Z');
    expect(ics).toContain('DTEND:20260927T230000Z');
  });
  it('escapes commas and uses CRLF', () => {
    expect(ics).toContain('LOCATION:Ron Clark Academy\\, 228 Margaret St SE\\, Atlanta\\, GA 30315');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });
  it('folds long lines at 75 octets', () => {
    expect(ics.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });
});
