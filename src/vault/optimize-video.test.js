import { afterEach, expect, it, vi } from 'vitest';
import { fitVideo, optimizeVideo } from './optimize-video.js';
afterEach(() => vi.unstubAllGlobals());
it('fits landscape and portrait without upscaling or odd dimensions', () => {
  expect(fitVideo(3840,2160)).toEqual({width:1920,height:1080});
  expect(fitVideo(2160,3840)).toEqual({width:1080,height:1920});
  expect(fitVideo(640,480)).toEqual({width:640,height:480});
});
it('explains the original-quality fallback when encoders are unavailable', async () => {
  vi.stubGlobal('VideoEncoder', undefined);
  await expect(optimizeVideo(new File(['x'],'clip.mp4'))).rejects.toThrow('Choose Original quality');
});
it('bounds memory pressure before loading a large clip', async () => {
  await expect(optimizeVideo({ size: 201*1024*1024 })).rejects.toThrow('200 MB');
});
