// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareSaveFile, canSaveToPhotos } from './saveMedia.js';
vi.mock('./gifVideo.js', () => ({ gifToVideo: vi.fn() }));
import { gifToVideo } from './gifVideo.js';
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
describe('saving gallery media',()=>{
 it('saves a booth GIF as an MP4 with matching MIME type and filename',async()=>{
  const original=new Blob(['gif'],{type:'image/gif'});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,blob:async()=>original}));
  gifToVideo.mockResolvedValue(new Blob(['mp4'],{type:'video/mp4'}));
  const signal=new AbortController().signal;
  const file=await prepareSaveFile({id:'booth',contentType:'image/gif',key:'rcap/booth/orig.gif'},'url',signal);
  expect(file.name).toBe('rcap-capsule-booth.mp4');expect(file.type).toBe('video/mp4');
  expect(gifToVideo).toHaveBeenCalledWith(original,signal);
 });
 it('does not silently save a GIF when video conversion fails',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,blob:async()=>new Blob(['gif'],{type:'image/gif'})}));
  gifToVideo.mockRejectedValue(new Error('Video encoding unavailable'));
  await expect(prepareSaveFile({contentType:'image/gif'},'url')).rejects.toThrow('Video encoding unavailable');
 });
 it('prepares an actual video file with its original format',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,blob:async()=>new Blob(['video'],{type:'application/octet-stream'})});vi.stubGlobal('fetch',fetch);
  const signal=new AbortController().signal;
  const f=await prepareSaveFile({id:'one',contentType:'video/quicktime'},'https://example.test/orig.mov',signal);
  expect(f.name).toBe('ami-vault-one.mov');expect(f.type).toBe('video/quicktime');expect(f.size).toBe(5);expect(fetch).toHaveBeenCalledWith('https://example.test/orig.mov',{signal,cache:'no-store'});
 });
 it('checks file sharing support, not just URL sharing',()=>{
  const f=new File(['photo'],'photo.jpg',{type:'image/jpeg'});const canShare=vi.fn().mockReturnValue(true);
  expect(canSaveToPhotos(f,{share:vi.fn(),canShare})).toBe(true);expect(canShare).toHaveBeenCalledWith({files:[f]});
  expect(canSaveToPhotos(f,{share:vi.fn()})).toBe(false);
 });
 it('rejects failed downloads and empty files',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));await expect(prepareSaveFile({},'url')).rejects.toThrow('Could not prepare');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,blob:async()=>new Blob([])}));await expect(prepareSaveFile({},'url')).rejects.toThrow('empty');
 });
});
