// Decode one GIF frame at a time and encode a Photos-compatible H.264 MP4.
export async function gifToVideo(blob, signal) {
  if (typeof VideoEncoder === 'undefined') throw new Error('Video saving needs a newer browser. Open this page in an updated Safari or Chrome.');
  if (blob.size > 50 * 1024 * 1024) throw new Error('This animation is too large to convert on this device.');
  const [{ parseGIF, decompressFrame }, { Output, Mp4OutputFormat, BufferTarget, CanvasSource }] = await Promise.all([
    import('gifuct-js'), import('mediabunny'),
  ]);
  signal?.throwIfAborted();
  const gif = parseGIF(await blob.arrayBuffer());
  const { width, height } = gif.lsd;
  if (!width || !height || width * height > 16_000_000) throw new Error('This animation is too large to convert on this device.');
  const frames = gif.frames.filter(f => f.image);
  if (!frames.length || frames.length > 1200) throw new Error('This animation cannot be converted on this device.');
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const patch = document.createElement('canvas');
  const scale = Math.min(1, 1280 / Math.max(width, height));
  const video = document.createElement('canvas');
  video.width = Math.max(2, Math.floor(width * scale / 2) * 2);
  video.height = Math.max(2, Math.floor(height * scale / 2) * 2);
  const vctx = video.getContext('2d');
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const source = new CanvasSource(video, { codec: 'avc', bitrate: 4_000_000 });
  output.addVideoTrack(source);
  let complete = false;
  try {
    await output.start();
    let time = 0;
    for (const raw of frames) {
      signal?.throwIfAborted();
      const frame = decompressFrame(raw, gif.gct, true);
      const { left, top, width: w, height: h } = frame.dims;
      const previous = frame.disposalType === 3 ? ctx.getImageData(0, 0, width, height) : null;
      patch.width = w; patch.height = h;
      patch.getContext('2d').putImageData(new ImageData(frame.patch, w, h), 0, 0);
      ctx.drawImage(patch, left, top);
      vctx.fillStyle = '#ffffff'; vctx.fillRect(0, 0, video.width, video.height);
      vctx.drawImage(canvas, 0, 0, video.width, video.height);
      const duration = Math.max(0.02, (frame.delay || 100) / 1000);
      if (time + duration > 120) throw new Error('This animation is too long to convert on this device.');
      await source.add(time, duration);
      time += duration;
      if (frame.disposalType === 2) ctx.clearRect(left, top, w, h);
      else if (previous) ctx.putImageData(previous, 0, 0);
    }
    source.close();
    signal?.throwIfAborted();
    await output.finalize();
    complete = true;
    return new Blob([output.target.buffer], { type: 'video/mp4' });
  } finally {
    if (!complete) await output.cancel().catch(() => {});
    canvas.width = patch.width = video.width = 0;
  }
}
