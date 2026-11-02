// @vitest-environment node
import{it,expect,vi,afterEach}from'vitest';
import handler from './index.js';
import{publicWinnerFields}from'./public-winners.js';
const winners=[{place:1,name:'Fable Finch',points:131},{place:2,name:'Milo Moon',points:120},{place:3,name:'Piper Pumpkin',points:119}];
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('whitelists only approved winner fields and fails closed on partial/invalid sets',()=>{expect(publicWinnerFields({winners:winners.map(w=>({...w,phone:'private',userId:'private',guesses:['private']})),me:{private:true}})).toEqual({winners});for(const rows of[[],winners.slice(0,2),[winners[0],winners[0],winners[2]],[{...winners[0],points:'131'},...winners.slice(1)]])expect(publicWinnerFields({winners:rows})).toEqual({winners:[]});});
it('serves a public no-credentials request only through boo_winners with no client-selected account',async()=>{
 vi.stubEnv('SUPABASE_URL','https://fictional.example');vi.stubEnv('SUPABASE_ANON_KEY','synthetic-publishable-key');const fetcher=vi.fn(async()=>({ok:true,json:async()=>({winners,phones:['private'],photos:['private']})}));vi.stubGlobal('fetch',fetcher);const response={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(value){this.body=value;return this;}};await handler({method:'GET',query:{action:'winners',userId:'untrusted'},headers:{}},response);expect(response.code).toBe(200);expect(response.body).toEqual({winners});expect(response.headers['Cache-Control']).toBe('private, no-store');expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][0]).toBe('https://fictional.example/rest/v1/rpc/boo_winners');expect(fetcher.mock.calls[0][1].body).toBe('{}');
});
