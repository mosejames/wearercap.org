// @vitest-environment node
import {it,expect,vi} from 'vitest';
import sharp from 'sharp';
import {importPrivatePortrait} from './reveal-import.js';
import {seal} from './crypto.js';
const id='a5000000-0000-4000-8000-000000000001';
it('denies unauthorized import before any storage operation',async()=>{const storage=vi.fn();await expect(importPrivatePortrait({id},{rpc:async()=>{throw Error('Owner required');},storage})).rejects.toThrow('Owner');expect(storage).not.toHaveBeenCalled();});
it('validates JPEG and safely verifies retry bytes without deleting uncertain registrations',async()=>{
 process.env.R2_SECRET_ACCESS_KEY='synthetic-unit-test-only';
 const bytes=await sharp({create:{width:20,height:30,channels:3,background:'#123456'}}).jpeg().toBuffer();
 const normalized=await sharp(bytes).rotate().resize({width:1000,height:2000,fit:'inside',withoutEnlargement:true}).jpeg({quality:88}).toBuffer();
 const rpc=vi.fn(async a=>({ready:a==='reveal-register-asset'}));
 let storage=vi.fn(async()=>new Response(null,{status:200}));
 await expect(importPrivatePortrait({id,image:Buffer.from('not jpeg').toString('base64')},{rpc,storage})).rejects.toThrow();expect(storage).not.toHaveBeenCalled();
 storage=vi.fn(async(k,init)=>init.method==='PUT'?new Response(null,{status:412}):new Response(seal(normalized)));
 await importPrivatePortrait({id,image:bytes.toString('base64')},{rpc,storage});expect(rpc).toHaveBeenCalledWith('reveal-register-asset',expect.objectContaining({id,width:20,height:30}),undefined);
 rpc.mockImplementation(async a=>{if(a==='reveal-register-asset')throw Error('uncertain registration');});
 await expect(importPrivatePortrait({id,image:bytes.toString('base64')},{rpc,storage})).rejects.toThrow('uncertain');expect(storage.mock.calls.every(([,i])=>i.method!=='DELETE')).toBe(true);
 storage=vi.fn(async(k,init)=>init.method==='PUT'?new Response(null,{status:412}):new Response(seal(Buffer.from('different'))));
 await expect(importPrivatePortrait({id,image:bytes.toString('base64')},{rpc:async()=>({}),storage})).rejects.toMatchObject({status:409});
 delete process.env.R2_SECRET_ACCESS_KEY;
});
