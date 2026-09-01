import { describe, it, expect } from 'vitest';
import { byBin, totals, pickBin, drift, sheetLines, sheetExtras, sheetDirty } from './inventory.js';

const rows = [
  { bin_id: 'a', item_type: 'polo', size: 'YM', house: 'isibindi', qty: 5 },
  { bin_id: 'b', item_type: 'polo', size: 'YM', house: 'isibindi', qty: 2 },
  { bin_id: 'b', item_type: 'polo', size: 'YM', house: 'amistad', qty: 3 },
  { bin_id: 'b', item_type: 'polo', size: 'YL', house: 'isibindi', qty: -1 },
  { bin_id: 'a', item_type: 'dress-shirt', size: 'AS', house: '', qty: 1 },
];

describe('totals', () => {
  it('sums across bins per house and floors negatives per bin', () => {
    const t = totals(rows);
    const isi = t.find((x) => x.itemType === 'polo' && x.size === 'YM' && x.house === 'isibindi');
    expect(isi.qty).toBe(7);
    expect(isi.bins).toHaveLength(2);
    const ami = t.find((x) => x.itemType === 'polo' && x.size === 'YM' && x.house === 'amistad');
    expect(ami.qty).toBe(3);
    expect(t.find((x) => x.size === 'YL')).toBeUndefined();
  });
  it('treats missing house as any-house', () => {
    const t = totals([{ bin_id: 'a', item_type: 'polo', size: 'YM', qty: 2 }]);
    expect(t[0].house).toBe('');
  });
});

describe('byBin', () => {
  it('shapes rows per bin with house in the key', () => {
    const m = byBin(rows);
    expect(m.get('a').size).toBe(2);
    expect(m.get('b').get('polo|YM|isibindi').qty).toBe(2);
    expect(m.get('b').get('polo|YM|amistad').qty).toBe(3);
  });
});

describe('pickBin', () => {
  it('picks the deepest bin for the exact house', () => {
    expect(pickBin(rows, [], 'polo', 'YM', 'isibindi')).toBe('a');
    expect(pickBin(rows, [], 'polo', 'YM', 'amistad')).toBe('b');
  });
  it('never crosses houses', () => {
    expect(pickBin(rows, [], 'polo', 'YM', 'reveur')).toBeNull();
    expect(pickBin(rows, [], 'polo', 'YM', '')).toBeNull();
  });
  it('respects stock already promised, per house', () => {
    const assigned = [
      { status: 'assigned', bin_id: 'a', item_type: 'polo', size: 'YM', house: 'isibindi', qty: 4 },
    ];
    expect(pickBin(rows, assigned, 'polo', 'YM', 'isibindi', 2)).toBe('b');
    // a promise for isibindi doesn't block amistad stock
    expect(pickBin(rows, assigned, 'polo', 'YM', 'amistad', 3)).toBe('b');
  });
  it('prefers the requester\'s house bin even when another bin is deeper', () => {
    // bin a is deeper (5 vs 2), but b is the requester's house bin
    expect(pickBin(rows, [], 'polo', 'YM', 'isibindi', 1, ['b'])).toBe('b');
    // preference only applies when the preferred bin actually has the item
    expect(pickBin(rows, [], 'polo', 'YM', 'isibindi', 3, ['b'])).toBe('a');
    // neutral items also follow the house preference
    expect(pickBin(rows, [], 'dress-shirt', 'AS', '', 1, ['a'])).toBe('a');
  });
  it('returns null when nothing fits', () => {
    expect(pickBin(rows, [], 'polo', 'A2XL', 'isibindi')).toBeNull();
    const assigned = [
      { status: 'assigned', bin_id: 'a', item_type: 'polo', size: 'YM', house: 'isibindi', qty: 5 },
      { status: 'assigned', bin_id: 'b', item_type: 'polo', size: 'YM', house: 'isibindi', qty: 2 },
    ];
    expect(pickBin(rows, assigned, 'polo', 'YM', 'isibindi', 1)).toBeNull();
  });
});

describe('drift', () => {
  it('surfaces raw negative sums', () => {
    expect(drift(rows)).toEqual([
      { bin_id: 'b', item_type: 'polo', size: 'YL', house: 'isibindi', qty: -1 },
    ]);
  });
});

// One trip beats two: a bin already answering part of a request should answer
// the rest of it when it can.
describe('keeping a request in one pair of hands', () => {
  const rows = [
    // Shekita (Amistad) has polos but no khakis.
    { bin_id: 'ami', item_type: 'polo', size: 'M', house: 'amistad', qty: 6 },
    // Yelena (Altruismo) has both.
    { bin_id: 'alt', item_type: 'polo', size: 'M', house: 'amistad', qty: 2 },
    { bin_id: 'alt', item_type: 'pants-boys', size: '12', house: '', qty: 3 },
  ];

  it('sends a second item to the bin already chosen, when it has it', () => {
    // First line went to Shekita's bin on house preference.
    const first = pickBin(rows, [], 'polo', 'M', 'amistad', 1, ['ami']);
    expect(first).toBe('ami');
    // Second line: Shekita has no khakis, so the same-bin attempt can't hold.
    const same = pickBin(rows, [], 'pants-boys', '12', '', 1, ['ami']);
    expect(same).toBe('alt');
  });

  it('keeps both together when one holder can do both', () => {
    const both = [
      { bin_id: 'alt', item_type: 'polo', size: 'M', house: 'amistad', qty: 2 },
      { bin_id: 'alt', item_type: 'pants-boys', size: '12', house: '', qty: 3 },
      { bin_id: 'isi', item_type: 'pants-boys', size: '12', house: '', qty: 9 },
    ];
    // Even though Isibindi has far more khakis, preferring the bin already
    // chosen keeps it to one handoff.
    expect(pickBin(both, [], 'pants-boys', '12', '', 1, ['alt'])).toBe('alt');
  });
});

