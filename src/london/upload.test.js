import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { uploadBatch } from './upload.js';
import { prepareLondonVideo } from './video.js';
import { insertPhotos } from './data.js';
vi.mock('./video.js', () => ({ prepareLondonVideo: vi.fn() }));
vi.mock('./data.js', () => ({ authHeaders:vi.fn(async()=>({Authorization:'Bearer test'})), getOwner: vi.fn(async () => 'owner'), storageConfig: vi.fn(async () => ({ mode: 'r2' })), insertPhotos: vi.fn(async (rows) => rows) }));
const sent = [];
beforeEach(() => {
 vi.clearAllMocks(); sent.length = 0;
 vi.stubGlobal('XMLHttpRequest', class {
  upload = {}; status = 200;
  open(method, url) { this.url = url; }
  setRequestHeader() {}
  send(blob) { sent.push({ url: this.url, blob }); queueMicrotask(() => this.onload()); }
 });
 vi.stubGlobal('fetch', vi.fn(async (_, options) => ({ ok: true, json: async () => ({ mode: 'r2', items: JSON.parse(options.body).files.map(({id}) => ({ id, keys: {orig: 'video', web: 'poster', thumb: 'thumb'}, urls: {orig: 'r2/video', web: 'r2/poster', thumb: 'r2/thumb'} })) }) })));
});
afterEach(() => vi.unstubAllGlobals());
const context = { event: {id: 'event', slug: 'off-we-go'}, profile: {displayName: 'Family'} };
it('sends only the prepared video and two posters to R2, recording compressed bytes', async () => {
 const original = {name:'phone.mov',type:'video/quicktime',size:150*1024*1024};
 const orig = new Blob(['smaller']), web = new Blob(['poster']), thumb = new Blob(['thumb']);
 prepareLondonVideo.mockResolvedValue({id:'id', name:original.name, orig, web, thumb, ext:'mp4',contentType:'video/mp4', width:1280,height:720});
 const result = await uploadBatch([original], context);
 expect(result.done).toHaveLength(1);
 expect(sent.map(p => p.blob)).toEqual([orig,web,thumb]);
 expect(sent.every(p => p.blob !== original)).toBe(true);
 expect(insertPhotos).toHaveBeenCalledWith([expect.objectContaining({kind:'video',storage:'r2',bytes:orig.size,content_type:'video/mp4'})]);
});
it('does not sign, upload or create a gallery row when compression fails', async () => {
 prepareLondonVideo.mockRejectedValue(new Error('Cannot compress'));
 const result = await uploadBatch([{name:'phone.mov',type:'video/quicktime',size:150*1024*1024}], context);
 expect(result.failed).toEqual([{name:'phone.mov',error:'Cannot compress'}]);
 expect(fetch).not.toHaveBeenCalled();
 expect(sent).toHaveLength(0);
 expect(insertPhotos).not.toHaveBeenCalled();
});
