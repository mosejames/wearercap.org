import { describe, it, expect } from 'vitest';
import { byBin, totals, pickBin, drift } from './inventory.js';

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
