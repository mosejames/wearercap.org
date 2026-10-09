import { describe, expect, it } from 'vitest';
import { basePath, tripToday, DAYS, ideasFor } from './config.js';
describe('London trip navigation and suggestions', () => {
  it('preserves the vault directory with or without a trailing slash', () => { expect(basePath('/london-vault')).toBe('/london-vault/'); expect(basePath('/london-vault/')).toBe('/london-vault/'); expect(basePath('/london-vault/index.html')).toBe('/london-vault/'); });
  it('uses London midnight for the relevant trip day', () => { expect(tripToday(new Date('2026-10-11T23:30:00Z'))).toBe('2026-10-12'); });
  it('has suggestions for every album and a generic fallback', () => { for (const day of DAYS) expect(ideasFor(day.slug).length).toBeGreaterThan(0); expect(ideasFor('unknown')).toEqual(DAYS[0].ideas); });
});
