import { describe, it, expect, vi, beforeEach } from 'vitest';
import { milesBetween, rankNearby, fetchNearby, isMissingRpcError } from './directory.js';
import { supabase } from './supabaseClient.js';

vi.mock('./supabaseClient.js', () => ({
  supabase: { rpc: vi.fn() },
}));

const CP = { lat: 33.6534, lng: -84.4494 };   // College Park
const DECATUR = { lat: 33.7748, lng: -84.2963 };

describe('milesBetween', () => {
  it('is zero for identical points', () => {
    expect(milesBetween(CP.lat, CP.lng, CP.lat, CP.lng)).toBe(0);
  });
  it('College Park to Decatur is roughly 12-14 miles', () => {
    const d = milesBetween(CP.lat, CP.lng, DECATUR.lat, DECATUR.lng);
    expect(d).toBeGreaterThan(11);
    expect(d).toBeLessThan(15);
  });
  it('is symmetric', () => {
    expect(milesBetween(CP.lat, CP.lng, DECATUR.lat, DECATUR.lng))
      .toBeCloseTo(milesBetween(DECATUR.lat, DECATUR.lng, CP.lat, CP.lng), 10);
  });
});

describe('rankNearby', () => {
  const me = { user_id: 'me', area_lat: CP.lat, area_lng: CP.lng };
  const families = [
    { user_id: 'far', parent_name: 'Far Fam', area_lat: DECATUR.lat, area_lng: DECATUR.lng },
    { user_id: 'me', parent_name: 'Me', area_lat: CP.lat, area_lng: CP.lng },
    { user_id: 'near', parent_name: 'Near Fam', area_lat: 33.66, area_lng: -84.45 },
  ];
  it('excludes self, sorts by distance, annotates distanceMiles', () => {
    const r = rankNearby(me, families);
    expect(r.map((f) => f.user_id)).toEqual(['near', 'far']);
    expect(r[0].distanceMiles).toBeLessThan(r[1].distanceMiles);
    expect(typeof r[0].distanceMiles).toBe('number');
  });
  it('respects limit', () => {
    expect(rankNearby(me, families, { limit: 1 })).toHaveLength(1);
  });
  it('handles empty input', () => {
    expect(rankNearby(me, [])).toEqual([]);
  });
});

describe('fetchNearby', () => {
  beforeEach(() => { supabase.rpc.mockReset(); });

  it('calls the nearby_families RPC and returns its rows', async () => {
    const rows = [{ user_id: 'a', distance_miles: 2, distance_to_school_miles: 6 }];
    supabase.rpc.mockResolvedValue({ data: rows, error: null });
    expect(await fetchNearby()).toEqual(rows);
    expect(supabase.rpc).toHaveBeenCalledWith('nearby_families');
  });

  it('returns an empty array when the RPC yields null data', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    expect(await fetchNearby()).toEqual([]);
  });

  it('throws when the RPC returns an error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchNearby()).rejects.toEqual({ message: 'boom' });
  });
});

describe('isMissingRpcError', () => {
  it('matches the PostgREST missing-function code', () => {
    expect(isMissingRpcError({ code: 'PGRST202' })).toBe(true);
  });
  it('matches a "could not find the function ... schema cache" message', () => {
    expect(isMissingRpcError({
      message: 'Could not find the function public.nearby_families without parameters in the schema cache',
    })).toBe(true);
  });
  it('does not match an unrelated error', () => {
    expect(isMissingRpcError({ code: 'PGRST301', message: 'permission denied' })).toBe(false);
  });
  it('does not match a null/absent error', () => {
    expect(isMissingRpcError(null)).toBe(false);
    expect(isMissingRpcError(undefined)).toBe(false);
  });
});
