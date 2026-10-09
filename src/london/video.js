import { prepareVideo } from '../vault/videos.js';
import { MAX_VIDEO_INPUT_MB, MAX_VIDEO_STORED_MB } from './config.js';

// Compression happens before signing or uploading. Never upload an oversized
// original as a fallback, and never keep a second original in R2.
export async function prepareLondonVideo(file, { signal, onProgress } = {}) {
  if (file.size > MAX_VIDEO_INPUT_MB * 1024 * 1024) throw new Error(`This video is over ${MAX_VIDEO_INPUT_MB} MB. Choose a shorter clip so your phone can prepare it.`);
  signal?.throwIfAborted();
  onProgress?.(0);
  let smaller;
  try {
    const { optimizeVideo } = await import('../vault/optimize-video.js');
    smaller = await optimizeVideo(file, { signal, onProgress, maxInputMB: MAX_VIDEO_INPUT_MB, maxEdge: 1280, bitrate: 2_000_000, audioBitrate: 128_000 });
  } catch {
    signal?.throwIfAborted();
    throw new Error('This browser could not make the video smaller. Try an updated Safari or Chrome, or share a shorter MP4 clip.');
  }
  signal?.throwIfAborted();
  if (smaller.size > MAX_VIDEO_STORED_MB * 1024 * 1024) throw new Error(`This video is still over ${MAX_VIDEO_STORED_MB} MB after preparing it. Choose a shorter clip and try again.`);
  const prepared = await prepareVideo(smaller);
  signal?.throwIfAborted();
  return { ...prepared, name: file.name };
}
