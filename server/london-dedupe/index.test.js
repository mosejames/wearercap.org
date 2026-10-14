import {it,expect} from 'vitest';
import {reserveEntries,sameImage} from './index.js';
const pixels=value=>Buffer.alloc(3072,value).toString('base64');
const photo={id:'old',kind:'photo',hash:'first',pixels:pixels(100),aspect:.75,confirmed:true};
it('skips exact files and recompressed photos across uploader identities',()=>{
 const result=reserveEntries([photo],[{...photo,id:'new',hash:'other',confirmed:undefined}],new Set());expect(result.results[0]).toEqual({id:'new',duplicate:true,existingId:'old'});
 const video=reserveEntries([{id:'video',kind:'video',hash:'clip',confirmed:true}],[{id:'newvideo',kind:'video',hash:'clip'}],new Set());expect(video.results[0].duplicate).toBe(true);
});
it('keeps similar shots, different crops and videos with the same poster separate',()=>{
 expect(sameImage(photo,{...photo,pixels:pixels(103)})).toBe(false);expect(sameImage(photo,{...photo,aspect:.8})).toBe(false);
 const result=reserveEntries([{...photo,kind:'video'}],[{...photo,id:'next',kind:'video',hash:'different'}],new Set());expect(result.results[0].duplicate).toBeUndefined();
});
it('reserves concurrent uploads and resolves a published reservation even after its timeout',()=>{
 const reserved=reserveEntries([],[{...photo,confirmed:undefined,owner:'a'}],new Set(),100);
 expect(()=>reserveEntries(reserved.entries,[{...photo,id:'second',owner:'b'}],new Set(),200)).toThrow('already being shared');
 expect(reserveEntries(reserved.entries,[{...photo,id:'second'}],new Set(['old']),2000000).results[0].duplicate).toBe(true);
 expect(reserveEntries(reserved.entries,[{...photo,id:'second'}],new Set(),2000000).results[0].duplicate).toBeUndefined();
});
