// Loaded only on request. Conversion stays on the device; no upload occurs here.
export function fitVideo(width, height) {
  const scale = Math.min(1, 1920 / Math.max(width, height));
  return { width: Math.max(2, Math.floor(width * scale / 2) * 2), height: Math.max(2, Math.floor(height * scale / 2) * 2) };
}
export async function optimizeVideo(file, { signal, onProgress } = {}) {
  if (file.size > 200 * 1024 * 1024) throw new Error('This clip is too large to optimize here. Trim it below 200 MB first.');
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') throw new Error('Video optimization is not supported on this browser. Choose Original quality.');
  const { Input, BlobSource, ALL_FORMATS, Output, Mp4OutputFormat, BufferTarget, Conversion } = await import('mediabunny');
  signal?.throwIfAborted();
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  let conversion;
  const cancel = () => { conversion?.cancel().catch(() => {}); };
  try {
    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
    conversion = await Conversion.init({ input, output,
      video: (track) => ({ ...fitVideo(track.displayWidth, track.displayHeight), fit: 'contain', codec: 'avc', bitrate: 4_000_000, frameRate: 30, forceTranscode: true, allowRotationMetadata: false }),
      audio: { codec: 'aac' },
    });
    // Never silently remove sound or any other track to make a conversion succeed.
    if (!conversion.isValid || conversion.discardedTracks.length) throw new Error('This browser cannot optimize this clip while preserving its tracks. Choose Original quality.');
    signal?.throwIfAborted();
    signal?.addEventListener('abort', cancel, { once: true });
    conversion.onProgress = onProgress;
    await conversion.execute();
    signal?.throwIfAborted();
    const result = new File([output.target.buffer], file.name.replace(/\.[^.]+$/, '') + '-optimized.mp4', { type: 'video/mp4', lastModified: file.lastModified });
    return result.size < file.size ? result : file;
  } finally {
    signal?.removeEventListener('abort', cancel);
    input.dispose();
  }
}
