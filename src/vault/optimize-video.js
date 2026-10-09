// Loaded only on request. Conversion stays on the device; no upload occurs here.
export function fitVideo(width, height, maxEdge = 1920) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(2, Math.floor(width * scale / 2) * 2), height: Math.max(2, Math.floor(height * scale / 2) * 2) };
}
export async function optimizeVideo(file, { signal, onProgress, maxInputMB = 200, maxEdge = 1920, bitrate = 4_000_000, audioBitrate } = {}) {
  if (file.size > maxInputMB * 1024 * 1024) throw new Error(`This clip is too large to optimize here. Trim it below ${maxInputMB} MB first.`);
  if (typeof VideoEncoder === 'undefined' || typeof VideoDecoder === 'undefined') throw new Error('Video optimization is not supported on this browser. Choose Original quality.');
  const { Input, BlobSource, ALL_FORMATS, Output, Mp4OutputFormat, BufferTarget, Conversion } = await import('mediabunny');
  signal?.throwIfAborted();
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  let conversion;
  const cancel = () => { conversion?.cancel().catch(() => {}); };
  try {
    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
    conversion = await Conversion.init({ input, output,
      video: (track) => ({ ...fitVideo(track.displayWidth, track.displayHeight, maxEdge), fit: 'contain', codec: 'avc', bitrate, frameRate: 30, forceTranscode: true, allowRotationMetadata: false }),
      audio: { codec: 'aac', ...(audioBitrate ? { bitrate: audioBitrate } : {}) },
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
