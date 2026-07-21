import { describe, it, expect } from 'vitest';
import {
  detectPlatform,
  starterMessage,
  groupTextHref,
  groupEmailHref,
} from './groupHandoff.js';

describe('detectPlatform', () => {
  it('reads an iPhone user agent as ios', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15';
    expect(detectPlatform(ua)).toBe('ios');
  });

  it('reads an iPad user agent as ios', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15';
    expect(detectPlatform(ua)).toBe('ios');
  });

  it('reads an iPod user agent as ios', () => {
    const ua = 'Mozilla/5.0 (iPod touch; CPU iPhone OS 16_0 like Mac OS X)';
    expect(detectPlatform(ua)).toBe('ios');
  });

  it('reads an Android user agent as android', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36';
    expect(detectPlatform(ua)).toBe('android');
  });

  it('reads a desktop user agent as other', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
    expect(detectPlatform(ua)).toBe('other');
  });

  it('reads an empty or missing user agent as other', () => {
    expect(detectPlatform('')).toBe('other');
    expect(detectPlatform(undefined)).toBe('other');
  });
});

describe('starterMessage', () => {
  it('names the organizer when one is given', () => {
    expect(starterMessage('Kita')).toBe(
      'Hi, this is our RCA carpool group from wearercap. Kita set it up. Let\'s sort out who drives which days and a pickup time and spot.',
    );
  });

  it('omits the set-it-up clause when the organizer name is falsy', () => {
    const expected =
      'Hi, this is our RCA carpool group from wearercap. Let\'s sort out who drives which days and a pickup time and spot.';
    expect(starterMessage('')).toBe(expected);
    expect(starterMessage(undefined)).toBe(expected);
    expect(starterMessage(null)).toBe(expected);
  });

  it('never uses an em dash, a hyphen break, or an exclamation point', () => {
    const withName = starterMessage('Kita');
    const without = starterMessage('');
    for (const text of [withName, without]) {
      expect(text).not.toMatch(/—/);
      expect(text).not.toMatch(/!/);
      expect(text).not.toMatch(/ - /);
    }
  });
});

describe('groupTextHref', () => {
  const phones = ['5550001', '5550002'];
  const message = 'Hi there';

  it('builds the iOS shape with addresses and an ampersand before body', () => {
    expect(groupTextHref({ phones, message, platform: 'ios' })).toBe(
      'sms:/open?addresses=5550001,5550002&body=Hi%20there',
    );
  });

  it('builds the Android shape with the numbers before a question mark', () => {
    expect(groupTextHref({ phones, message, platform: 'android' })).toBe(
      'sms:5550001,5550002?body=Hi%20there',
    );
  });

  it('treats other as the iOS shape (the safest default)', () => {
    expect(groupTextHref({ phones, message, platform: 'other' })).toBe(
      groupTextHref({ phones, message, platform: 'ios' }),
    );
  });

  it('returns null when there are no phones', () => {
    expect(groupTextHref({ phones: [], message, platform: 'ios' })).toBeNull();
    expect(groupTextHref({ phones: undefined, message, platform: 'ios' })).toBeNull();
  });

  it('encodes the body with encodeURIComponent', () => {
    const body = 'Let\'s sort out who drives & when, at 5pm?';
    const href = groupTextHref({ phones: ['5550001'], message: body, platform: 'ios' });
    expect(href).toBe(`sms:/open?addresses=5550001&body=${encodeURIComponent(body)}`);
    // The raw ampersand and question mark from the body must be percent-encoded
    // so they cannot be read as href delimiters.
    expect(href).not.toMatch(/&body=.*&/);
    expect(href).toContain('%26');
    expect(href).toContain('%3F');
  });

  it('joins multiple recipients with commas', () => {
    const href = groupTextHref({ phones: ['1', '2', '3'], message, platform: 'android' });
    expect(href).toBe('sms:1,2,3?body=Hi%20there');
  });

  // The real-world case: contact_phone is unmasked free text, so parents type
  // human formatting. Spaces and parens are invalid in an sms: address list and
  // open Messages with no or wrong recipients. Every number must reduce to
  // digits (and a leading +) before the join.
  it('strips human phone formatting down to dialable characters', () => {
    const href = groupTextHref({
      phones: ['(404) 555-1212', '404.555.3434', '+1 404 555 5656'],
      message,
      platform: 'android',
    });
    expect(href).toBe('sms:4045551212,4045553434,+14045555656?body=Hi%20there');
  });

  it('drops entries that sanitize to empty, and returns null if none survive', () => {
    expect(groupTextHref({ phones: ['n/a', '(404) 555-1212'], message, platform: 'ios' }))
      .toBe('sms:/open?addresses=4045551212&body=Hi%20there');
    expect(groupTextHref({ phones: ['n/a', '  '], message, platform: 'ios' })).toBeNull();
  });
});

describe('groupEmailHref', () => {
  const emails = ['a@example.com', 'b@example.com'];

  it('builds a mailto with comma-joined recipients and encoded subject and body', () => {
    expect(groupEmailHref({ emails, subject: 'RCA carpool', body: 'Hi there' })).toBe(
      'mailto:a@example.com,b@example.com?subject=RCA%20carpool&body=Hi%20there',
    );
  });

  it('returns null when there are no emails', () => {
    expect(groupEmailHref({ emails: [], subject: 'x', body: 'y' })).toBeNull();
    expect(groupEmailHref({ emails: undefined, subject: 'x', body: 'y' })).toBeNull();
  });

  it('encodes special characters in subject and body', () => {
    const subject = 'Carpool & rides';
    const body = 'Who drives? Let\'s decide.';
    const href = groupEmailHref({ emails: ['a@example.com'], subject, body });
    expect(href).toBe(
      `mailto:a@example.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    );
  });
});
