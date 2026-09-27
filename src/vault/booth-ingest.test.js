// @vitest-environment node
import crypto from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { photoIdFor, parseSession, verifySignature, isVerificationSample } from '../../api/booth-ingest.js';

const SECRET = 'test-webhook-secret';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function invoke(body, validSignature = true) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon');
  vi.stubEnv('SNAPPIC_WEBHOOK_SECRET', SECRET);
  vi.stubEnv('SUPABASE_BOOTH_REFRESH_TOKEN', 'test-refresh');
  vi.resetModules();
  const { default: handler } = await import('../../api/booth-ingest.js');
  const raw = Buffer.from(JSON.stringify(body));
  const req = {
    method: 'POST', headers: { 'x-signature': validSignature ? crypto.createHmac('sha256', SECRET).update(raw).digest('hex') : 'bad', host: 'wearercap.org' },
    async *[Symbol.asyncIterator]() { yield raw; },
  };
  const res = { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler(req, res);
  return res;
}

it('recognizes only the observed reserved verification URL', () => {
  expect(isVerificationSample('https://example.com/session/abc123.gif')).toBe(true);
  for (const url of ['https://capture.omgbooth.com/session/abc123.gif', 'https://example.com/session/real.gif', 'https://example.com/session/abc123.gif?real=1', undefined]) {
    expect(isVerificationSample(url)).toBe(false);
  }
});

it('acknowledges a signed dashboard probe without downloading or uploading', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const res = await invoke({ session: { id: 'probe', direct_url: 'https://example.com/session/abc123.gif', type: 'gif' } });
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ ok: true, skipped: 'verification-sample' });
  expect(fetch).not.toHaveBeenCalled();
});

it('still rejects an unsigned verification sample', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const res = await invoke({ session: { direct_url: 'https://example.com/session/abc123.gif' } }, false);
  expect(res.statusCode).toBe(401);
  expect(fetch).not.toHaveBeenCalled();
});

it('keeps a missing real capture retryable instead of accepting it as a probe', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => [] })
    .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'event', slug: 'karaoke-night' }] })
    .mockResolvedValueOnce({ ok: false, status: 404 }));
  const res = await invoke({ session: { id: 'real', direct_url: 'https://capture.omgbooth.com/missing.jpg', type: 'still' } });
  expect(res.statusCode).toBe(500);
  expect(res.body).toEqual({ ok: false, error: 'ingest failed' });
});

it('derives a stable, valid UUID v5 per Snappic session id', () => {
  const a = photoIdFor('sess-123');
  const b = photoIdFor('sess-123');
  const c = photoIdFor('sess-456');
  expect(a).toBe(b);
  expect(a).not.toBe(c);
  expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

it('accepts a hex HMAC-SHA256 signature', () => {
  const raw = Buffer.from(JSON.stringify({ session: { id: 'x' } }));
  const sig = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
  expect(verifySignature(raw, sig, SECRET)).toBe(true);
});

it('accepts a base64 HMAC-SHA256 signature', () => {
  const raw = Buffer.from('hello');
  const sig = crypto.createHmac('sha256', SECRET).update(raw).digest('base64');
  expect(verifySignature(raw, sig, SECRET)).toBe(true);
});

it('rejects a wrong signature, a missing secret, and a missing header', () => {
  const raw = Buffer.from('hello');
  expect(verifySignature(raw, 'deadbeef', SECRET)).toBe(false);
  expect(verifySignature(raw, crypto.createHmac('sha256', SECRET).update(raw).digest('hex'), '')).toBe(false);
  expect(verifySignature(raw, null, SECRET)).toBe(false);
});

it('parses the nested session shape and tolerates flat shapes', () => {
  expect(parseSession({ session: { id: 's1', type: 'photo', direct_url: 'https://x/y.jpg' }, event_id: 'e1' }))
    .toEqual({ directUrl: 'https://x/y.jpg', id: 's1', type: 'photo' });
  expect(parseSession({ session_id: 's2', direct_url: 'https://x/z.gif' }).id).toBe('s2');
  expect(parseSession(null)).toEqual({ directUrl: undefined, id: undefined, type: 'photo' });
});
