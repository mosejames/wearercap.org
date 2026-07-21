import { describe, it, expect } from 'vitest';
import { crewLabel, suggestCrew } from './crews.js';

describe('crewLabel', () => {
  it('labels by the dominant ZIP place name', () => {
    expect(crewLabel(['30337', '30337', '30344'])).toBe('College Park crew');
  });

  it('maps East Point, Decatur, Conyers ZIPs', () => {
    expect(crewLabel(['30344'])).toBe('East Point crew');
    expect(crewLabel(['30030', '30032'])).toBe('Decatur crew');
    expect(crewLabel(['30012', '30013', '30013'])).toBe('Conyers crew');
  });

  it('maps the several Atlanta ZIPs to Atlanta', () => {
    expect(crewLabel(['30315'])).toBe('Atlanta crew');
    expect(crewLabel(['30288'])).toBe('Atlanta crew');
  });

  it('breaks a tie toward the ZIP that appears first (nearest-first order)', () => {
    // 30344 (East Point) and 30337 (College Park) each appear once. The first
    // entry wins, which is the nearest family because rows arrive nearest-first.
    expect(crewLabel(['30344', '30337'])).toBe('East Point crew');
    expect(crewLabel(['30337', '30344'])).toBe('College Park crew');
  });

  it('falls back to "Families near you" for an unknown dominant ZIP', () => {
    expect(crewLabel(['99999', '99999', '30337'])).toBe('Families near you');
  });

  it('falls back to "Families near you" for an empty list', () => {
    expect(crewLabel([])).toBe('Families near you');
  });

  it('tolerates a label that carries more than the bare ZIP', () => {
    expect(crewLabel(['College Park, GA 30337'])).toBe('College Park crew');
  });

  it('a single family is enough to name a crew', () => {
    expect(crewLabel(['30281'])).toBe('Stockbridge crew');
  });
});

describe('suggestCrew', () => {
  // Minimal fetchNearby-shaped rows: nearest-first, each with distance_miles.
  const row = (user_id, distance_miles, area_label) => ({
    user_id,
    parent_name: `Parent ${user_id}`,
    child_names: 'Kid',
    area_label,
    distance_miles,
  });

  it('returns null when there are no nearby rows', () => {
    expect(suggestCrew([])).toBeNull();
  });

  it('returns null when nobody is inside the crew radius', () => {
    const rows = [row('a', 7, '30337'), row('b', 9, '30344')];
    expect(suggestCrew(rows, { crewRadiusMiles: 5 })).toBeNull();
  });

  it('suggests a crew from a single in-radius family', () => {
    const rows = [row('a', 2.1, '30337')];
    const crew = suggestCrew(rows);
    expect(crew).not.toBeNull();
    expect(crew.families.map((f) => f.user_id)).toEqual(['a']);
    expect(crew.label).toBe('College Park crew');
  });

  it('keeps only the families within the crew radius', () => {
    const rows = [row('a', 1, '30337'), row('b', 4.9, '30337'), row('c', 6, '30344')];
    const crew = suggestCrew(rows, { crewRadiusMiles: 5 });
    expect(crew.families.map((f) => f.user_id)).toEqual(['a', 'b']);
  });

  it('includes a family exactly at the radius boundary', () => {
    const rows = [row('a', 5, '30337')];
    const crew = suggestCrew(rows, { crewRadiusMiles: 5 });
    expect(crew.families.map((f) => f.user_id)).toEqual(['a']);
  });

  it('preserves the nearest-first ordering of the input', () => {
    const rows = [row('a', 1, '30337'), row('b', 2, '30337'), row('c', 3, '30337')];
    const crew = suggestCrew(rows);
    expect(crew.families.map((f) => f.user_id)).toEqual(['a', 'b', 'c']);
  });

  it('caps the crew at max families', () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(`f${i}`, i * 0.1, '30337'));
    const crew = suggestCrew(rows, { max: 8 });
    expect(crew.families).toHaveLength(8);
    expect(crew.families.map((f) => f.user_id)).toEqual([
      'f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7',
    ]);
  });

  it('labels the crew from the families that qualify, not the ones filtered out', () => {
    // The far family is East Point; the two near families are College Park.
    const rows = [row('a', 1, '30337'), row('b', 2, '30337'), row('c', 20, '30344')];
    const crew = suggestCrew(rows, { crewRadiusMiles: 5 });
    expect(crew.label).toBe('College Park crew');
  });
});
