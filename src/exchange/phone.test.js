import { describe, it, expect } from 'vitest';
import { phoneDigits, prettyPhone, samePhone } from './config.js';

describe('phone numbers', () => {
  it('reads the same number however someone types it', () => {
    const ways = [
      '4048493220', '404-849-3220', '(404) 849-3220', '404.849.3220',
      '+1 404 849 3220', '+14048493220', '1-404-849-3220', ' 404 849 3220 ',
    ];
    for (const w of ways) expect(phoneDigits(w), w).toBe('4048493220');
  });

  it('shows one tidy format no matter what went in', () => {
    expect(prettyPhone('+14048493220')).toBe('(404) 849-3220');
    expect(prettyPhone('4048493220')).toBe('(404) 849-3220');
    expect(prettyPhone('404-849-3220')).toBe('(404) 849-3220');
  });

  it('matches a +1 number against a bare one', () => {
    expect(samePhone('+14048493220', '404-849-3220')).toBe(true);
    expect(samePhone('(404) 849-3220', '14048493220')).toBe(true);
  });

  it('does not match different numbers, or nothing at all', () => {
    expect(samePhone('4048493220', '4048493221')).toBe(false);
    expect(samePhone('', '4048493220')).toBe(false);
    expect(samePhone(null, null)).toBe(false);
  });

  it('leaves anything that is not a US number alone rather than mangling it', () => {
    expect(phoneDigits('+44 20 7946 0958')).toBe('');
    expect(prettyPhone('ask me on WhatsApp')).toBe('ask me on WhatsApp');
    expect(prettyPhone('')).toBe('');
  });
});
