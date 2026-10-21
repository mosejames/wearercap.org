import {describe,it,expect,vi,beforeEach} from 'vitest';
vi.mock('./london-stories/storage.js',()=>({objectRequest:vi.fn(),encrypt:vi.fn(v=>JSON.stringify(v)),decrypt:vi.fn()}));
import handler,{cleanEvent,summarizeEvents,recordActivity} from './campaign-activity.js';
import {objectRequest} from './london-stories/storage.js';
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
