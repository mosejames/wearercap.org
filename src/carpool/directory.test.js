import { describe, it, expect } from 'vitest';
import { milesBetween, rankNearby } from './directory.js';

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
