import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './london-sign.js';
import entryHandler from '../api/m3-sign.js';
const id = '11111111-1111-4111-8111-111111111111';
function response() { return { statusCode: 200, body: null, setHeader: vi.fn(), status(n) { this.statusCode=n; return this; }, json(body) { this.body=body; return this; } }; }
const body = () => ({ owner: 'a'.repeat(64), eventId: id, eventSlug: 'hello-london', files: [{ id, ext: 'jpg', contentType: 'image/jpeg' }] });
beforeEach(() => { for (const key of ['ACCOUNT_ID','ACCESS_KEY_ID','SECRET_ACCESS_KEY','BUCKET','PUBLIC_BASE']) vi.stubEnv(`R2_${key}`, key === 'PUBLIC_BASE' ? 'https://media.example.com/' : 'test'); vi.stubEnv('SUPABASE_URL', 'https://db.example.com'); vi.stubEnv('SUPABASE_ANON_KEY', 'anon'); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('London R2 uploads', () => {
  it('dispatches the London rewrite through the existing signing endpoint', async () => {
    vi.stubEnv('M3_STORAGE', 'supabase'); const res = response(); await entryHandler({ method: 'GET', query: { vault: 'london' } }, res); expect(res.body).toEqual({mode:'r2',publicBase:'https://media.example.com'});
  });
  it('fails clearly without R2 instead of falling back to Supabase Storage', async () => {
    vi.stubEnv('R2_SECRET_ACCESS_KEY', ''); const res = response(); await handler({ method: 'GET' }, res); expect(res.statusCode).toBe(503); expect(res.body.mode).toBeUndefined();
  });
  it('uses the shared R2 base with no storage override', async () => {
    vi.stubEnv('VAULT_STORAGE', 'supabase'); const res=response(); await handler({method:'GET'},res); expect(res.body).toEqual({mode:'r2',publicBase:'https://media.example.com'});
  });
  it('rejects an album from another vault', async () => {
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>[]}); vi.stubGlobal('fetch',fetch); const res=response(); await handler({method:'POST',body:body()},res); expect(res.statusCode).toBe(403); expect(fetch.mock.calls[0][0]).toContain('vault=eq.london-2028');
  });
  it('rejects a client slug that differs from the checked album', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>[{slug:'off-we-go',ongoing:true}]})); const res=response(); await handler({method:'POST',body:body()},res); expect(res.statusCode).toBe(403);
  });
  it('signs all renditions only under the London namespace', async () => {
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>[{slug:'hello-london',ongoing:true}]})); const res=response(); await handler({method:'POST',body:body()},res); expect(res.statusCode).toBe(200); expect(res.body.mode).toBe('r2'); const item=res.body.items[0]; expect(item.keys.orig).toBe(`london-2028/aaaaaaaa/hello-london/${id}/orig.jpg`); for(const url of Object.values(item.urls)) { expect(url).toContain('.r2.cloudflarestorage.com/test/london-2028/'); expect(url).toContain('X-Amz-Expires=900'); }
  });
  it('rejects unsupported content before checking albums', async () => {
    const fetch=vi.fn(); vi.stubGlobal('fetch',fetch); const input=body(); input.files[0].contentType='text/html'; const res=response(); await handler({method:'POST',body:input},res); expect(res.statusCode).toBe(400); expect(fetch).not.toHaveBeenCalled();
  });
});
