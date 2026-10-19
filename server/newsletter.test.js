import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import sign from './newsletter-sign.js';
import page, { firstImage } from './newsletter-page.js';
import entry from '../api/m3-sign.js';
import link from '../api/link.js';

const issueId = '11111111-1111-4111-8111-111111111111';
const fileId = '22222222-2222-4222-8222-222222222222';
function response() { return { statusCode: 200, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; }, send(b) { this.body = b; return this; } }; }

beforeEach(() => {
  for (const key of ['ACCOUNT_ID', 'ACCESS_KEY_ID', 'SECRET_ACCESS_KEY', 'BUCKET', 'PUBLIC_BASE']) vi.stubEnv(`R2_${key}`, key === 'PUBLIC_BASE' ? 'https://media.example.com/' : 'test');
  vi.stubEnv('SUPABASE_URL', 'https://db.example.com'); vi.stubEnv('SUPABASE_ANON_KEY', 'anon');
  vi.stubEnv('VITE_SUPABASE_URL', ''); vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('newsletter photo signing', () => {
  const req = (over = {}) => ({ method: 'POST', query: { vault: 'newsletter' }, headers: { authorization: 'Bearer officer' }, body: { issueId, files: [{ id: fileId }] }, ...over });
  it('dispatches through the existing signing function', async () => {
    const res = response(); await entry({ ...req(), method: 'GET' }, res); expect(res.statusCode).toBe(405);
  });
  it('requires a signed-in officer', async () => {
    const res = response(); await sign(req({ headers: {} }), res); expect(res.statusCode).toBe(401);
  });
  it('lets the database decide who can upload', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => false }); vi.stubGlobal('fetch', fetch);
    const res = response(); await sign(req(), res);
    expect(res.statusCode).toBe(403);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer officer');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ p_action: 'upload_ok', p_payload: { id: issueId } });
  });
  it('signs one JPEG per photo under the newsletter folder in shared R2', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => true }));
    const res = response(); await sign(req(), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.publicBase).toBe('https://media.example.com');
    expect(res.body.items[0].key).toBe(`newsletter/${issueId}/${fileId}.jpg`);
    expect(res.body.items[0].url).toContain('.r2.cloudflarestorage.com/test/newsletter/');
  });
  it('fails clearly without R2', async () => {
    vi.stubEnv('R2_SECRET_ACCESS_KEY', ''); const res = response(); await sign(req(), res); expect(res.statusCode).toBe(503);
  });
  it('rejects malformed ids before calling anything', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const res = response(); await sign(req({ body: { issueId: '../x', files: [{ id: fileId }] } }), res);
    expect(res.statusCode).toBe(400); expect(fetch).not.toHaveBeenCalled();
  });
});

describe('newsletter public pages', () => {
  const published = { slug: 'october-25', title: 'Quick Hello', issue_date: '2026-10-25', format: 'quick', content: { subject: 'See you Sunday', preheader: 'Karaoke and EXP', headline: 'Hello', blocks: [{ type: 'photo', image: { url: 'https://media.example.com/a.jpg', alt: 'Parents at EXP' } }] } };
  it('renders an issue with its own share card through the link function', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => published }));
    const res = response(); await link({ query: { p: 'newsletter', v: 'october-25' }, url: '/newsletter/october-25' }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<meta property="og:title" content="See you Sunday">');
    expect(res.body).toContain('og:image" content="https://media.example.com/a.jpg"');
    expect(res.body).toContain('https://wearercap.org/newsletter/october-25');
    expect(res.body).toContain('we-are-rcap-header.png');
  });
  it('returns 404 for drafts and unknown issues', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => null }));
    const res = response(); await page({ query: { v: 'secret-draft' } }, res);
    expect(res.statusCode).toBe(404); expect(res.body).toContain('noindex');
  });
  it('lists published issues with the branded card', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [{ ...published, headline: 'Hello' }] }));
    const res = response(); await page({ query: {} }, res);
    expect(res.body).toContain('href="/newsletter/october-25"');
    expect(res.body).toContain('https://wearercap.org/newsletter-og.png');
    expect(res.body).not.toMatch(/—/);
  });
  it('only uses https images for share cards', () => {
    expect(firstImage({ blocks: [{ image: { url: 'http://x.com/a.jpg' } }] })).toBeNull();
  });
});
