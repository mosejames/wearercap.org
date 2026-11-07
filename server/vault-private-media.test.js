import { afterEach, describe, expect, it, vi } from 'vitest';
import { privateMediaRead } from './vault-private-media.js';

const id = '4f5dc490-ca62-4796-a6b3-75b55cc309ea';
const event = '381b8cf3-a389-49db-a1ad-9281581a41da';
const key = `amistad/2026-27/user/afterhours/${id}/orig.jpg`;
const photo = { id, event_id: event, house: 'amistad', storage: 'r2', key, web_key: key.replace('orig', 'web'), thumb_key: key.replace('orig', 'thumb') };
const config = { supabase: 'https://database.test', apiKey: 'publishable', r2: { account: 'account', bucket: 'media' }, client: vi.fn(() => ({ sign: vi.fn(async r => r) })) };
const req = { headers: { authorization: 'Bearer session' } };
function response() {
  return { setHeader: vi.fn(), status: vi.fn(function (status) { this.code = status; return this; }), json: vi.fn(function (value) { this.value = value; return this; }) };
}
function database(role, photos = [photo], events = [{ id: event, house: 'amistad' }]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => role })
    .mockResolvedValueOnce({ ok: true, json: async () => photos })
    .mockResolvedValueOnce({ ok: true, json: async () => events }));
}
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('locked gallery media', () => {
  it('rejects an anonymous request before accessing storage', async () => {
    const res = response();
    await privateMediaRead({ headers: {} }, res, { ids: [id] }, config);
    expect(res.code).toBe(401); expect(config.client).not.toHaveBeenCalled();
  });
  it.each([null, 'moderator', 'member'])('rejects %s even with a session or shared passcode', async role => {
    database(role); const res = response();
    await privateMediaRead(req, res, { ids: [id], pass: 'shared' }, config);
    expect(res.code).toBe(403); expect(config.client).not.toHaveBeenCalled();
  });
  it.each(['owner', 'admin'])('allows %s only for existing media in a locked album', async role => {
    database(role); const res = response();
    await privateMediaRead(req, res, { ids: [id], key: 'untrusted/path' }, config);
    expect(res.code).toBe(200);
    const url = new URL(res.value.items[0].urls.orig);
    expect(url.hostname).toBe('account.r2.cloudflarestorage.com');
    expect(url.pathname).toBe(`/media/${key}`);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
  it.each([{ events: [] }, { events: [{ id: event, house: 'rcap' }] }])('fails closed for an album outside the intended vault', async ({ events }) => {
    database('admin', [photo], events); const res = response();
    await privateMediaRead(req, res, { ids: [id] }, config);
    expect(res.code).toBe(403); expect(config.client).not.toHaveBeenCalled();
  });
  it('does not sign hidden, removed or missing photo records', async () => {
    database('admin', []); const res = response();
    await privateMediaRead(req, res, { ids: [id] }, config);
    expect(res.code).toBe(403);
  });
});
