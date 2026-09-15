import { describe, it, expect } from 'vitest';
import {
  wallName, initials, normalizePhone, formatPhoneInput, validate, toPayload, fromMine,
  friendlyError, countLine, eventWhen, eyebrowDate, slugFromPath, mergeWall, mergeThread,
  houseColor, houseInk, squareCrop, relativeTime, HOUSES, NO_HOUSE_COLOR, PROMPTS, nextPrompt,
} from './model.js';

const ev = { starts_at: '2026-09-27T21:00:00+00:00', ends_at: '2026-09-27T23:00:00+00:00', venue_name: 'Ron Clark Academy', venue_address: '228 Margaret St SE' };
const good = { full_name: 'Jamelia  Johnson', phone: '(404) 555-0199', email: ' J@x.com ', house: 'amistad', grades: [8, 6, 6], bringing: true, plus_one_name: ' Pat Lee ' };

describe('names', () => {
  it('derives the wall label', () => {
    expect(wallName('Jamelia Johnson')).toBe('Jamelia J.');
    expect(wallName('  mary  ann  smith ')).toBe('mary S.');
    expect(wallName('Cher')).toBe('Cher');
    expect(wallName('Mose James IV')).toBe('Mose J.');
    expect(wallName('Robert Smith Jr.')).toBe('Robert S.');
    expect(wallName('')).toBe('');
  });
  it('makes initials from the wall label', () => {
    expect(initials('Jamelia J.')).toBe('JJ');
    expect(initials('Cher')).toBe('C');
  });
});

