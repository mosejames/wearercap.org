import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { delete document.documentElement.dataset.vault; vi.resetModules(); });
const school = async () => { document.documentElement.dataset.vault = 'rcap'; return import('./config.js'); };

describe('album promos', () => {
  it('never appear in the Amistad Vault', async () => {
    const { PROMOS, promosFor } = await import('./config.js');
    expect(PROMOS).toEqual([]);
    expect(promosFor('bingo-night', '2026-09-16')).toEqual([]);
  });

  it('show four cards in Bingo Night, and karaoke ends after Sept 27', async () => {
    const { promosFor } = await school();
    expect(promosFor('bingo-night', '2026-09-16').map((p) => p.id)).toEqual(['karaoke-sept-27', 'membership-2026', 'collective', 'suggestion-box']);
    expect(promosFor('bingo-night', '2026-09-28').map((p) => p.id)).toEqual(['membership-2026', 'collective', 'suggestion-box']);
    expect(promosFor('everyday-rca', '2026-09-16')).toEqual([]);
  });

  it('take turns so the same card never follows itself, one per 20 photos', async () => {
    const { promosFor, promoSlots } = await school();
    for (const today of ['2026-09-16', '2026-09-28']) {
      const slots = promoSlots(promosFor('bingo-night', today), 154);
      expect(slots.map((s) => s.at)).toEqual([6, 26, 46, 66, 86, 106, 126, 146]);
      for (let i = 1; i < slots.length; i++) expect(slots[i].promo.id).not.toBe(slots[i - 1].promo.id);
    }
    const mem = promoSlots(promosFor('bingo-night', '2026-09-28'), 154).filter((s) => s.promo.id === 'membership-2026');
    expect(new Set(mem.map((s) => s.card.title)).size).toBe(3);
  });

  it('give short and empty albums one card', async () => {
    const { promosFor, promoSlots } = await school();
    const p = promosFor('bingo-night', '2026-09-16');
    expect(promoSlots(p, 3).map((s) => s.at)).toEqual([3]);
    expect(promoSlots(p, 0)).toHaveLength(1);
  });

  it('link the suggestion box straight to suggestion mode', async () => {
    const { PROMOS } = await school();
    expect(PROMOS.find((p) => p.id === 'suggestion-box').href).toBe('/wish-i-knew/?mode=suggestion');
  });
});
