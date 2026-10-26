// @vitest-environment node
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import sharp from 'sharp';
vi.mock('./rpc.js',()=>({engineRpc:vi.fn()}));
import handler,{cardFor,ogImage,renderCard} from './card.js';
import {engineRpc} from './rpc.js';
const trip={slug:'verification-trip',engineId:'11111111-1111-1111-1111-111111111111',destination:'Verification <trip>',cohort:'2035',start:'2030-01-01',end:'2030-01-02',colors:{navy:'#102448',yellow:'#f5cc48',paper:'#faf9f4'}};
const photo={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',tripId:trip.engineId,album:'send-off',state:'visible',storage:'r2',webKey:`trip-engine/v1/${trip.engineId}/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/web.jpg`};
const q={trip:trip.slug,album:photo.album,photo:photo.id};
beforeEach(()=>{vi.stubEnv('R2_ACCOUNT_ID','a');vi.stubEnv('R2_BUCKET','b');vi.stubEnv('R2_ACCESS_KEY_ID','k');vi.stubEnv('R2_SECRET_ACCESS_KEY','s');vi.stubEnv('R2_PUBLIC_BASE','https://media.example.org');});
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it('shares the exact existing web image and opens that photo',()=>{const c=cardFor({trip,photos:[photo]},q);expect(c.image).toBe('https://media.example.org/'+photo.webKey);expect(c.destination).toContain('photo='+photo.id);expect(c.canonical).toContain('/e/send-off/p/'+photo.id);expect(c.exact).toBe(true);});
it.each([{tripId:'22222222-2222-2222-2222-222222222222'},{album:'the-whole-adventure'},{state:'hidden'},{storage:'supabase'},{webKey:'nyc-2026/other/web.jpg'}])('falls back to the trip card for invalid photo membership: %j',patch=>{const c=cardFor({trip,photos:[{...photo,...patch}]},q);expect(c.exact).toBe(false);expect(c.image).toBe('https://wearercap.org/trips/verification-trip/og.jpg');expect(c.destination).not.toContain('photo=');});
it('does not substitute another photo when the requested one is removed',()=>{const c=cardFor({trip,photos:[{...photo,id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'}]},q);expect(c.exact).toBe(false);expect(c.image).not.toContain('web.jpg');});
it('escapes user text and provides absolute OG and Twitter URLs',()=>{const s=renderCard(cardFor({trip,photos:[]},q));expect(s).toContain('Verification &lt;trip&gt;');expect(s).toContain('summary_large_image');expect(s).toContain('https://wearercap.org/trips/verification-trip/og.jpg');});
it('renders the same branded 1200 by 630 layout used by the dashboard',async()=>{const jpeg=await ogImage(trip);const m=await sharp(jpeg).metadata();expect(m).toMatchObject({width:1200,height:630,format:'jpeg'});});
it('rechecks visibility on every fresh request and fails closed for a private trip',async()=>{engineRpc.mockRejectedValue(Object.assign(Error('Trip not available'),{status:404}));const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},send(body){this.body=body;return this;}};await handler({method:'GET',query:q},res);expect(res.code).toBe(404);expect(res.headers['Cache-Control']).toBe('no-store');expect(res.body).not.toContain(trip.destination);});