describe('phone', () => {
  it('normalizes US numbers to E.164', () => {
    expect(normalizePhone('(404) 555-0199')).toBe('+14045550199');
    expect(normalizePhone('1-404-555-0199')).toBe('+14045550199');
    expect(normalizePhone('+1 404 555 0199')).toBe('+14045550199');
  });
  it('rejects short numbers and bad area codes', () => {
    expect(normalizePhone('555-0199')).toBeNull();
    expect(normalizePhone('1045550199')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
  it('formats as typed', () => {
    expect(formatPhoneInput('404')).toBe('404');
    expect(formatPhoneInput('40455')).toBe('(404) 55');
    expect(formatPhoneInput('14045550199')).toBe('(404) 555-0199');
  });
});

describe('validate', () => {
  it('passes a complete form', () => {
    expect(validate(good)).toEqual({});
  });
  it('flags each field', () => {
    const e = validate({ full_name: 'Jo', phone: '12', email: 'nope', house: 'gryffindor', grades: [9], bringing: true, plus_one_name: '' });
    expect(Object.keys(e).sort()).toEqual(['email', 'full_name', 'grades', 'house', 'phone', 'plus_one_name']);
  });
  it('ignores the +1 name when not bringing anyone', () => {
    expect(validate({ ...good, bringing: false, plus_one_name: '' })).toEqual({});
  });
  it('requires a house but not a grade', () => {
    expect(validate({ ...good, house: '' })).toEqual({ house: 'Pick your house.' });
    expect(validate({ ...good, grades: [] })).toEqual({});
  });
});

describe('payload', () => {
  it('tidies what goes to the database', () => {
    expect(toPayload(good)).toEqual({
      full_name: 'Jamelia Johnson', phone: '+14045550199', email: 'j@x.com',
      house: 'amistad', grades: [6, 8], plus_one_name: 'Pat Lee',
    });
  });
  it('drops the +1 when toggled off', () => {
    expect(toPayload({ ...good, bringing: false }).plus_one_name).toBeNull();
  });
  it('round trips a saved RSVP into the form', () => {
    const f = fromMine({ full_name: 'Jamelia Johnson', phone: '+14045550199', email: 'j@x.com', house: 'reveur', grades: [5], plus_one_name: null });
    expect(f).toMatchObject({ phone: '(404) 555-0199', house: 'reveur', bringing: false, grades: [5] });
    expect(validate(f)).toEqual({});
  });
});

describe('copy', () => {
  it('turns database codes into the house voice', () => {
    expect(friendlyError(new Error('duplicate_phone'))).toBe('That number is already on the wall. Check your email for your link.');
    expect(friendlyError({ message: 'slow_down' })).toMatch(/few seconds/);
    expect(friendlyError(new Error('fetch failed'))).toMatch(/try again/);
  });
  it('writes the count line', () => {
    expect(countLine(0)).toBe('Be the first name on the wall.');
    expect(countLine(1)).toBe('1 parent is in.');
    expect(countLine(38)).toBe('38 parents are in.');
  });
  it('formats the date in Atlanta time', () => {
    expect(eventWhen(ev)).toEqual({ day: 'Sunday, September 27', time: '5 PM to 7 PM' });
    expect(eyebrowDate(ev)).toBe('SEPT 27');
  });
  it('never uses an em dash or exclamation point', () => {
    const all = [countLine(0), countLine(5), friendlyError('duplicate_phone'), eventWhen(ev).time].join(' ');
    expect(all).not.toMatch(/[—!]/);
  });
  it('writes relative times', () => {
    const now = Date.parse('2026-09-20T12:00:00Z');
    expect(relativeTime('2026-09-20T11:59:30Z', now)).toBe('just now');
    expect(relativeTime('2026-09-20T11:15:00Z', now)).toBe('45m');
    expect(relativeTime('2026-09-20T09:00:00Z', now)).toBe('3h');
  });
});

describe('thread questions', () => {
  it('never repeats the question on screen', () => {
    for (let i = 0; i < 20; i++) {
      const q = PROMPTS[i % PROMPTS.length];
      expect(nextPrompt(q, () => 0.999)).not.toBe(q);
      expect(nextPrompt(q, () => 0)).not.toBe(q);
    }
  });
  it('keeps every question short, with no em dash or exclamation point', () => {
    PROMPTS.forEach((p) => {
      expect(p.length).toBeLessThanOrEqual(160);
      expect(p).not.toMatch(/[\u2014!]/);
      expect(p.endsWith('?')).toBe(true);
    });
  });
});

describe('houses', () => {
  it('uses the directory houses and navy for none', () => {
    expect(HOUSES.map((h) => h.key)).toEqual(['amistad', 'isibindi', 'reveur', 'altruismo']);
    expect(houseColor('isibindi')).toBe('#77cfa0');
    expect(houseColor(null)).toBe(NO_HOUSE_COLOR);
    expect(houseInk('altruismo')).toBe('#1a1613');
  });
});

describe('routing and merging', () => {
  it('reads the slug with or without a trailing slash', () => {
    expect(slugFromPath('/rsvp/karaoke-sept-27')).toBe('karaoke-sept-27');
    expect(slugFromPath('/rsvp/karaoke-sept-27/')).toBe('karaoke-sept-27');
    expect(slugFromPath('/rsvp/')).toBeNull();
  });
  it('puts new chips first, replaces edits, removes cancellations', () => {
    let wall = [{ id: 'a', wall_name: 'A B.' }];
    wall = mergeWall(wall, { id: 'b', wall_name: 'C D.', status: 'going' });
    expect(wall.map((x) => x.id)).toEqual(['b', 'a']);
    wall = mergeWall(wall, { id: 'a', wall_name: 'A Z.', status: 'going' });
    expect(wall.map((x) => x.wall_name)).toEqual(['C D.', 'A Z.']);
    wall = mergeWall(wall, { id: 'b', status: 'cancelled' });
    expect(wall.map((x) => x.id)).toEqual(['a']);
  });
  it('keeps the thread oldest first and drops hidden notes', () => {
    let t = [{ id: '1', created_at: '2026-09-20T10:00:00Z' }];
    t = mergeThread(t, { id: '2', created_at: '2026-09-20T11:00:00Z' });
    t = mergeThread(t, { id: '1', hidden: true, created_at: '2026-09-20T10:00:00Z' });
    expect(t.map((x) => x.id)).toEqual(['2']);
  });
  it('centre crops to a square', () => {
    expect(squareCrop(1200, 800)).toEqual({ sx: 200, sy: 0, side: 800, out: 400 });
    expect(squareCrop(300, 500)).toEqual({ sx: 0, sy: 100, side: 300, out: 300 });
  });
});
