export async function renderVideo(file, { start, end, onProgress }) {
  if (!globalThis.VideoEncoder || !globalThis.VideoDecoder) {
    throw new Error('Open this page in an up-to-date Safari or Chrome to finish your video.');
  }

  const logo = new Image();
  logo.src = '/images/we-are-rcap-logo.png';
  await logo.decode();
  const { Input, BlobSource, ALL_FORMATS, Output, Mp4OutputFormat, BufferTarget, Conversion } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error('That file doesn’t contain a video.');
    const width = 720;
    const height = 1280;
    const canvas = Object.assign(document.createElement('canvas'), { width, height });
    const ctx = canvas.getContext('2d', { alpha: false });
    const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
    const badgeWidth = Math.round(width * .24);
    const badgeHeight = Math.round(badgeWidth * logo.naturalHeight / logo.naturalWidth);
    const inset = Math.round(width * .05);
    const pad = Math.round(width * .022);

    const conversion = await Conversion.init({
      input, output, trim: { start, end }, tags: {},
      video: {
        width, height, fit: 'contain', frameRate: 30, codec: 'avc', bitrate: 2_500_000,
        forceTranscode: true, allowRotationMetadata: false,
        process(sample) {
          sample.draw(ctx, 0, 0, width, height);
          ctx.drawImage(logo, inset + pad, height - inset - badgeHeight - pad, badgeWidth, badgeHeight);
          return canvas;
        },
      },
      audio: { codec: 'aac', bitrate: 128_000 },
    });
    if (!conversion.isValid || conversion.discardedTracks.some(({ track }) => track.type === 'audio' || track.type === 'video')) {
      throw new Error('This browser couldn’t process the clip with its sound. Try an MP4 in Safari or Chrome.');
    }
    conversion.onProgress = onProgress;
    await conversion.execute();
    return new File([output.target.buffer], 'Thankful-at-RCA.mp4', { type: 'video/mp4' });
  } finally {
    input.dispose();
  }
}