// A holder can carry several tubs. Polos in one and ties in another is still
// one car at one window, so the preference is over all of that person's bins.
describe('a holder with more than one bin', () => {
  const rows = [
    { bin_id: 'shek-polos', item_type: 'polo', size: 'M', house: 'amistad', qty: 4 },
    { bin_id: 'shek-ties', item_type: 'tie', size: 'OS', house: 'amistad', qty: 3 },
    { bin_id: 'kya-ties', item_type: 'tie', size: 'OS', house: 'amistad', qty: 20 },
  ];

  it('stays with the same person across their tubs', () => {
    // Shekita carries both of hers; pass both ids as preferred.
    const shekitas = ['shek-polos', 'shek-ties'];
    expect(pickBin(rows, [], 'polo', 'M', 'amistad', 1, shekitas)).toBe('shek-polos');
    // Even though Kya has far more ties, the tie comes from Shekita's other tub.
    expect(pickBin(rows, [], 'tie', 'OS', 'amistad', 1, shekitas)).toBe('shek-ties');
  });

  it('still goes elsewhere when that person genuinely does not have it', () => {
    expect(pickBin(rows, [], 'tie', 'OS', 'amistad', 1, ['shek-polos'])).toBe('kya-ties');
  });
});

// ---------------------------------------------------------------------------
// The count sheet: a grid of mostly-zeros in, only real changes out.
// ---------------------------------------------------------------------------
const binRows = [
  { bin_id: 'a', item_type: 'polo', size: 'M', house: 'amistad', qty: 6 },
  { bin_id: 'a', item_type: 'polo', size: 'L', house: 'amistad', qty: 2 },
  { bin_id: 'a', item_type: 'polo', size: '12H', house: 'amistad', qty: 3 }, // retired size
  { bin_id: 'a', item_type: 'vest', size: 'M', house: 'isibindi', qty: 1 },  // another house
  { bin_id: 'b', item_type: 'polo', size: 'M', house: 'amistad', qty: 99 },  // another bin
];

const cell = (itemType, size, qty, house = 'amistad') => ({ itemType, size, qty, house });

describe('sheetLines', () => {
  it('drops the zeros that were already zero', () => {
    const cells = [cell('polo', 'S', 0), cell('polo', 'M', 6), cell('polo', 'XL', 0)];
    expect(sheetLines(cells, binRows, 'a')).toEqual([
      { bin_id: 'a', item_type: 'polo', size: 'M', house: 'amistad', qty: 6 },
    ]);
  });

  it('keeps a size that had stock and now reads zero', () => {
    const out = sheetLines([cell('polo', 'L', 0)], binRows, 'a');
    expect(out).toEqual([
      { bin_id: 'a', item_type: 'polo', size: 'L', house: 'amistad', qty: 0 },
    ]);
  });

  it('leaves out anything the grid never showed', () => {
    const out = sheetLines([cell('polo', 'M', 6)], binRows, 'a');
    expect(out.find((l) => l.size === 'L')).toBeUndefined();
    expect(out.find((l) => l.size === '12H')).toBeUndefined();
  });

  it('never touches another bin', () => {
    expect(sheetLines([cell('polo', 'M', 1)], binRows, 'a')[0].bin_id).toBe('a');
  });

  it('takes the first row when a size appears twice', () => {
    const out = sheetLines([cell('polo', 'M', 4), cell('polo', 'M', 9)], binRows, 'a');
    expect(out).toHaveLength(1);
    expect(out[0].qty).toBe(4);
  });

  it('cleans up what a number input hands back', () => {
    const cells = [cell('polo', 'S', ''), cell('polo', 'M', '7'), cell('polo', 'L', -3)];
    expect(sheetLines(cells, binRows, 'a')).toEqual([
      { bin_id: 'a', item_type: 'polo', size: 'M', house: 'amistad', qty: 7 },
      { bin_id: 'a', item_type: 'polo', size: 'L', house: 'amistad', qty: 0 },
    ]);
  });

  it('treats a different house as a different pile', () => {
    const out = sheetLines([cell('vest', 'M', 0, 'amistad')], binRows, 'a');
    expect(out).toEqual([]); // the isibindi vest is untouched, not zeroed
  });
});

describe('sheetExtras', () => {
  const covered = ['polo|S|amistad', 'polo|M|amistad', 'polo|L|amistad', 'polo|XL|amistad'];

  it('surfaces a retired size and another house’s item', () => {
    expect(sheetExtras(binRows, 'a', covered)).toEqual([
      { itemType: 'polo', size: '12H', house: 'amistad', qty: 3, extra: true },
      { itemType: 'vest', size: 'M', house: 'isibindi', qty: 1, extra: true },
    ]);
  });

  it('stays quiet when the grid covers everything', () => {
    expect(sheetExtras(binRows, 'a', [...covered, 'polo|12H|amistad', 'vest|M|isibindi'])).toEqual([]);
  });
});

describe('sheetDirty', () => {
  it('is false for a sheet nobody typed in', () => {
    const cells = [cell('polo', 'M', 6), cell('polo', 'L', 2), cell('polo', 'S', 0)];
    expect(sheetDirty(cells, binRows, 'a')).toBe(false);
  });

  it('is true the moment a number changes', () => {
    expect(sheetDirty([cell('polo', 'M', 7)], binRows, 'a')).toBe(true);
  });

  it('is true when a stocked size is emptied', () => {
    expect(sheetDirty([cell('polo', 'L', 0)], binRows, 'a')).toBe(true);
  });
});
