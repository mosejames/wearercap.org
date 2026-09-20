import { it, expect, vi } from 'vitest';
import { fullscreenOnFirstPlay } from './fullscreen.js';
it('requests fullscreen only on the first play, so resume respects exit', () => {
 const video = document.createElement('video');
 video.requestFullscreen = vi.fn().mockResolvedValue();
 fullscreenOnFirstPlay(video);
 expect(video.requestFullscreen).not.toHaveBeenCalled();
 video.dispatchEvent(new Event('play'));
 video.dispatchEvent(new Event('play'));
 expect(video.requestFullscreen).toHaveBeenCalledTimes(1);
});
it('supports Safari and cleans up when the popup closes', () => {
 const video = document.createElement('video');
 video.webkitEnterFullscreen = vi.fn();
 const cleanup = fullscreenOnFirstPlay(video);
 video.dispatchEvent(new Event('play'));
 expect(video.webkitEnterFullscreen).toHaveBeenCalledTimes(1);
 const other = document.createElement('video');
 other.requestFullscreen = vi.fn();
 fullscreenOnFirstPlay(other)();
 other.dispatchEvent(new Event('play'));
 expect(other.requestFullscreen).not.toHaveBeenCalled();
 cleanup();
});
it('tolerates a browser refusing fullscreen', async () => {
 const video = document.createElement('video');
 video.requestFullscreen = vi.fn().mockRejectedValue(new Error('Not allowed'));
 fullscreenOnFirstPlay(video);
 video.dispatchEvent(new Event('play'));
 await Promise.resolve();
 expect(video.requestFullscreen).toHaveBeenCalledTimes(1);
});
