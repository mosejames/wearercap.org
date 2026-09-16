// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import imageHandler from '../../api/vault-og.js';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });
const response = () => ({ headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, send(body) { this.body = body; } });

it('renders a cached 1200 by 630 PNG for an event', async () => {
  const res = response();
  await imageHandler({ query: { title: 'RCA Takeover at Sparkles', date: 'Friday, September 4' } }, res);
  expect(res.headers['Content-Type']).toBe('image/png');
  expect(res.headers['Cache-Control']).toContain('s-maxage=31536000');
  expect(res.body.subarray(1, 4).toString()).toBe('PNG');
  expect(res.body.readUInt32BE(16)).toBe(1200);
  expect(res.body.readUInt32BE(20)).toBe(630);
});

it('gives an event without photos its own named image and preserves the event destination', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'event-1', slug: 'welcome-party', title: 'AMI Welcome & Friends', starts_on: '2026-08-29', open: true }] }).mockResolvedValueOnce({ ok: true, json: async () => [] }));
  const { default: handler } = await import('../../api/vault-link.js');
  const res = response();
  await handler({ query: { slug: 'welcome-party' }, url: '/ami-vault/e/welcome-party' }, res);
  const image = res.body.match(/property="og:image" content="([^"]+)"/)[1].replaceAll('&amp;', '&');
  expect(new URL(image).searchParams.get('title')).toBe('AMI Welcome & Friends');
  expect(image).toContain('/api/vault-og?');
  expect(res.body).toContain('#/e/welcome-party');
  expect(res.body).toContain('property="og:image:width" content="1200"');
});

const photoId = '3bfa64fe-0b8f-4315-b7a0-5dd732728444';
const event = { id: 'event-1', slug: 'bingo-night', title: 'Bingo Night', starts_on: '2026-09-15', open: true };
const storedPhoto = { id: photoId, event_id: 'event-1', house: 'rcap', hidden: false, removed_at: null, storage: 'r2', web_key: 'rcap/photo/web.jpg', width: 2560, height: 1920 };
async function renderPhoto(photo = storedPhoto, ev = event, id = photoId) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test');
  vi.stubEnv('R2_PUBLIC_BASE', 'https://media.wearercap.org');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ev ? [ev] : [] })
    .mockResolvedValueOnce({ ok: true, json: async () => photo ? [photo] : [] }));
  const { default: handler } = await import('../../api/vault-link.js');
  const res = response();
  await handler({ query: { slug: 'bingo-night', vault: 'rcap', photo: id }, url: `/rcap-capsule/e/bingo-night/p/${id}` }, res);
  return res;
}
it('previews the existing R2 photo and opens that exact photo without generating a card', async () => {
  const res = await renderPhoto();
  expect(res.body).toContain('property="og:image" content="https://media.wearercap.org/rcap/photo/web.jpg"');
  expect(res.body).toContain('property="og:image:type" content="image/jpeg"');
  expect(res.body).toContain('property="og:image:width" content="1800"');
  expect(res.body).toContain('property="og:image:height" content="1350"');
  expect(res.body).toContain('property="og:title" content="Bingo Night · RCAP Capsule"');
  expect(res.body).toContain(`property="og:url" content="https://wearercap.org/rcap-capsule/e/bingo-night/p/${photoId}"`);
  expect(res.body).toContain(`window.location.replace("https://wearercap.org/rcap-capsule/#/e/bingo-night/p/${photoId}")`);
  expect(res.body).not.toContain('/api/vault-og?');
  expect(res.headers['Cache-Control']).toBe('no-store');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][0]).toContain('hidden=eq.false&removed_at=is.null');
});
it('supports older photos that remain in Supabase storage', async () => {
  const res = await renderPhoto({ ...storedPhoto, storage: 'supabase', width: 1200, height: 1800 });
  expect(res.body).toContain('https://example.supabase.co/storage/v1/object/public/vault-media/rcap/photo/web.jpg');
  expect(res.body).toContain('property="og:image:width" content="1200"');
  expect(res.body).toContain('property="og:image:height" content="1800"');
});
it.each([
  ['missing', null], ['hidden', { ...storedPhoto, hidden: true }],
  ['removed', { ...storedPhoto, removed_at: '2026-09-16' }],
  ['wrong event', { ...storedPhoto, event_id: 'another-event' }],
  ['wrong vault', { ...storedPhoto, house: 'amistad' }],
])('falls back to the event card for a %s photo without exposing its image', async (_label, photo) => {
  const res = await renderPhoto(photo);
  expect(res.body).toContain('/api/vault-og?');
  expect(res.body).not.toContain('media.wearercap.org/rcap/photo');
  expect(res.body).not.toContain(`/p/${photoId}`);
  expect(res.body).toContain('#/e/bingo-night');
});
it('does not look up a photo in a hidden event', async () => {
  const res = await renderPhoto(storedPhoto, { ...event, hidden: true });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(res.body).not.toContain(`/p/${photoId}`);
  expect(res.body).not.toContain('media.wearercap.org');
});
it('rejects invalid photo identifiers before querying photos', async () => {
  const res = await renderPhoto(storedPhoto, event, 'invalid');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(res.body).toContain('/api/vault-og?');
});
