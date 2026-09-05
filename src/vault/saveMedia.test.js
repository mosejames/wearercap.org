// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareSaveFile, canSaveToPhotos } from './saveMedia.js';
afterEach(()=>vi.unstubAllGlobals());
describe('saving gallery media',()=>{
 it('prepares an actual video file with its original format',async()=>{
  const fetch=vi.fn().mockResolvedValue({ok:true,blob:async()=>new Blob(['video'],{type:'application/octet-stream'})});vi.stubGlobal('fetch',fetch);
  const signal=new AbortController().signal;
  const f=await prepareSaveFile({id:'one',contentType:'video/quicktime'},'https://example.test/orig.mov',signal);
  expect(f.name).toBe('ami-vault-one.mov');expect(f.type).toBe('video/quicktime');expect(f.size).toBe(5);expect(fetch).toHaveBeenCalledWith('https://example.test/orig.mov',{signal});
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
