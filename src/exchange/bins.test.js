import { describe, expect, it } from 'vitest';
import { binItemTypes } from './bins.js';

const types = [
  { id: 'polo', size_set: 'tops' },
  { id: 'vest', size_set: 'tops' },
  { id: 'pants-boys', size_set: 'boys-bottoms' },
  { id: 'skirt', size_set: 'girls-bottoms' },
  { id: 'shorts-girls', size_set: 'girls-bottoms' },
];
describe('bin contents', () => {
  it('keeps house uniforms separate from shared bottoms', () => {
    expect(binItemTypes({ focus: '' }, types).map(t => t.id)).toEqual(['polo', 'vest']);
  });
  it('keeps the bottoms scope when its holder or house changes', () => {
    for (const holder_house of ['amistad', 'isibindi', '']) {
      expect(binItemTypes({ focus: 'Bottoms only', holder_house }, types).map(t => t.id))
        .toEqual(['pants-boys', 'skirt', 'shorts-girls']);
    }
  });
});
