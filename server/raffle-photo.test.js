// @vitest-environment node
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import sharp from 'sharp';
import handler,{acceptsPhotoRequest,createRafflePhoto,getRafflePhoto} from './raffle-photo.js';
import {raffleShareHandler} from './raffle-share.js';
const records=new Map();
const id='12345678-1234-4234-9234-123456789abc';
function response(){return{headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.body=v;return this;},send(v){this.body=v;return this;}};}
beforeEach(()=>{
 records.clear();
 for(const [key,value] of Object.entries({R2_ACCOUNT_ID:'test',R2_ACCESS_KEY_ID:'key',R2_SECRET_ACCESS_KEY:'secret',R2_BUCKET:'rcap',R2_PUBLIC_BASE:'https://images.example.org'}))vi.stubEnv(key,value);
 vi.stubGlobal('fetch',vi.fn(async(input,init)=>{
  const request=input instanceof Request?input:new Request(input,init);
  const path=new URL(request.url).pathname;
  if(request.method==='PUT'){records.set(path,Buffer.from(await request.arrayBuffer()));return new Response('',{status:200});}
  return records.has(path)?new Response(records.get(path)):new Response('',{status:404});
 }));
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('photo invitations',()=>{
 it('requires an allowed class and house',()=>{
 const valid={scholar:'Alex',family:'Johnson',classYear:'2027',house:'Amistad',image:'data:image/jpeg;base64,/9j/'};
 expect(acceptsPhotoRequest(valid)).toBe(true);
 expect(acceptsPhotoRequest({...valid,classYear:'2032'})).toBe(false);
 expect(acceptsPhotoRequest({...valid,house:'Other'})).toBe(false);
 });
 it('rejects remote URLs and oversized image bodies',()=>{
 expect(acceptsPhotoRequest({scholar:'Alex',family:'Johnson',image:'https://example.org/private'})).toBe(false);
 expect(acceptsPhotoRequest({scholar:'Alex',family:'Johnson',image:'data:image/jpeg;base64,'+'a'.repeat(1900000)})).toBe(false);
 });
 it.each(['navy','gold'])('saves the %s photo card without metadata and hides only with the owner capability',async(frame)=>{
 const bytes=await sharp({create:{width:120,height:120,channels:3,background:'#f7a81c'}}).jpeg().toBuffer();
 const created=await createRafflePhoto({scholar:'Alex',family:'Johnson',classYear:'2027',house:'Amistad',frame,image:`data:image/jpeg;base64,${bytes.toString('base64')}`});
 expect(created.token).toMatch(/^[a-f0-9]{64}$/);
 expect(records.size).toBe(3);
 // Simulate an invitation saved before the copy correction.
 const prefix=`/rcap/raffle/2026/invitations/${created.id}/`;
 const oldRecord=JSON.parse(records.get(prefix+'record.json').toString());oldRecord.cardVersion=1;
 records.set(prefix+'record.json',Buffer.from(JSON.stringify(oldRecord)));
 records.set(prefix+'card.jpg',records.get(prefix+'card-v4.jpg'));records.delete(prefix+'card-v4.jpg');
 const photo=await getRafflePhoto(created.id);
 expect(records.has(prefix+'card-v4.jpg')).toBe(true);
 expect(JSON.parse(records.get(prefix+'record.json').toString()).status).toBe('visible');
 expect(photo.imageUrl).toBe(`https://images.example.org/raffle/2026/invitations/${created.id}/card-v4.jpg`);
 expect(photo.storage).toBe('r2');
 expect(photo.classYear).toBe('2027');expect(photo.house).toBe('Amistad');
 const html=response();await raffleShareHandler({query:{id:created.id}},html);
 expect(html.body).toContain(`property="og:image" content="${photo.imageUrl}"`);
 expect(html.body).toContain(`name="twitter:image" content="${photo.imageUrl}"`);
 const card=records.get(`/rcap/raffle/2026/invitations/${created.id}/card-v4.jpg`);
 const meta=await sharp(card).metadata();expect([meta.width,meta.height]).toEqual([1200,630]);expect(meta.exif).toBeUndefined();
 const denied=response();await handler({method:'DELETE',headers:{},body:{id:created.id,token:'a'.repeat(64)}},denied);expect(denied.code).toBe(403);
 const hidden=response();await handler({method:'DELETE',headers:{},body:{id:created.id,token:created.token}},hidden);expect(hidden.code).toBe(200);
 expect(await getRafflePhoto(created.id)).toBeNull();
 const fallback=response();await raffleShareHandler({query:{id:created.id,scholar:'Different child'}},fallback);
 expect(fallback.code).toBe(404);expect(fallback.body).not.toContain('Different child');expect(fallback.body).not.toContain(photo.imageUrl);
 });
 it('does not load invalid IDs or accept foreign-origin writes',async()=>{
 expect(await getRafflePhoto('../../secret')).toBeNull();
 const res=response();await handler({method:'POST',headers:{origin:'https://evil.example'},body:{}},res);expect(res.code).toBe(403);
 expect(fetch).not.toHaveBeenCalled();
 });
 it('returns generic metadata for a missing invitation',async()=>{
 const res=response();await raffleShareHandler({query:{id}},res);expect(res.code).toBe(404);expect(res.headers['Cache-Control']).toBe('no-store');expect(res.body).toContain('summary_large_image');
 });
});
