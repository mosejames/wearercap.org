import {it,expect,vi} from 'vitest';
import {fitImage,validateVideo,VIDEO_MAX,optimizePhoto} from './media.js';
it('fits landscape and portrait photos without upscaling logos',()=>{
 expect(fitImage(4000,3000)).toEqual({width:1600,height:1200});
 expect(fitImage(3000,4000)).toEqual({width:1200,height:1600});
 expect(fitImage(100,100)).toEqual({width:100,height:100});
});
it('accepts supported videos and rejects oversized or unsupported files',()=>{
 expect(()=>validateVideo({type:'video/mp4',size:1000})).not.toThrow();
 expect(()=>validateVideo({type:'video/webm',size:VIDEO_MAX+1})).toThrow('50 MB');
 expect(()=>validateVideo({type:'video/quicktime',size:1000})).toThrow('MP4');
});

it('resizes and encodes a photo before upload, then releases the object URL', async()=>{
 const drawImage=vi.fn(),blob=new Blob(['compressed'],{type:'image/webp'});
 const canvas={width:0,height:0,getContext:()=>({drawImage}),toBlob:vi.fn(cb=>cb(blob))};
 const create=vi.spyOn(document,'createElement').mockReturnValue(canvas);
 vi.stubGlobal('Image',class {naturalWidth=4000;naturalHeight=3000;decode(){return Promise.resolve();}});
 const revoke=vi.fn();vi.stubGlobal('URL',Object.assign(class {},{createObjectURL:()=> 'blob:test',revokeObjectURL:revoke}));
 try {expect(await optimizePhoto(new File(['source'],'photo.jpg',{type:'image/jpeg'}))).toBe(blob);expect(drawImage).toHaveBeenCalledWith(expect.anything(),0,0,1600,1200);expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function),'image/webp',.82);expect(revoke).toHaveBeenCalledWith('blob:test');}
 finally{create.mockRestore();vi.unstubAllGlobals();}
});
