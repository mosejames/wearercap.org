import {it,expect,vi,afterEach} from 'vitest';
import {Blob,File} from 'node:buffer';
import {loadVideoFile,saveVideoFile} from './saveVideo.js';
afterEach(()=>vi.unstubAllGlobals());
const mp4=new Blob([new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0])],{type:'video/mp4'});
it('prepares the actual compatible MP4 with a video filename and shares only that file',async()=>{
 vi.stubGlobal('File',File);const fetcher=vi.fn(async()=>({ok:true,headers:new Headers({'Content-Type':'video/mp4'}),blob:async()=>mp4}));vi.stubGlobal('fetch',fetcher);
 const share=vi.fn(async()=>{});vi.stubGlobal('navigator',{share,canShare:vi.fn(()=>true)});
 const file=await loadVideoFile('https://media.example/playback.mp4','photo-id');expect(fetcher.mock.calls[0][0]).toContain('playback.mp4');expect(file.name).toBe('london-2028-photo-id.mp4');expect(file.type).toBe('video/mp4');expect(file.size).toBe(mp4.size);
 await saveVideoFile(file);expect(share).toHaveBeenCalledWith({files:[file]});expect(share.mock.calls[0][0].url).toBeUndefined();
});
it('refuses to save a thumbnail masquerading as a video download',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,headers:new Headers({'Content-Type':'image/jpeg'}),blob:async()=>new Blob(['poster'])})));
 await expect(loadVideoFile('/thumb.jpg','id')).rejects.toThrow('not a video');
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,headers:new Headers({'Content-Type':'video/mp4'}),blob:async()=>new Blob(['poster'])})));
 await expect(loadVideoFile('/broken.mp4','id')).rejects.toThrow('not a video');
});
it('downloads an MP4 blob rather than navigating to storage when file sharing is unavailable',async()=>{
 vi.stubGlobal('File',File);vi.stubGlobal('navigator',{});const create=vi.fn(()=> 'blob:video'),revoke=vi.fn();vi.stubGlobal('URL',{createObjectURL:create,revokeObjectURL:revoke});const click=vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(){expect(this.download).toBe('video.mp4');expect(this.href).toBe('blob:video');});
 await expect(saveVideoFile(new File([mp4],'video.mp4',{type:'video/mp4'}))).resolves.toBe('downloaded');expect(click).toHaveBeenCalledOnce();click.mockRestore();
});
it('does not trigger a second download when the native save menu is cancelled',async()=>{
 vi.stubGlobal('navigator',{canShare:()=>true,share:vi.fn(async()=>{throw new DOMException('Cancelled','AbortError');})});const click=vi.spyOn(HTMLAnchorElement.prototype,'click');
 await expect(saveVideoFile({name:'video.mp4'})).rejects.toHaveProperty('name','AbortError');expect(click).not.toHaveBeenCalled();click.mockRestore();
});
