// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';
vi.mock('aws4fetch',()=>({AwsClient:class{fetch(...args){return fetch(...args);}}}));
import {seal,open,readRegistry,writeRegistry} from './storage.js';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
function env(){vi.stubEnv('TRIP_STUDIO_KEY','a'.repeat(64));for(const k of ['R2_ACCOUNT_ID','R2_BUCKET','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'])vi.stubEnv(k,'test');}
it('encrypts every object and detects tampering, including assets',()=>{env();const value={destination:'Private draft',hero:'private image'};const a=seal(value),b=seal(value);expect(a.equals(b)).toBe(false);expect(a.toString()).not.toContain('Private draft');expect(open(a)).toEqual(value);a[a.length-1]^=1;expect(()=>open(a)).toThrow();});
it('uses only the studio namespace and conditional writes',async()=>{env();vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:200})));await writeRegistry({revision:1},'"v1"');expect(fetch.mock.calls[0][0]).toBe('https://test.r2.cloudflarestorage.com/test/_private/trip-studio/v1/registry.enc');expect(fetch.mock.calls[0][1].headers['If-Match']).toBe('"v1"');await writeRegistry({revision:1},null);expect(fetch.mock.calls[1][1].headers['If-None-Match']).toBe('*');});
it('turns an R2 conditional conflict into a clear 409',async()=>{env();vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:412})));await expect(writeRegistry({},'"old"')).rejects.toMatchObject({status:409});});
it('does not silently save when an existing object has no ETag',async()=>{env();vi.stubGlobal('fetch',vi.fn(async()=>new Response(seal({revision:0}),{status:200})));await expect(readRegistry()).rejects.toMatchObject({status:503});});
