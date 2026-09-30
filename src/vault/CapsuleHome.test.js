import { describe, expect, it } from 'vitest';
import { pickCoverPhotos, pickEvents, whenLabel, ago } from './CapsuleHome.jsx';

const ev = (slug, startsOn, extra = {}) => ({ id: slug, slug, title: slug, startsOn, kind: 'school', ...extra });
const events = [
  ev('everyday-rca', '2026-08-26', { kind: 'everyday', ongoing: true }),
  ev('bingo-night', '2026-09-15'),
  ev('karaoke-night', '2026-09-27'),
  ev('hidden-thing', '2026-09-20', { hidden: true }),
];

describe('Capsule home', () => {
  it('shows karaoke as next and bingo as latest the day before', () => {
    const r = pickEvents(events, '2026-09-26');
    expect(r.next.slug).toBe('karaoke-night');
    expect(r.latest.slug).toBe('bingo-night');
    expect(r.everyday.slug).toBe('everyday-rca');
    expect(r.albums.map((e) => e.slug)).toEqual(['bingo-night', 'everyday-rca']);
  });
  it('makes karaoke the latest on the day, with nothing next', () => {
    const r = pickEvents(events, '2026-09-27');
    expect(r.latest.slug).toBe('karaoke-night');
    expect(r.next).toBeNull();
    expect(r.albums.map((e) => e.slug)).toEqual(['karaoke-night', 'bingo-night', 'everyday-rca']);
  });
  it('labels when the next event is', () => {
    expect(whenLabel('2026-09-27', '2026-09-26')).toBe('Tomorrow');
    expect(whenLabel('2026-10-20', '2026-09-26')).toBe('In 24 days');
  });
  it('says how long ago a comment was', () => {
    const now = Date.parse('2026-09-26T14:00:00Z');
    expect(ago('2026-09-26T13:58:00Z', now)).toBe('2m ago');
    expect(ago('2026-09-26T10:00:00Z', now)).toBe('4h ago');
  });
  it('randomizes among photos that fit the preview slots', () => {
    const photos = [
      { id: 'portrait', width: 800, height: 1600 },
      { id: 'wide-a', width: 1600, height: 1000 },
      { id: 'wide-b', width: 1500, height: 1000 },
      { id: 'wide-c', width: 1700, height: 1000 },
      { id: 'wide-d', width: 1800, height: 1000 },
      { id: 'square', width: 1000, height: 1000 },
    ];
    const low = pickCoverPhotos(photos, 16 / 10, () => 0.5);
    const high = pickCoverPhotos(photos, 16 / 10, () => 0.99);
    expect(low).toHaveLength(4);
    expect(low.every((p) => p.id.startsWith('wide-'))).toBe(true);
    expect(high.every((p) => p.id.startsWith('wide-'))).toBe(true);
    expect(low.map((p) => p.id)).not.toEqual(high.map((p) => p.id));
  });
});
