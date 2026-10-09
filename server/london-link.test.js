import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import handler from './london-link.js';
import entry from '../api/m3-link.js';
const id='11111111-1111-4111-8111-111111111111';
const event={id:'album',slug:'hello-london',title:'Hello, London',hidden:false};
const photo={id,event_id:'album',vault:'london-2028',hidden:false,storage:'r2',web_key:`london-2028/aaaaaaaa/hello-london/${id}/web.jpg`,caption:'Fish & chips <3'};
let fetch;
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(){return this;},send(html){this.html=html;}});
beforeEach(()=>{vi.stubEnv('SUPABASE_URL','https://db.example.com');vi.stubEnv('SUPABASE_ANON_KEY','anon');vi.stubEnv('R2_PUBLIC_BASE','https://media.example.com/');fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>[event]}).mockResolvedValueOnce({ok:true,json:async()=>[{photo}]});vi.stubGlobal('fetch',fetch);});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
const request={query:{vault:'london',slug:'hello-london',photo:id}};
it('uses the requested R2 photo for OG and Twitter and opens that exact photo through the existing entry point',async()=>{
 const res=response();await entry(request,res);
 expect(res.html).toContain(`property="og:image" content="https://media.example.com/${photo.web_key}"`);
 expect(res.html).toContain(`name="twitter:image" content="https://media.example.com/${photo.web_key}"`);
 expect(res.html).toContain(`https://wearercap.org/2028-london/#/e/hello-london/p/${id}`);
 expect(res.html).toContain('Fish &amp; chips &lt;3');expect(res.headers['Cache-Control']).toBe('no-store');
 expect(fetch.mock.calls[1][0]).toBe('https://db.example.com/rest/v1/rpc/m3_list_photos');expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({p_token:'',p_vault:'london-2028',p_event:'album',p_mode:'recent',p_limit:5000});
});
it.each([{hidden:true},{event_id:'other-album'},{vault:'m3-2028'},{storage:'supabase'},{web_key:'m3-2028/foreign/web.jpg'}])('falls back rather than exposing an unavailable or foreign photo: %j',async override=>{
 fetch.mockReset().mockResolvedValueOnce({ok:true,json:async()=>[event]}).mockResolvedValueOnce({ok:true,json:async()=>[{photo:{...photo,...override}}]});
 const res=response();await handler(request,res);expect(res.html).toContain('https://wearercap.org/london/2028-london-og-v2.jpg');expect(res.html).not.toContain('/p/'+id);expect(res.html).not.toContain('https://media.example.com/');
});
it('does not look up a photo for an unavailable album',async()=>{
 fetch.mockReset().mockResolvedValueOnce({ok:true,json:async()=>[]});const res=response();await handler(request,res);expect(fetch).toHaveBeenCalledOnce();expect(res.html).toContain('2028-london-og-v2.jpg');expect(res.html).not.toContain('#/e/');
});
it('does not query invalid photo IDs and supplies the website image for album links',async()=>{
 const res=response();await handler({query:{slug:'hello-london',photo:'invalid'}},res);expect(fetch).toHaveBeenCalledOnce();expect(res.html).toContain('2028-london-og-v2.jpg');expect(res.html).toContain('#/e/hello-london');
});
it('falls back cleanly when a photo was removed between requests',async()=>{
 fetch.mockReset().mockResolvedValueOnce({ok:true,json:async()=>[event]}).mockResolvedValueOnce({ok:true,json:async()=>[]});const res=response();await handler(request,res);expect(res.html).toContain('2028-london-og-v2.jpg');expect(res.html).not.toContain('/p/'+id);expect(res.headers['Cache-Control']).toBe('no-store');
});
