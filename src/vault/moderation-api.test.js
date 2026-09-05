// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import remove from '../../api/vault-remove.js';
import sign from '../../api/vault-sign.js';
const response = () => ({ setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
afterEach(() => vi.unstubAllGlobals());
it('never signs uploads without a session', async () => {
 const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
 const res = response(); await sign({ method:'POST',headers:{},body:{files:[{id:'10000000-0000-4000-8000-000000000001',ext:'jpg'}]} },res);
 expect(res.code).toBe(401); expect(fetcher).not.toHaveBeenCalled();
});
it('a banned session cannot obtain upload URLs', async () => {
 const fetcher = vi.fn().mockResolvedValue({ok:true,json:async()=>null}); vi.stubGlobal('fetch',fetcher);
 const res = response(); await sign({method:'POST',headers:{authorization:'Bearer valid-session'},body:{files:[{id:'10000000-0000-4000-8000-000000000001',ext:'jpg'}]}},res);
 expect(res.code).toBe(403); expect(fetcher).toHaveBeenCalledTimes(1);
});
it('never deletes storage before database ownership approval', async () => {
 const fetcher=vi.fn().mockResolvedValue({ok:false}); vi.stubGlobal('fetch',fetcher);
 const res=response(); await remove({method:'POST',headers:{},body:{id:'10000000-0000-4000-8000-000000000001'}},res);
 expect(res.code).toBe(403);expect(fetcher).toHaveBeenCalledTimes(1);
});
it('deletes only keys returned by the database, never client-supplied keys', async () => {
 const keys=['amistad/event/orig.jpg','amistad/event/web.jpg','amistad/event/thumb.jpg'];
 const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({storage:'supabase',keys})}).mockResolvedValueOnce({ok:true}).mockResolvedValueOnce({ok:true});vi.stubGlobal('fetch',fetcher);
 const res=response();await remove({method:'POST',headers:{authorization:'Bearer user'},body:{id:'10000000-0000-4000-8000-000000000001',keys:['another/family/orig.jpg']}},res);
 expect(res.code).toBe(200); expect(JSON.parse(fetcher.mock.calls[1][1].body).prefixes).toEqual(keys);
});
it('reports cleanup failure instead of falsely claiming permanent deletion', async () => {
 vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({storage:'supabase',keys:['amistad/a','amistad/b','amistad/c']})}).mockResolvedValueOnce({ok:false}));
 const res=response();await remove({method:'POST',headers:{},body:{id:'10000000-0000-4000-8000-000000000001'}},res);
 expect(res.code).toBe(502); expect(res.body.error).toContain('retry');
});
