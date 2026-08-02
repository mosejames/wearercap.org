import { describe, it, expect } from 'vitest';
import {
  setItemTypes, sizeGroups, sizeLabel, firstSize, sizeSetFor, SIZE_SETS, sizeChip,
  typesForGender, typeGender, typeHoused, typeMaxQty, ORDER_MAX_ITEMS, onlySize,
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
    expect(v).not.toContain('10.5');      // plus is a fit note now, not a size
    expect(v).not.toContain('18');        // that's a boys size
    expect(v).not.toContain('YM');        // and that's a shirt size
  });

  it('runs boys bottoms 8–20 and on into young mens waists', () => {
    const v = values('pants-boys');
    expect(v).toContain('8');
    expect(v).toContain('20');
    expect(v).not.toContain('12H');       // husky and slim are fit notes now
    expect(v).not.toContain('14S');
    expect(v).toContain('W32');           // outgrown 20
    expect(v).not.toContain('7');         // girls only
  });

  it('leaves shirts and vests on letter sizes', () => {
    const v = values('polo');
    expect(v).toContain('M');       // M · 10–12, the way the order page sells it
    expect(v).toContain('A2XL');
    expect(v).not.toContain('12');  // a bare 12 is a bottoms size
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
    expect(sizeLabel('M')).toBe('M · 10–12');
    expect(sizeLabel('W32')).toBe('32 waist');
  });

  it('still reads slim, husky and plus logged before they became notes', () => {
    expect(sizeLabel('12H')).toBe('12 Husky');
    expect(sizeLabel('14S')).toBe('14 Slim');
    expect(sizeLabel('10.5')).toBe('10½ Plus');
  });

  it('passes anything logged before this change straight through', () => {
    expect(sizeLabel('YouthSmall-ish')).toBe('YouthSmall-ish');
  });
});

