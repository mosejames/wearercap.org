import { describe, expect, it } from 'vitest';
import { keysFor } from '../../api/vault-sign.js';
import { HOUSE, IS_SCHOOL, WORDS, RCA_HOUSES, rcaHouse } from './config.js';

describe('school-wide vault', () => {
  it('stays the Amistad Vault when the page does not say otherwise', () => {
    expect(HOUSE.id).toBe('amistad');
    expect(IS_SCHOOL).toBe(false);
    expect(WORDS.family).toBe('Amistad family');
  });

  it('files RCAP uploads under their own prefix, and old clients under Amistad', () => {
    expect(keysFor('bingo-night', 'x', 'jpg', 'u', 'rcap').orig).toBe('rcap/2026-27/u/bingo-night/x/orig.jpg');
    expect(keysFor('bingo-night', 'x', 'jpg', 'u').orig).toBe('amistad/2026-27/u/bingo-night/x/orig.jpg');
    expect(keysFor('bingo-night', 'x', 'jpg', 'u', '../evil').orig.startsWith('amistad/')).toBe(true);
  });

  it('knows all four houses by the ids the database checks', () => {
    expect(RCA_HOUSES.map((h) => h.id)).toEqual(['amistad', 'altruismo', 'isibindi', 'reveur']);
    expect(rcaHouse('reveur').name).toBe('Rêveur');
    expect(rcaHouse('nope')).toBeNull();
  });
});
