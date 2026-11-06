import {describe,it,expect,vi,afterEach} from 'vitest';
import {newsletterIssues,fetchNewsletterIssues} from './newsletters.js';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('shared published newsletter archive',()=>{
  it('links each issue directly and orders newest first without rendering headline HTML',()=>{
    const issues=newsletterIssues([{slug:'older-issue',issue_date:'2026-10-31',headline:'<b>Older</b>'},{slug:'latest-issue',issue_date:'2026-11-02',title:'Latest'},{slug:'../../private',issue_date:'2026-11-03'},{slug:'bad-date',issue_date:'invalid'}]);
    expect(issues.map(i=>i.slug)).toEqual(['latest-issue','older-issue']);
    expect(issues[0]).toMatchObject({href:'/newsletter/latest-issue',dateLabel:'November 2, 2026',title:'Latest'});
    expect(issues[1].title).toBe('Older');
  });
  it('uses the same published-only RPC without caching or requesting draft content',async()=>{
    vi.stubEnv('VITE_SUPABASE_URL','https://example.supabase.co');vi.stubEnv('VITE_SUPABASE_ANON_KEY','public-key');
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>[{slug:'public-issue',issue_date:'2026-11-02',title:'Published'}]});vi.stubGlobal('fetch',fetch);
    expect(await fetchNewsletterIssues()).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith('https://example.supabase.co/rest/v1/rpc/rcap_newsletter_archive',expect.objectContaining({method:'POST',cache:'no-store',body:'{"p_slug":null}'}));
  });
  it('surfaces transport and malformed responses instead of treating them as empty archives',async()=>{
    vi.stubEnv('VITE_SUPABASE_URL','https://example.supabase.co');vi.stubEnv('VITE_SUPABASE_ANON_KEY','public-key');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));
    await expect(fetchNewsletterIssues()).rejects.toThrow();
    expect(()=>newsletterIssues({content:'private'})).toThrow();
  });
});
