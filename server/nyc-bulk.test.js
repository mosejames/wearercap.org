import {it,expect,vi} from 'vitest';
import {createBulkHandler} from './nyc-bulk.js';
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};}
const req={method:'GET',headers:{authorization:'Bearer verified'}};
function setup(user={email:'owner@example.com',email_confirmed_at:'today'},rows=[{id:'one',album:'send-off',createdAt:'today'}],total=1){return createBulkHandler({authenticate:async()=>user,photos:async()=>rows,count:async()=>total,allowedEmails:['owner@example.com']});}
it('rejects signed-out visitors and ordinary verified uploaders',async()=>{let res=response();await setup()({method:'GET',headers:{}},res);expect(res.code).toBe(401);res=response();await setup({email:'other@example.com',phone_confirmed_at:'today'})(req,res);expect(res.code).toBe(403);});
it('returns the whole visible manifest for the administrator without exposing storage credentials',async()=>{const res=response();await setup({email:'owner@example.com',phone_confirmed_at:'today'})(req,res);expect(res.code).toBe(200);expect(res.body.total).toBe(1);expect(res.body.photos).toEqual([{id:'one',album:'send-off',createdAt:'today'}]);expect(res.headers['Cache-Control']).toBe('no-store');});
it('fails instead of silently exporting an incomplete album',async()=>{const res=response();await setup(undefined,[],3)(req,res);expect(res.code).toBe(503);expect(res.body.photos).toBeUndefined();});
