import { expect, it } from 'vitest';
import { sortGallery } from './gallerySort.js';
const photos = [
  { id: 'late', owner: 'one', takenAt: '2026-09-27T23:00:00Z', createdAt: '2026-09-28T01:00:00Z', likes: 3 },
  { id: 'early', owner: 'two', takenAt: '2026-09-27T18:00:00-04:00', createdAt: '2026-09-28T02:00:00Z', likes: 1 },
  { id: 'fallback', owner: 'three', takenAt: 'invalid', createdAt: '2026-09-27T22:30:00Z', likes: 5 },
];
const ids = (list, order) => sortGallery(list, order).map(p => p.id);
it('orders contributors together by capture time with upload dates as fallback', () => {
  expect(ids(photos)).toEqual(['early', 'fallback', 'late']);
  expect(ids(photos, 'taken-new')).toEqual(['late', 'fallback', 'early']);
  expect(photos[0].id).toBe('late');
});
it('inserts a later upload into its chronological position and excludes removed photos', () => {
  expect(ids([...photos,
    { id: 'incoming', takenAt: '2026-09-27T22:15:00Z', createdAt: '2026-09-29T00:00:00Z' },
    { id: 'hidden', hidden: true }, { id: 'removed', removedAt: '2026-09-28' },
  ])).toEqual(['early', 'incoming', 'fallback', 'late']);
});
it('supports upload and like ordering with deterministic date ties', () => {
  expect(ids(photos, 'new')).toEqual(['early', 'late', 'fallback']);
  expect(ids(photos, 'loved')).toEqual(['fallback', 'late', 'early']);
  const tied = [{ ...photos[0], id: 'b' }, { ...photos[0], id: 'a' }];
  expect(ids(tied)).toEqual(['a', 'b']);
  expect(ids([...tied].reverse())).toEqual(['a', 'b']);
});
