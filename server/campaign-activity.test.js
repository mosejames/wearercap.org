import {describe,it,expect,vi,beforeEach} from 'vitest';
vi.mock('./london-stories/storage.js',()=>({objectRequest:vi.fn(),encrypt:vi.fn(v=>JSON.stringify(v)),decrypt:vi.fn()}));
import handler,{cleanEvent,summarizeEvents,recordActivity,summarizeReport} from './campaign-activity.js';
import {objectRequest,decrypt} from './london-stories/storage.js';
import {campaignLinks} from '../public/campaign-links.js';
const id='12345678-1234-4234-8234-123456789abc';
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status:vi.fn(function(s){this.code=s;return this;}),json:vi.fn(),end:vi.fn()});
beforeEach(()=>vi.clearAllMocks());
describe('campaign analytics',()=>{
 it('keeps only anonymous whitelisted data',()=>{expect(cleanEvent({id,event:'creatorView',scholar:'Private',photo:'secret',issue:'bad?name=private'})).toEqual({id,event:'creatorView',issue:'current',at:expect.any(Number)});expect(()=>cleanEvent({id,event:'private-name'})).toThrow();});
 it('deduplicates retries at the storage key',async()=>{objectRequest.mockResolvedValue({ok:false,status:412});await recordActivity('creatorView','current',id);expect(objectRequest.mock.calls[0][1].headers['If-None-Match']).toBe('*');});
 it('rejects open redirects',async()=>{const r=res();await handler({method:'GET',query:{link:'https://evil.test'},headers:{}},r);expect(r.code).toBe(400);expect(objectRequest).not.toHaveBeenCalled();});
 it('still redirects when analytics storage fails',async()=>{objectRequest.mockRejectedValue(Error('offline'));const r=res();await handler({method:'GET',query:{link:'share'},headers:{}},r);expect(r.code).toBe(302);expect(r.headers.Location).toBe('https://wearercap.org/events/2026/fall-raffle/share/');});
 it('does not count known preview bots',async()=>{const r=res();await handler({method:'GET',query:{link:'share'},headers:{'user-agent':'facebookexternalhit'}},r);expect(objectRequest).not.toHaveBeenCalled();expect(r.code).toBe(302);});
 it('requires officer authorization before reading reports',async()=>{const r=res();await handler({method:'POST',headers:{},body:{action:'report'}},r);expect(r.code).toBe(403);expect(objectRequest).not.toHaveBeenCalled();});
 it('rejects spoofed server-only creation counts and foreign origins',async()=>{const r=res();await handler({method:'POST',headers:{},body:{id,event:'created'}},r);expect(r.code).toBe(400);const r2=res();await handler({method:'POST',headers:{origin:'https://evil.test'},body:{id,event:'creatorView'}},r2);expect(r2.code).toBe(403);});
 it('wraps only fixed known newsletter destinations',()=>{const html=campaignLinks('<a href="https://wearercap.org/events/2026/fall-raffle/share/">Share</a><a href="https://other.test">Other</a>','october-21');expect(html).toContain('link=share&amp;issue=october-21');expect(html).toContain('href="https://other.test"');});
 it('summarizes actions without visitor identifiers',()=>{expect(summarizeEvents([{event:'created'},{event:'created'},{event:'ticketClick'}]).counts.created).toBe(2);});
});

it('isolates an issue ID and its verified slug from other newsletters and raffle activity',()=>{
 const now=Date.parse('2026-10-26T16:00:00Z');
 const events=[{issue:id,event:'newsletter_tickets'},{issue:'this-edition',event:'newsletterView'},{issue:'another-edition',event:'newsletter_tickets'},{issue:'current',event:'newsletter_link'},{issue:id,event:'created'}].map(e=>({...e,at:now}));
 const report=summarizeReport(events,{days:7,now,issueKeys:[id,'this-edition']});
 expect(report.total).toBe(2);expect(report.counts.newsletter_tickets).toBe(1);expect(report.counts.newsletterView).toBe(1);expect(report.counts.created).toBe(0);
 expect(report.byDay.at(-1).total).toBe(2);expect(report.byIssue.map(i=>i.issue)).toEqual([id,'this-edition']);
 expect(summarizeReport(events,{now}).total).toBe(5);
});

it('the report endpoint resolves the saved slug and never trusts client scope',async()=>{
 const fetcher=vi.spyOn(globalThis,'fetch').mockResolvedValueOnce({ok:true,json:async()=>true}).mockResolvedValueOnce({ok:true,json:async()=>({id,slug:'saved-slug',title:'Our newsletter'})});
 decrypt.mockImplementation(bytes=>JSON.parse(bytes.toString()));
 const at=Date.now();
 objectRequest.mockImplementation(async key=>key.startsWith('?')?{ok:true,text:async()=>key.includes(new Date(at).toISOString().slice(0,10))?'<Key>event-one</Key><Key>event-two</Key>':'<ListBucketResult/>'}:{ok:true,arrayBuffer:async()=>Buffer.from(JSON.stringify({at,issue:key==='event-one'?'saved-slug':'other-newsletter',event:'newsletter_tickets'}))});
 try{
  const r=res();await handler({method:'POST',headers:{authorization:'Bearer editor'},body:{action:'report',issueId:id,slug:'other-newsletter',days:7}},r);
  expect(r.code).toBe(200);const data=r.json.mock.calls[0][0];expect(data.counts.newsletter_tickets).toBe(1);expect(data.days).toBe(7);expect(data.issue.title).toBe('Our newsletter');expect(data.byIssue.map(i=>i.issue)).toEqual(['saved-slug']);
 }finally{fetcher.mockRestore();}
});
