import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabaseClient.js', () => ({ supabase: { rpc: vi.fn() } }));

const { supabase } = await import('./supabaseClient.js');
const { splitNeighbors, areaTitle, distanceLine, firstName, cameFromIntro, setInterest, fetchNeighbors } =
  await import('./neighbors.js');

describe('neighbors helpers', () => {
  it('splits matches from nearby families', () => {
    const { matches, nearby } = splitNeighbors([
      { user_id: 'a', mutual: true },
      { user_id: 'b', mutual: false },
      { user_id: 'c', mutual: false },
    ]);
    expect(matches.map((r) => r.user_id)).toEqual(['a']);
    expect(nearby.map((r) => r.user_id)).toEqual(['b', 'c']);
    expect(splitNeighbors(null)).toEqual({ matches: [], nearby: [] });
  });

  it('names an area, never a family', () => {
    expect(areaTitle({ area_label: '30291', parent_name: 'Should Not Show' })).toBe('A family in Union City');
    expect(areaTitle({ area_label: '99999' })).toBe('A family in area 99999');
    expect(areaTitle({})).toBe('A family near you');
  });

  it('describes distance between areas', () => {
    expect(distanceLine(0)).toBe('Same area as you');
    expect(distanceLine(1.2)).toBe('About 1 mile between areas');
    expect(distanceLine(3.4)).toBe('About 3 miles between areas');
    expect(distanceLine(null)).toBe('');
  });

  it('takes a first name and reads the intro flag', () => {
    expect(firstName('  Taylor  Reed ')).toBe('Taylor');
    expect(firstName(null)).toBe('');
    expect(cameFromIntro('?from=intro')).toBe(true);
    expect(cameFromIntro('?from=other')).toBe(false);
    expect(cameFromIntro('')).toBe(false);
  });
});

describe('neighbors rpc', () => {
  it('sends interest through the definer rpc only', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: { interested: true, mutual: true }, error: null });
    await expect(setInterest('fam-1', true)).resolves.toEqual({ interested: true, mutual: true });
    expect(supabase.rpc).toHaveBeenLastCalledWith('set_carpool_interest', { p_family: 'fam-1', p_interested: true });
    await expect(setInterest('', true)).rejects.toThrow('A family is required.');
  });

  it('surfaces server errors', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: new Error('That family is no longer in your search area.') });
    await expect(setInterest('fam-2', true)).rejects.toThrow('no longer in your search area');
    supabase.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(fetchNeighbors()).resolves.toEqual([]);
  });
});
