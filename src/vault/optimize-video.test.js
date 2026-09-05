import { afterEach, expect, it, vi } from 'vitest';
import { fitVideo, optimizeVideo } from './optimize-video.js';
afterEach(() => vi.unstubAllGlobals());
it('fits landscape and portrait without upscaling or odd dimensions', () => {
  expect(fitVideo(1920,1080)).toEqual({width:1280,height:720});
  expect(fitVideo(1080,1920)).toEqual({width:720,height:1280});
  expect(fitVideo(640,480)).toEqual({width:640,height:480});
});
it('explains the original-quality fallback when encoders are unavailable', async () => {
  vi.stubGlobal('VideoEncoder', undefined);
  await expect(optimizeVideo(new File(['x'],'clip.mp4'))).rejects.toThrow('Choose Original quality');
});
it('bounds memory pressure before loading a large clip', async () => {
  await expect(optimizeVideo({ size: 201*1024*1024 })).rejects.toThrow('200 MB');
});
