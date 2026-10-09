import { beforeEach, expect, it, vi } from 'vitest';
import { prepareLondonVideo } from './video.js';
import { optimizeVideo } from '../vault/optimize-video.js';
import { prepareVideo } from '../vault/videos.js';
vi.mock('../vault/optimize-video.js', () => ({ optimizeVideo: vi.fn() }));
vi.mock('../vault/videos.js', () => ({ prepareVideo: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); });
const file = (mb) => ({ name: 'phone.mov', size: mb * 1024 * 1024 });
it('converts a large phone video before preparing the only stored rendition', async () => {
  const original = file(150), smaller = file(8);
  optimizeVideo.mockResolvedValue(smaller);
  prepareVideo.mockResolvedValue({ orig: smaller, contentType: 'video/mp4' });
  const result = await prepareLondonVideo(original);
  expect(optimizeVideo).toHaveBeenCalledWith(original, expect.objectContaining({ maxEdge: 1280, bitrate: 2_000_000, audioBitrate: 128_000 }));
  expect(prepareVideo).toHaveBeenCalledWith(smaller);
  expect(result.orig).toBe(smaller);
  expect(result.name).toBe(original.name);
});
it('never falls back to uploading the original when conversion fails', async () => {
  optimizeVideo.mockRejectedValue(new Error('Unsupported codec'));
  await expect(prepareLondonVideo(file(150))).rejects.toThrow('could not make');
  expect(prepareVideo).not.toHaveBeenCalled();
});
it('enforces the stored size limit after conversion', async () => {
  optimizeVideo.mockResolvedValue(file(101));
  await expect(prepareLondonVideo(file(150))).rejects.toThrow('still over 100 MB');
  expect(prepareVideo).not.toHaveBeenCalled();
});
it('bounds source size before starting conversion', async () => {
  await expect(prepareLondonVideo(file(501))).rejects.toThrow('over 500 MB');
  expect(optimizeVideo).not.toHaveBeenCalled();
});
it('preserves cancellation instead of asking users to switch browsers', async () => {
  const controller = new AbortController();
  optimizeVideo.mockImplementation(() => { controller.abort(); throw new Error('cancelled'); });
  await expect(prepareLondonVideo(file(150), { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(prepareVideo).not.toHaveBeenCalled();
});

it('allows the prepared video to exceed the old 50 MB limit, up to 100 MB', async () => {
  const smaller = file(75);
  optimizeVideo.mockResolvedValue(smaller);
  prepareVideo.mockResolvedValue({ orig: smaller });
  expect((await prepareLondonVideo(file(150))).orig).toBe(smaller);
});
