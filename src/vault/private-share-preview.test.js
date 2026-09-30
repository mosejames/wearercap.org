// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { privateShareCard } from '../../api/vault-og.js';
import { sharePreviewCopy } from './sharePreview.js';
const token = 'a'.repeat(64);
const info = { title: 'Bingo & Friends', house: 'rcap', file_count: 154, allow_web_download: true, allow_full_download: true };
const response = () => ({ headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(n) { this.code=n;return this; }, send(body) { this.body=body; } });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });
function mockInfo(value) {
 vi.stubEnv('VITE_SUPABASE_URL','https://example.supabase.co');
 vi.stubEnv('VITE_SUPABASE_ANON_KEY','test');
 vi.stubGlobal('fetch',vi.fn(async () => ({ ok: true, json: async () => value })));
}
it('gives a private token URL its own OG image and anonymous download destination', async () => {
 mockInfo(info);
 const { default: handler } = await import('../../api/vault-link.js');
 const res = response(); await handler({query:{share:token}},res);
 expect(res.body).toContain('Bingo &amp; Friends · Private Capsule Download');
 expect(res.body).toContain(`og:image" content="https://wearercap.org/api/vault-og?share=${token}`);
 expect(res.body).toContain('154 photos and videos');
 expect(res.body).toContain('Web Quality + Full Quality');
 expect(res.body).toContain(`window.location.replace("https://wearercap.org/capsule-share/#${token}")`);
 expect(res.headers['Cache-Control']).toBe('no-store');
 expect(res.headers['Referrer-Policy']).toBe('no-referrer');
 expect(res.body).not.toContain('/rcap-capsule/e/');
 expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({p_token:token,p_action:'info'});
});
it.each([null])('does not reveal capsule details when the link is unavailable', async value => {
 mockInfo(value);
 const { default: handler } = await import('../../api/vault-link.js');
 const res=response();await handler({query:{share:token}},res);
 expect(res.body).toContain('Private Capsule Download');
 expect(res.body).not.toContain('Bingo');
 expect(res.body).toContain('expired or been disabled');
});
it('rejects malformed tokens without querying the database or injecting HTML', async () => {
 mockInfo(info);
 const {default:handler}=await import('../../api/vault-link.js');
 const res=response();await handler({query:{share:'</script><script>alert(1)</script>'}},res);
 expect(fetch).not.toHaveBeenCalled();
 expect(res.body).not.toContain('alert(1)');
});
it('reflects quality permissions and AMI branding accurately', () => {
 expect(sharePreviewCopy({...info,house:'amistad',allow_web_download:false}).quality).toBe('Full Quality');
 expect(sharePreviewCopy({...info,house:'amistad'}).brand).toBe('AMI Capsule');
 expect(sharePreviewCopy({...info,allow_web_download:false,allow_full_download:false}).quality).toBe('Downloads disabled');
});
it('renders the token-verified card as a 1200 by 630 PNG without caching it', async () => {
 mockInfo(info);
 const {default:handler}=await import('../../api/vault-og.js');
 const res=response();await handler({query:{share:token}},res);
 expect(res.headers['Cache-Control']).toBe('no-store');
 expect(res.headers['Content-Type']).toBe('image/png');
 expect(res.body.readUInt32BE(16)).toBe(1200);
 expect(res.body.readUInt32BE(20)).toBe(630);
});
it('renders long titles and unavailable cards without error', async () => {
 for(const value of [null,{...info,title:'A very long gallery title '.repeat(10),house:'amistad'}]) {
  const png=Buffer.from(await privateShareCard(value).arrayBuffer());
  expect(png.subarray(1,4).toString()).toBe('PNG');
 }
});
