// @vitest-environment node
import {afterEach,it,expect,vi} from 'vitest';
import handler,{isPrivateBooKey} from './index.js';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
const response=()=>({headers:{},statusCode:0,body:null,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(b){this.body=b;return this;},send(b){this.body=b;return this;}});
it.each(['reveal','reveal-preview','reveal-media','reveal-preview-media','reveal-upload'])('requires passcode session before %s data or storage access',async action=>{
 const f=vi.fn();vi.stubGlobal('fetch',f);const r=response();await handler({method:'POST',headers:{},body:{action,photoId:'fictional-photo',kind:'now'}},r);expect(r.statusCode).toBe(401);expect(r.headers['Cache-Control']).toBe('private, no-store');expect(f).not.toHaveBeenCalled();expect(r.body).toEqual({error:'Please sign in with your phone.'});
});
it.each(['reveal-media','reveal-preview-media'])('server verification rejects invalid session before %s storage fetch',async action=>{
 vi.stubEnv('SUPABASE_URL','https://fictional.example');vi.stubEnv('SUPABASE_ANON_KEY','synthetic-publishable-key');const f=vi.fn(async()=>({ok:false,json:async()=>({code:'42501',message:'Please sign in with your phone.'})}));vi.stubGlobal('fetch',f);const r=response();await handler({method:'POST',headers:{authorization:'Bearer fictional-invalid-token-never-real'},body:{action,photoId:'fictional-photo',kind:'now'}},r);expect(r.statusCode).toBe(403);expect(f).toHaveBeenCalledTimes(1);expect(f.mock.calls[0][0]).toBe('https://fictional.example/rest/v1/rpc/boo_game');
});
it('accepts only sealed game/portrait keys in private storage',()=>{
 const id='a7000000-0000-4000-8000-000000000001';for(const k of [`little-boo/v1/${id}.bin`,`little-boo/reveal/v1/${id}.bin`])expect(isPrivateBooKey(k)).toBe(true);
 for(const k of [`little-boo/reveal/v1/${id}.jpg`,`little-boo/reveal/v1/../${id}.bin`,`public/${id}.bin`,`little-boo/reveal/v1/${id}.bin?public=1`])expect(isPrivateBooKey(k)).toBe(false);
});