describe('firstSize', () => {
  it('opens each form on a sensible size for that item', () => {
    expect(firstSize('pants-girls')).toBe('7');
    expect(firstSize('pants-boys')).toBe('8');
    expect(firstSize('polo')).toBe('S');
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

// A bare number in a chip reads like a count, so the word goes back in.
describe('sizeChip', () => {
  it('names the plain numbers', () => {
    expect(sizeChip('12')).toBe('Size 12');
    expect(sizeChip('7')).toBe('Size 7');
  });
  it('leaves anything that already says what it is', () => {
    expect(sizeChip('YM')).toBe('YM · 8–10');
    expect(sizeChip('AS')).toBe('Adult S');
    expect(sizeChip('W28')).toBe('28 waist');
    expect(sizeChip('Jr 3')).toBe('Juniors 3');
    expect(sizeChip('12H')).toBe('12 Husky');
  });
});

// The house polo comes in a girls' cut, and a girls' top doesn't size like a
// youth top. Checked against Tommy Hilfiger's girls chart (XXS–XL over 4–16).
describe('girls polos', () => {
  it('has its own scale, not the youth one', () => {
    setItemTypes([
      { id: 'polo', label: 'RCA House Polo · Boys', housed: true, hidden: false, size_set: 'tops' },
      { id: 'polo-girls', label: 'RCA House Polo · Girls', housed: true, hidden: false, size_set: 'girls-tops' },
    ]);
    expect(sizeSetFor('polo-girls')).toBe('girls-tops');
    const values = sizeGroups('polo-girls').flatMap((g) => g.sizes.map((s) => s.v));
    expect(values).toEqual(['GXS', 'GS', 'GM', 'GL', 'GXL', 'JXS', 'JS', 'JM', 'JL', 'JXL', 'Other']);
    // and none of the youth values leak in
    expect(values).not.toContain('YM');
  });

  it('spells out the numbers a parent actually knows', () => {
    expect(sizeLabel('GS')).toBe('Girls S · 7');
    expect(sizeLabel('GM')).toBe('Girls M · 8–10');
    expect(sizeLabel('GL')).toBe('Girls L · 12–14');
    expect(sizeLabel('GXL')).toBe('Girls XL · 16');
    expect(sizeLabel('JM')).toBe('Juniors M');
  });

  it('starts a new girls polo on a girls size', () => {
    expect(firstSize('polo-girls')).toBe('GXS');
  });

  it("keeps the boys' polo exactly where it was, history and all", () => {
    expect(sizeSetFor('polo')).toBe('tops');
    expect(sizeLabel('YM')).toBe('YM · 8–10');
  });
});

// Who it's for comes first, and a co-ed piece is one garment either way.
describe('gender-first item lists', () => {
  const TYPES = [
    { id: 'polo', label: 'House Polo · Co-Ed', gender: 'coed', housed: true, hidden: false, size_set: 'tops' },
    { id: 'polo-girls', label: 'House Polo · Fem Fit', gender: 'girls', housed: true, hidden: false, size_set: 'girls-tops' },
    { id: 'blouse', label: 'Oxford Blouse', gender: 'girls', housed: false, hidden: false, size_set: 'girls-tops' },
    { id: 'dress-shirt', label: 'Oxford Shirt', gender: 'boys', housed: false, hidden: false, size_set: 'tops' },
    { id: 'vest', label: 'Sweater Vest', gender: 'coed', housed: false, hidden: false, size_set: 'tops' },
    { id: 'pants-girls', label: 'Khaki Pants · Straight', gender: 'girls', housed: false, hidden: false, size_set: 'girls-bottoms' },
    { id: 'pants-girls-boot', label: 'Khaki Pants · Bootcut', gender: 'girls', housed: false, hidden: false, size_set: 'girls-bottoms' },
    { id: 'pants-boys', label: 'Khaki Pants', gender: 'boys', housed: false, hidden: false, size_set: 'boys-bottoms' },
    { id: 'retired', label: 'Old thing', gender: 'coed', housed: false, hidden: true, size_set: 'tops' },
  ];
  const ids = (g) => typesForGender(g).map((t) => t.id);

  it('shows a girl her own items plus the co-ed ones', () => {
    setItemTypes(TYPES);
    expect(ids('girls')).toEqual([
      'polo', 'polo-girls', 'blouse', 'vest', 'pants-girls', 'pants-girls-boot',
    ]);
  });

  it('shows a boy his, and never the fem fit or the skort', () => {
    setItemTypes(TYPES);
    expect(ids('boys')).toEqual(['polo', 'dress-shirt', 'vest', 'pants-boys']);
    expect(ids('boys')).not.toContain('polo-girls');
    expect(ids('boys')).not.toContain('blouse');
  });

  it('gives the co-ed pieces ONE id, so both doors draw the same total', () => {
    setItemTypes(TYPES);
    const shared = ids('girls').filter((id) => ids('boys').includes(id));
    expect(shared).toEqual(['polo', 'vest']);
    // 25 counted by a girl's family and 25 by a boy's is 50 of one thing.
    expect(typeGender('polo')).toBe('coed');
  });

  it('leaves hidden types out of every list', () => {
    setItemTypes(TYPES);
    expect(ids('girls')).not.toContain('retired');
    expect(ids('boys')).not.toContain('retired');
    expect(ids('')).not.toContain('retired');
  });

  it('falls back to everything when no student is chosen yet', () => {
    setItemTypes(TYPES);
    expect(ids('').length).toBe(TYPES.length - 1);
  });

  it('shows everything on purpose too — a girl can wear the boys pant', () => {
    setItemTypes(TYPES);
    expect(ids('all')).toEqual(ids(''));
    expect(ids('all')).toContain('pants-boys');
    expect(ids('all')).toContain('polo-girls');
    expect(ids('all')).not.toContain('retired');
  });

  it('sizes each cut on its own scale', () => {
    setItemTypes(TYPES);
    expect(sizeSetFor('polo')).toBe('tops');            // co-ed, youth scale
    expect(sizeSetFor('polo-girls')).toBe('girls-tops'); // Big Girls 7–16
    expect(sizeSetFor('pants-girls-boot')).toBe('girls-bottoms');
    expect(sizeSetFor('pants-boys')).toBe('boys-bottoms');
  });
});

// The co-ed pieces size the way the RCA order page sells them: one letter
// covering two numbers, 8 / 10-12 / 14-16 / 18-20.
describe('co-ed top sizes', () => {
  it('is S M L XL over 8 to 20, with the numbers spelled out', () => {
    setItemTypes([{ id: 'polo', label: 'House Polo · Co-Ed', gender: 'coed', housed: true, hidden: false, size_set: 'tops' }]);
    const kids = sizeGroups('polo')[0];
    expect(kids.group).toBe('Kids');
    expect(kids.sizes.map((x) => x.v)).toEqual(['S', 'M', 'L', 'XL']);
    expect(kids.sizes.map((x) => x.label)).toEqual(['S · 8', 'M · 10–12', 'L · 14–16', 'XL · 18–20']);
  });

  it('starts a new co-ed line on the smallest kids size', () => {
    setItemTypes([{ id: 'polo', label: 'x', gender: 'coed', housed: true, hidden: false, size_set: 'tops' }]);
    expect(firstSize('polo')).toBe('S');
  });

  it('keeps adult sizes distinct from the kids letters', () => {
    expect(sizeLabel('S')).toBe('S · 8');
    expect(sizeLabel('AS')).toBe('Adult S');
  });

  it('still reads anything logged on the old youth scale', () => {
    expect(sizeLabel('YM')).toBe('YM · 8–10');
    expect(sizeLabel('YXL')).toBe('YXL · 16–18');
  });

  it('never renders a letter size as a quantity', () => {
    expect(sizeChip('M')).toBe('M · 10–12');
    expect(sizeChip('12')).toBe('Size 12');
  });
});

// A vest and a tie both carry the house on them — an Amistad family needs an
// Amistad one, and nothing else will do.
describe('house-embroidered pieces', () => {
  const TYPES = [
    { id: 'vest', label: 'Sweater Vest', gender: 'coed', housed: true, hidden: false, size_set: 'tops' },
    { id: 'tie', label: 'House Tie', gender: 'coed', housed: true, hidden: false, size_set: 'neckwear' },
    { id: 'pants-boys', label: 'Khaki Pants', gender: 'boys', housed: false, hidden: false, size_set: 'boys-bottoms' },
  ];

  it('marks the vest and the tie house-colored', () => {
    setItemTypes(TYPES);
    expect(typeHoused('vest')).toBe(true);
    expect(typeHoused('tie')).toBe(true);
    expect(typeHoused('pants-boys')).toBe(false);   // khakis fit anyone
  });

  it('offers both to either student', () => {
    setItemTypes(TYPES);
    expect(typesForGender('girls').map((t) => t.id)).toContain('tie');
    expect(typesForGender('boys').map((t) => t.id)).toContain('tie');
    expect(typeGender('tie')).toBe('coed');
  });

  it('sizes a tie as a length, not a chest', () => {
    setItemTypes(TYPES);
    expect(sizeSetFor('tie')).toBe('neckwear');
    expect(sizeGroups('tie')[0].sizes.map((s) => s.v)).toEqual(['OS']);
    expect(sizeLabel('OS')).toBe('One size');
    expect(firstSize('tie')).toBe('OS');
  });
});

// Bins are shallow. One order holds two different things, and how many of
// each depends on the thing.
describe('order limits', () => {
  const TYPES = [
    { id: 'polo', label: 'House Polo · Co-Ed', gender: 'coed', housed: true, hidden: false, size_set: 'tops', max_qty: 2 },
    { id: 'polo-girls', label: 'House Polo · Fem Fit', gender: 'girls', housed: true, hidden: false, size_set: 'girls-tops', max_qty: 2 },
    { id: 'tie', label: 'House Tie', gender: 'coed', housed: true, hidden: false, size_set: 'neckwear', max_qty: 1 },
    { id: 'vest', label: 'Sweater Vest', gender: 'coed', housed: true, hidden: false, size_set: 'tops', max_qty: 1 },
    { id: 'pants-boys', label: 'Khaki Pants', gender: 'boys', housed: false, hidden: false, size_set: 'boys-bottoms' },
  ];

  it('lets a family take two polos and one of everything else', () => {
    setItemTypes(TYPES);
    expect(typeMaxQty('polo')).toBe(2);
    expect(typeMaxQty('polo-girls')).toBe(2);
    expect(typeMaxQty('tie')).toBe(1);
    expect(typeMaxQty('vest')).toBe(1);
  });

  it('treats a missing cap as one, never as unlimited', () => {
    setItemTypes(TYPES);
    expect(typeMaxQty('pants-boys')).toBe(1);
    expect(typeMaxQty('nonsense')).toBe(1);
  });

  it('holds two different items in one order', () => {
    expect(ORDER_MAX_ITEMS).toBe(2);
  });
});

// The house tie comes one way only.
describe('one-size items', () => {
  const TYPES = [
    { id: 'tie', label: 'House Tie', gender: 'coed', housed: true, hidden: false, size_set: 'neckwear', max_qty: 1 },
    { id: 'polo', label: 'House Polo · Co-Ed', gender: 'coed', housed: true, hidden: false, size_set: 'tops', max_qty: 2 },
  ];

  it('offers exactly one tie size, and calls it what it is', () => {
    setItemTypes(TYPES);
    const all = sizeGroups('tie').flatMap((g) => g.sizes);
    expect(all.map((x) => x.v)).toEqual(['OS']);
    expect(sizeLabel('OS')).toBe('One size');
  });

  it('answers the size question for you when there is only one answer', () => {
    setItemTypes(TYPES);
    expect(onlySize('tie')).toBe('OS');
    expect(onlySize('polo')).toBe('');   // a real choice, so ask
  });

  it('still reads the lengths that briefly existed', () => {
    expect(sizeLabel('TA')).toBe('Adult length');
  });
});
