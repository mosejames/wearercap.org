import { describe, it, expect } from 'vitest';
import { stockByHouse } from './inventory.js';

const BINS = [
  { id: 'b1', code: 'AMI-1', name: 'Amistad Bin', holder_name: 'Shekita James' },
  { id: 'b2', code: 'ALT-1', name: 'Altruismo Bin', holder_name: 'Yelena Gaston' },
];

const INV = [
  { bin_id: 'b1', item_type: 'polo', size: 'YM', house: 'amistad', qty: 3 },
  { bin_id: 'b2', item_type: 'polo', size: 'YM', house: 'amistad', qty: 1 },
  { bin_id: 'b1', item_type: 'pants-boys', size: '12', house: '', qty: 2 },
];

describe('stockByHouse', () => {
  it('groups by house and keeps a running total', () => {
    const out = stockByHouse(INV, BINS, []);
    expect(out.map((h) => h.house)).toEqual(['amistad', '']);
    expect(out[0].onHand).toBe(4);
    expect(out[1].onHand).toBe(2);
  });

  it('says which bin each one is in, deepest first', () => {
    const [amistad] = stockByHouse(INV, BINS, []);
    const ym = amistad.types[0].sizes.find((s) => s.size === 'YM');
    expect(ym.qty).toBe(4);
    expect(ym.where.map((w) => `${w.code}:${w.qty}`)).toEqual(['AMI-1:3', 'ALT-1:1']);
    expect(ym.where[0].holder).toBe('Shekita James');
  });

  it('separates what is already spoken for from what is free', () => {
    const reqs = [
      { item_type: 'polo', size: 'YM', house: 'amistad', qty: 2, status: 'assigned' },
      { item_type: 'polo', size: 'YM', house: 'amistad', qty: 1, status: 'fulfilled' },
    ];
    const [amistad] = stockByHouse(INV, BINS, reqs);
    const ym = amistad.types[0].sizes[0];
    expect(ym.promised).toBe(2);
    expect(ym.free).toBe(2);
    expect(amistad.promised).toBe(2);
  });

  it('never promises more than exists', () => {
    const reqs = Array.from({ length: 9 }, () => (
      { item_type: 'polo', size: 'YM', house: 'amistad', qty: 1, status: 'scheduled' }
    ));
    const [amistad] = stockByHouse(INV, BINS, reqs);
    expect(amistad.types[0].sizes[0].promised).toBe(4);
    expect(amistad.types[0].sizes[0].free).toBe(0);
  });

  it('surfaces waitlisted sizes nobody has', () => {
    const reqs = [
      { item_type: 'skirt', size: '10', house: '', qty: 1, status: 'open' },
      { item_type: 'polo', size: 'YM', house: 'amistad', qty: 1, status: 'open' },
    ];
    const out = stockByHouse(INV, BINS, reqs);
    const any = out.find((h) => h.house === '');
    expect(any.shortages).toEqual([{ itemType: 'skirt', size: '10', qty: 1 }]);
    // We have Amistad YM polos, so that one isn't a shortage.
    expect(out.find((h) => h.house === 'amistad').shortages).toEqual([]);
  });

  it('holds up with nothing at all', () => {
    expect(stockByHouse([], [], [])).toEqual([]);
    expect(stockByHouse(null, null, null)).toEqual([]);
  });

  it('keeps a bin that drifted negative from eating another bin’s stock', () => {
    const out = stockByHouse(
      [...INV, { bin_id: 'b2', item_type: 'pants-boys', size: '12', house: '', qty: -5 }],
      BINS, []
    );
    expect(out.find((h) => h.house === '').onHand).toBe(2);
  });
});
