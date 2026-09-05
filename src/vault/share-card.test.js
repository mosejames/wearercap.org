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
