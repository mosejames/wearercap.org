import { describe, it, expect } from 'vitest';
import { NYC, dayOf, visiblePhotos, storageKey } from './config.js';
import { tripCard, serveTripCard } from '../../server/trip-link.js';
const id = '11111111-1111-4111-8111-111111111111';
const event = { id: 'nyc-event', slug: 'the-whole-adventure', vault: NYC.id, hidden: false, title: 'The whole adventure' };
const photo = { id, vault: NYC.id, event_id: event.id, hidden: false, storage: 'r2', web_key: `nyc-2026/owner/the-whole-adventure/${id}/web.jpg`, takenAt: '2026-10-22T02:00:00Z' };
const input = { event, photo, slug: event.slug, id, publicBase: 'https://media.example.org' };
describe('NYC isolation and chronology', () => {
    it('groups late evening by New York capture time', () => expect(dayOf(photo)).toBe('2026-10-21'));
    it('does not invent a capture day', () => expect(dayOf({ createdAt: '2026-10-22T02:00:00Z' })).toBe(''));
    it('excludes other vaults and hidden photos', () => expect(visiblePhotos([photo, { ...photo, vault: 'london-2028' }, { ...photo, hidden: true }])).toEqual([photo]));
    it('always scopes object paths', () => { expect(storageKey('aabbccdd', 'the-whole-adventure', id, 'web.jpg')).toMatch(/^nyc-2026\//); expect(() => storageKey('aabbccdd', '../london', id, 'web.jpg')).toThrow(); });
});
describe('exact photo share cards', () => {
    it('uses only the requested photo web rendition and opens that photo', () => { const card = tripCard(input); expect(card.image).toBe(`https://media.example.org/${photo.web_key}`); expect(card.destination).toContain(`#/e/${event.slug}/p/${id}`); });
    for (const [label, change] of [['hidden', { photo: { ...photo, hidden: true } }], ['other vault', { photo: { ...photo, vault: 'london-2028' } }], ['other album', { photo: { ...photo, event_id: 'london-event' } }], ['other storage prefix', { photo: { ...photo, web_key: 'london-2028/photo/web.jpg' } }], ['missing', { photo: null }], ['hidden event', { event: { ...event, hidden: true } }], ['traversal', { photo: { ...photo, web_key: 'nyc-2026/../london/web.jpg' } }]])
        it(`falls back for ${label}`, () => { expect(tripCard({ ...input, ...change }).image).toBe(NYC.ogImage); expect(tripCard({ ...input, ...change }).destination).not.toContain('/p/'); });
    it('rechecks visibility on fresh requests', async () => { let hidden = false, calls = 0; const headers = {}; let body = ''; const res = { setHeader: (k, v) => headers[k] = v, status: () => res, send: v => body = v }; const options = { lookupEvent: async () => event, lookupVisiblePhoto: async () => { calls++; return { ...photo, hidden }; }, publicBase: input.publicBase }; await serveTripCard({ query: { slug: event.slug, photo: id } }, res, options); expect(body).toContain(input.publicBase); hidden = true; await serveTripCard({ query: { slug: event.slug, photo: id } }, res, options); expect(body).toContain(NYC.ogImage); expect(calls).toBe(2); expect(headers['Cache-Control']).toBe('no-store'); });
});
