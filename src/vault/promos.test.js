import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { delete document.documentElement.dataset.vault; vi.resetModules(); });

describe('album promos', () => {
  it('never appear in the Amistad Vault', async () => {
    const { PROMOS, promosFor } = await import('./config.js');
    expect(PROMOS).toEqual([]);
    expect(promosFor('bingo-night', '2026-09-16')).toEqual([]);
  });

  it('show in the Bingo Night album, and karaoke ends after Sept 27', async () => {
    document.documentElement.dataset.vault = 'rcap';
    const { promosFor } = await import('./config.js');
    expect(promosFor('bingo-night', '2026-09-16').map((p) => p.id)).toEqual(['karaoke-sept-27', 'membership-2026']);
    expect(promosFor('bingo-night', '2026-09-28').map((p) => p.id)).toEqual(['membership-2026']);
    expect(promosFor('everyday-rca', '2026-09-16')).toEqual([]);
  });

  it('repeat through a long album, never back to back, rotating the words', async () => {
    document.documentElement.dataset.vault = 'rcap';
    const { promosFor, promoSlots } = await import('./config.js');
    const slots = promoSlots(promosFor('bingo-night', '2026-09-16'), 154);
    expect(slots.map((s) => s.at)).toEqual([6, 26, 46, 66, 86, 106, 126, 146]);
    const titles = slots.filter((s) => s.promo.id === 'membership-2026').map((s) => s.card.title);
    expect(new Set(titles).size).toBe(3);
    for (let i = 1; i < slots.length; i++) expect(slots[i].at - slots[i - 1].at).toBeGreaterThan(1);
  });

  it('put a short album\'s cards at the end, once each', async () => {
    document.documentElement.dataset.vault = 'rcap';
    const { promosFor, promoSlots } = await import('./config.js');
    expect(promoSlots(promosFor('bingo-night', '2026-09-16'), 10).map((s) => [s.promo.id, s.at]))
      .toEqual([['karaoke-sept-27', 6], ['membership-2026', 10]]);
  });
});
