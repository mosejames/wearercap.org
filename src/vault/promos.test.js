import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { delete document.documentElement.dataset.vault; vi.resetModules(); });

describe('album promos', () => {
  it('never appear in the Amistad Vault', async () => {
    const { PROMOS, promosFor } = await import('./config.js');
    expect(PROMOS).toEqual([]);
    expect(promosFor('bingo-night', '2026-09-16')).toEqual([]);
  });

  it('show in the Bingo Night album, in grid order, and karaoke ends after Sept 27', async () => {
    document.documentElement.dataset.vault = 'rcap';
    const { promosFor } = await import('./config.js');
    expect(promosFor('bingo-night', '2026-09-16').map((p) => p.id)).toEqual(['karaoke-sept-27', 'membership-2026']);
    expect(promosFor('bingo-night', '2026-09-27').map((p) => p.id)).toContain('karaoke-sept-27');
    expect(promosFor('bingo-night', '2026-09-28').map((p) => p.id)).toEqual(['membership-2026']);
    expect(promosFor('everyday-rca', '2026-09-16')).toEqual([]);
  });
});
