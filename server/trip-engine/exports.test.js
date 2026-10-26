// @vitest-environment node
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import crypto from 'node:crypto';
const {send,files,awsFetch,engine}=vi.hoisted(()=>({send:vi.fn(async()=>({})),files:new Map(),awsFetch:vi.fn(),engine:vi.fn()}));
vi.mock('@vercel/queue',()=>({QueueClient:class{send=send;}}));
vi.mock('./rpc.js',()=>({engineRpc:engine,problem:(m,status=400)=>Object.assign(Error(m),{status}),bearer:req=>{if(!req.headers?.authorization)throw Object.assign(Error('Sign in'),{status:401});return req.headers.authorization;}}));
vi.mock('./storage.js',()=>({UUID:/^[a-f0-9-]{36}$/,r2:()=>({account:'test',bucket:'test'}),aws:()=>({fetch:awsFetch,sign:async r=>({url:r.url})}),objectUrl:key=>new URL('https://media.example.org/'+key)}));
import {read,write,processExport,exportHandler} from './exports.js';
import {seal} from '../trip-studio/storage.js';
const slug='verification-trip',tripId='11111111-1111-1111-1111-111111111111';
const photo={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',tripId,album:'send-off',webKey:`trip-engine/v1/${tripId}/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/web.jpg`,createdAt:'2030-01-01T00:00:00Z'};
const trip={engineId:tripId,destination:'Verification trip',cohort:'2035'};
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const res=()=>({status(code){this.code=code;return this;},json(body){this.body=body;return this;},redirect(code,url){this.code=code;this.url=url;return this;}});
beforeEach(()=>{
 files.clear();send.mockClear();engine.mockReset().mockImplementation(async action=>action==='get'?{trip,photos:[photo],count:1,hasMore:false}:action==='export-settings'?{exportDays:7,recipientBinding:true,videoDownloadUrl:'https://www.dropbox.com/videos'}:{});
 vi.stubEnv('TRIP_STUDIO_KEY','a'.repeat(64));vi.stubEnv('TRIP_ENGINE_EMAIL_KEY','b'.repeat(64));vi.stubEnv('VITE_SUPABASE_URL','https://auth.example.org');
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('Sent',{status:200})));
 awsFetch.mockReset().mockImplementation(async(url,init={})=>{
  const u=new URL(url),key=u.pathname;
  if(u.searchParams.has('uploads'))return new Response('<UploadId>upload-1</UploadId>',{status:200});
  if(u.searchParams.has('uploadId'))return new Response(init.method==='POST'?'<CompleteMultipartUploadResult/>':'',{status:200,headers:{etag:'"part"'}});
  if(init.method==='DELETE'){files.delete(key);return new Response(null,{status:204});}
  if(init.method==='PUT'){
   const current=files.get(key);if(init.headers?.['If-None-Match']==='*'&&current||init.headers?.['If-Match']&&current?.etag!==init.headers['If-Match'])return new Response('',{status:412});
   const etag='"'+crypto.randomUUID()+'"';files.set(key,{body:init.body,etag});return new Response('',{status:200,headers:{etag}});
  }
  if(u.hostname==='media.example.org')return new Response(new Uint8Array([1,2,3]),{status:200});
  const value=files.get(key);return value?new Response(value.body,{status:200,headers:{etag:value.etag}}):new Response('',{status:404});
 });
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
async function job(id='c'.repeat(64),patch={}){await write(`jobs/${id}`,{slug,email:'recipient@example.org',receipt:'d'.repeat(64),expires:Date.now()+86400000,status:'queued',attempt:1,progress:0,videoUrl:'https://www.dropbox.com/videos',...patch});return id;}
it('stores private export state as ciphertext in a distinct namespace',async()=>{await write('jobs/'+ 'c'.repeat(64),{email:'recipient@example.org'});const entry=[...files.entries()][0];expect(entry[0]).toContain('/_private/trip-engine/exports/jobs/');expect(Buffer.from(entry[1].body).toString()).not.toContain('recipient@example.org');expect((await read('jobs/'+'c'.repeat(64))).value.email).toBe('recipient@example.org');});
it('queues a recipient-bound job only after a trip administrator explicitly requests it',async()=>{const r=res();await exportHandler({method:'POST',query:{trip:slug},headers:{authorization:'Bearer admin'},body:{action:'export-invite',email:'recipient@example.org',prepare:true}},r);expect(r.code).toBe(200);expect(r.body.url).toContain('download=');expect(send).toHaveBeenCalledWith('trip-vault-exports',expect.objectContaining({type:'prepare'}),expect.any(Object));expect(fetch).not.toHaveBeenCalled();});
it('rejects unauthenticated invitation creation',async()=>{const r=res();await exportHandler({method:'POST',query:{trip:slug},headers:{},body:{action:'export-invite',email:'recipient@example.org'}},r);expect(r.code).toBe(401);expect(send).not.toHaveBeenCalled();});
it('does not let a private invitation switch trips or bound recipients',async()=>{const token='a'.repeat(64);await write(`invites/${hash(token)}`,{slug,email:'recipient@example.org',expires:Date.now()+86400000,days:7});for(const [trip,email]of[['another-trip','recipient@example.org'],[slug,'someone@example.org']]){const r=res();await exportHandler({method:'POST',query:{trip},headers:{},body:{action:'export-request',invite:token,email}},r);expect(r.code).toBeGreaterThanOrEqual(400);}expect(send).not.toHaveBeenCalled();});
it('builds across all visible groups and emails separate download access only when the ZIP is ready',async()=>{const id=await job();await processExport({type:'prepare',id});const current=(await read(`jobs/${id}`)).value;expect(current.status).toBe('sent');expect(current.progress).toBe(1);expect(current.archiveKey).toMatch(/^_exports\/trip-engine\//);const sent=JSON.parse(fetch.mock.calls[0][1].body);expect(sent).toMatchObject({email:'recipient@example.org',destination:'Verification trip',count:1,hasVideos:true});expect(send).toHaveBeenCalledWith('trip-vault-exports',expect.objectContaining({type:'cleanup'}),expect.any(Object));});
it('retains a completed ZIP when email fails so retry does not lose progress',async()=>{const id=await job();fetch.mockResolvedValue(new Response('unavailable',{status:503}));await expect(processExport({type:'prepare',id})).rejects.toThrow(/email/);const current=(await read(`jobs/${id}`)).value;expect(current.status).toBe('email-failed');expect(current.archiveKey).toBeTruthy();expect(current.leaseUntil).toBe(0);});
it('never labels an unfinished archive ready when multipart storage fails',async()=>{const id=await job();const impl=awsFetch.getMockImplementation();awsFetch.mockImplementation(async(url,init)=>new URL(url).searchParams.has('uploads')?new Response('',{status:503}):impl(url,init));await expect(processExport({type:'prepare',id})).rejects.toThrow(/archive storage/);const current=(await read(`jobs/${id}`)).value;expect(current.status).toBe('failed');expect(current.archiveKey).toBeNull();expect(fetch).not.toHaveBeenCalled();});
it('rechecks visibility before a previously prepared archive is downloaded',async()=>{const id=await job(undefined,{status:'sent',archiveKey:`_exports/trip-engine/${tripId}/${'e'.repeat(64)}/trip-photos.zip`,photos:[photo]});const receipt='d'.repeat(64);await write(`receipts/${hash(receipt)}`,{id,slug,expires:Date.now()+86400000});engine.mockResolvedValue({trip,photos:[],count:0,hasMore:false});const r=res();await exportHandler({method:'GET',query:{trip:slug,action:'export-file',receipt}},r);expect(r.code).toBeGreaterThanOrEqual(400);expect(r.url).toBeUndefined();});
it('cleans expired archives without sending an email',async()=>{const id=await job(undefined,{expires:Date.now()-1,archiveKey:`_exports/trip-engine/${tripId}/${'e'.repeat(64)}/trip-photos.zip`});await processExport({type:'cleanup',id});expect((await read(`jobs/${id}`)).value.status).toBe('expired');expect(fetch).not.toHaveBeenCalled();});
it('stops automatic retries after repeated failures and leaves a clear admin error',async()=>{const id=await job();await processExport({type:'prepare',id},{deliveryCount:6});const current=(await read(`jobs/${id}`)).value;expect(current.status).toBe('failed');expect(current.error).toContain('repeated attempts');expect(fetch).not.toHaveBeenCalled();});
