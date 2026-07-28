import { describe, it, expect } from 'vitest';
import { byBin, totals, pickBin, drift } from './inventory.js';

const rows = [
  { bin_id: 'a', item_type: 'polo', size: 'YM', qty: 5 },
  { bin_id: 'b', item_type: 'polo', size: 'YM', qty: 2 },
  { bin_id: 'b', item_type: 'polo', size: 'YL', qty: -1 },
  { bin_id: 'a', item_type: 'sweater', size: 'AS', qty: 1 },
];

describe('totals', () => {
  it('sums across bins and floors negatives per bin', () => {
    const t = totals(rows);
    const polos = t.find((x) => x.itemType === 'polo' && x.size === 'YM');
    expect(polos.qty).toBe(7);
    expect(polos.bins).toHaveLength(2);
    expect(t.find((x) => x.size === 'YL')).toBeUndefined();
  });
});

describe('byBin', () => {
  it('shapes rows per bin', () => {
    const m = byBin(rows);
    expect(m.get('a').size).toBe(2);
    expect(m.get('b').get('polo|YM').qty).toBe(2);
  });
});

describe('pickBin', () => {
  it('picks the deepest bin', () => {
    expect(pickBin(rows, [], 'polo', 'YM')).toBe('a');
  });
  it('respects stock already promised to assigned requests', () => {
    const assigned = [
      { status: 'assigned', bin_id: 'a', item_type: 'polo', size: 'YM', qty: 4 },
    ];
    expect(pickBin(rows, assigned, 'polo', 'YM', 2)).toBe('b');
  });
  it('returns null when nothing fits', () => {
    expect(pickBin(rows, [], 'polo', 'A2XL')).toBeNull();
    const assigned = [
      { status: 'assigned', bin_id: 'a', item_type: 'polo', size: 'YM', qty: 5 },
      { status: 'assigned', bin_id: 'b', item_type: 'polo', size: 'YM', qty: 2 },
    ];
    expect(pickBin(rows, assigned, 'polo', 'YM', 1)).toBeNull();
  });
});

describe('drift', () => {
  it('surfaces raw negative sums', () => {
    expect(drift(rows)).toEqual([{ bin_id: 'b', item_type: 'polo', size: 'YL', qty: -1 }]);
  });
});
