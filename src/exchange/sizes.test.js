import { describe, it, expect } from 'vitest';
import {
  setItemTypes, sizeGroups, sizeLabel, firstSize, sizeSetFor, SIZE_SETS,
} from './config.js';

setItemTypes([
  { id: 'polo', label: 'RCA House Polo', housed: true, hidden: false, size_set: 'tops' },
  { id: 'pants-girls', label: 'Khaki Pants · Girls', housed: false, hidden: false, size_set: 'girls-bottoms' },
  { id: 'pants-boys', label: 'Khaki Pants · Boys', housed: false, hidden: false, size_set: 'boys-bottoms' },
  { id: 'skirt', label: 'Khaki Skirt', housed: false, hidden: false, size_set: 'girls-bottoms' },
]);

const values = (typeId) => sizeGroups(typeId).flatMap((g) => g.sizes.map((s) => s.v));

describe('size sets follow the item', () => {
  it('gives girls bottoms their own scale', () => {
    const v = values('pants-girls');
    expect(v).toContain('7');
    expect(v).toContain('16');
    expect(v).toContain('10.5');          // half sizes
    expect(v).not.toContain('18');        // that's a boys size
    expect(v).not.toContain('YM');        // and that's a shirt size
  });

  it('runs boys bottoms 8–20 and on into young mens waists', () => {
    const v = values('pants-boys');
    expect(v).toContain('8');
    expect(v).toContain('20');
    expect(v).toContain('12H');           // husky
    expect(v).toContain('14S');           // slim
    expect(v).toContain('W32');           // outgrown 20
    expect(v).not.toContain('7');         // girls only
  });

  it('leaves shirts and vests on letter sizes', () => {
    const v = values('polo');
    expect(v).toContain('YM');
    expect(v).toContain('A2XL');
    expect(v).not.toContain('12');
  });

  it('sends skirts down the girls scale', () => {
    expect(sizeSetFor('skirt')).toBe('girls-bottoms');
  });

  it('falls back to tops for an unknown item', () => {
    expect(sizeSetFor('nonsense')).toBe('tops');
  });
});

describe('browsing with no item chosen', () => {
  it('offers every scale, labelled so a girls 10 and a boys 10 stay apart', () => {
    const groups = sizeGroups('');
    const named = groups.filter((g) => g.group).map((g) => g.group);
    expect(named.some((g) => g.startsWith("Girls' bottoms"))).toBe(true);
    expect(named.some((g) => g.startsWith("Boys' bottoms"))).toBe(true);
    expect(named.some((g) => g.startsWith('Shirts & vests'))).toBe(true);
  });
});

describe('sizeLabel', () => {
  it('spells out what a size means', () => {
    expect(sizeLabel('YM')).toBe('YM · 8–10');
    expect(sizeLabel('10.5')).toBe('10½ Plus');
    expect(sizeLabel('W32')).toBe('32 waist');
    expect(sizeLabel('12H')).toBe('12 Husky');
  });

  it('passes anything logged before this change straight through', () => {
    expect(sizeLabel('YouthSmall-ish')).toBe('YouthSmall-ish');
  });
});

describe('firstSize', () => {
  it('opens each form on a sensible size for that item', () => {
    expect(firstSize('pants-girls')).toBe('7');
    expect(firstSize('pants-boys')).toBe('8');
    expect(firstSize('polo')).toBe('YXS');
  });
});

describe('no accidental duplicates', () => {
  it('keeps every value unique inside a set', () => {
    for (const [key, groups] of Object.entries(SIZE_SETS)) {
      const v = groups.flatMap((g) => g.sizes.map((s) => s.v));
      expect(new Set(v).size, `${key} has a duplicate size`).toBe(v.length);
    }
  });
});
