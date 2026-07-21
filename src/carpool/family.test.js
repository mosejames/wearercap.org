import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildFamilyRecord, setFamilyRadius } from './family.js';
import { supabase } from './supabaseClient.js';

vi.mock('./supabaseClient.js', () => ({
  supabase: { from: vi.fn() },
}));

// A thenable that records the builder calls made on it and resolves to a fixed
// { data, error } the way a supabase query does. (Same shape as groups.test.js.)
function chain(result) {
  const calls = [];
  const link = (name) => (...args) => { calls.push([name, ...args]); return builder; };
  const builder = {
    calls,
    update: link('update'),
    eq: link('eq'),
    then: (onOk, onErr) => Promise.resolve(result).then(onOk, onErr),
  };
  return builder;
}

const base = {
  userId: 'u1',
  parentName: 'Pat Parent',
  childNames: 'Kid One, Kid Two',
  place: { formattedAddress: '123 Main St, College Park, GA 30349', lat: 33.65, lng: -84.44, postalCode: '30349' },
  areaGeocode: { lat: 33.66, lng: -84.49, label: '30349' },
  direction: 'both',
  weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  contactPhone: '404-555-0100',
  contactEmail: 'pat@example.com',
};

describe('buildFamilyRecord', () => {
  it('maps inputs to the families row shape', () => {
    const r = buildFamilyRecord(base);
    expect(r).toEqual({
      user_id: 'u1',
      parent_name: 'Pat Parent',
      child_names: 'Kid One, Kid Two',
      address: '123 Main St, College Park, GA 30349',
      lat: 33.65,
      lng: -84.44,
      area_lat: 33.66,
      area_lng: -84.49,
      area_label: '30349',
      direction: 'both',
      weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      contact_phone: '404-555-0100',
      contact_email: 'pat@example.com',
    });
  });

  it('allows a null phone', () => {
    const r = buildFamilyRecord({ ...base, contactPhone: '' });
    expect(r.contact_phone).toBeNull();
  });

  it('rejects an invalid direction', () => {
    expect(() => buildFamilyRecord({ ...base, direction: 'evening' })).toThrow();
  });

  it('rejects an empty weekdays list', () => {
    expect(() => buildFamilyRecord({ ...base, weekdays: [] })).toThrow();
  });

  it('rejects a weekday outside mon..fri', () => {
    expect(() => buildFamilyRecord({ ...base, weekdays: ['sun'] })).toThrow();
  });

  it('rejects a missing required field', () => {
    expect(() => buildFamilyRecord({ ...base, parentName: '' })).toThrow();
  });
});

describe('setFamilyRadius', () => {
  beforeEach(() => { supabase.from.mockReset(); });

  it('writes a numeric radius on the caller\'s own row and touches no other column', async () => {
    const builder = chain({ error: null });
    supabase.from.mockReturnValue(builder);
    await setFamilyRadius('u1', 8);
    expect(supabase.from).toHaveBeenCalledWith('families');
    expect(builder.calls).toEqual([
      ['update', { radius_miles: 8 }],
      ['eq', 'user_id', 'u1'],
    ]);
  });

  it('clears back to the adaptive default by writing null', async () => {
    const builder = chain({ error: null });
    supabase.from.mockReturnValue(builder);
    await setFamilyRadius('u1', null);
    expect(builder.calls).toEqual([
      ['update', { radius_miles: null }],
      ['eq', 'user_id', 'u1'],
    ]);
  });

  it('accepts the [1, 25] bounds', async () => {
    supabase.from.mockReturnValue(chain({ error: null }));
    await expect(setFamilyRadius('u1', 1)).resolves.toBeUndefined();
    await expect(setFamilyRadius('u1', 25)).resolves.toBeUndefined();
  });

  it('rejects a radius outside [1, 25] without writing', async () => {
    await expect(setFamilyRadius('u1', 0)).rejects.toThrow();
    await expect(setFamilyRadius('u1', 26)).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric radius without writing', async () => {
    await expect(setFamilyRadius('u1', '5')).rejects.toThrow();
    await expect(setFamilyRadius('u1', NaN)).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('requires a userId', async () => {
    await expect(setFamilyRadius('', 5)).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('throws when the update errors', async () => {
    supabase.from.mockReturnValue(chain({ error: { message: 'nope' } }));
    await expect(setFamilyRadius('u1', 5)).rejects.toThrow('nope');
  });
});
