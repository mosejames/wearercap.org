import { it, expect, vi } from 'vitest';
const deps = vi.hoisted(() => ({ prepareImage: vi.fn(), prepareVideo: vi.fn(), insertPhotos: vi.fn(), uploadToSupabase: vi.fn() }));
vi.mock('./images.js', () => ({ prepareImage: deps.prepareImage }));
vi.mock('./videos.js', () => ({ isVideo: (f) => f.type.startsWith('video/'), prepareVideo: deps.prepareVideo }));
vi.mock('./data.js', () => ({ getOwner: async () => 'owner', storageConfig: async () => ({}), insertPhotos: deps.insertPhotos, uploadToSupabase: deps.uploadToSupabase }));
import { uploadBatch } from './upload.js';
it('uploads the video original plus JPEG previews and stores its video MIME type', async () => {
  const original = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
  const jpeg = new Blob(['poster'], { type: 'image/jpeg' });
  deps.prepareVideo.mockResolvedValue({ id: 'id', name: original.name, orig: original, web: jpeg, thumb: jpeg, ext: 'mp4', contentType: 'video/mp4', width: 320, height: 240 });
  deps.insertPhotos.mockImplementation(async (rows) => rows);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ mode: 'supabase', items: [{ id: 'id', keys: { orig: 'orig.mp4', web: 'web.jpg', thumb: 'thumb.jpg' } }] }) }));
  try {
    const result = await uploadBatch([original], { event: { id: 'event', slug: 'event' }, profile: { display_name: 'Test' } });
    expect(result.failed).toEqual([]);
    expect(deps.prepareImage).not.toHaveBeenCalled();
    expect(deps.uploadToSupabase).toHaveBeenCalledWith('orig.mp4', original, 'video/mp4');
    expect(deps.uploadToSupabase).toHaveBeenCalledWith('thumb.jpg', jpeg, 'image/jpeg');
    expect(result.done[0]).toMatchObject({ key: 'orig.mp4', content_type: 'video/mp4' });
  } finally { vi.unstubAllGlobals(); }
});
