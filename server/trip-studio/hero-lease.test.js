// @vitest-environment node
import {afterEach,expect,it,vi} from 'vitest';import {claimHero} from './hero-lease.js';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
function setup(value){vi.stubEnv('SUPABASE_URL','https://example.test');vi.stubEnv('SUPABASE_ANON_KEY','public-test');const fetch=vi.fn(async()=>new Response(JSON.stringify(value)));vi.stubGlobal('fetch',fetch);return fetch;}
it('claims and releases the same job with the verified caller authorization',async()=>{const fetch=setup({claimed:true});const release=await claimHero('Bearer verified');await release();const first=JSON.parse(fetch.mock.calls[0][1].body),second=JSON.parse(fetch.mock.calls[1][1].body);expect(first.p_job).toBe(second.p_job);expect(second.p_action).toBe('release');expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer verified');});
it('reports busy only when the atomic service confirms an active request',async()=>{setup({busy:true});await expect(claimHero('Bearer verified')).rejects.toMatchObject({status:429,message:expect.stringContaining('already being created')});});
it('reports service errors without pretending another image is running',async()=>{setup({});fetch.mockResolvedValue(new Response('unavailable',{status:503}));await expect(claimHero('Bearer verified')).rejects.toMatchObject({status:503,message:expect.not.stringContaining('already being created')});});
it('retains the daily limit',async()=>{setup({limitReached:true});await expect(claimHero('Bearer verified')).rejects.toMatchObject({status:429,message:expect.stringContaining('daily limit')});});
