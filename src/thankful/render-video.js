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
    const width = 1080;
    const height = 1920;
    const canvas = Object.assign(document.createElement('canvas'), { width, height });
    const ctx = canvas.getContext('2d', { alpha: false });
    const badgeWidth = Math.round(width * .24);
    const badgeHeight = Math.round(badgeWidth * logo.naturalHeight / logo.naturalWidth);
    const leftInset = Math.round(width * .07);
    const bottomInset = Math.round(height * .14);

    const createConversion = () => Conversion.init({
      input, output: new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() }),
      trim: { start, end }, tags: {}, showWarnings: false,
      video: {
        width, height, fit: 'cover', frameRate: 30, codec: 'avc', bitrate: 5_500_000,
        forceTranscode: true, allowRotationMetadata: false,
        process(sample) {
          sample.draw(ctx, 0, 0, width, height);
          ctx.drawImage(logo, leftInset, height - bottomInset - badgeHeight, badgeWidth, badgeHeight);
          return canvas;
        },
      },
      audio: { codec: 'aac' },
    });
    let conversion = await createConversion();
    if (conversion.discardedTracks.some(({ track, reason }) => track.type === 'audio' && reason === 'no_encodable_target_codec')) {
      const { registerAacEncoder } = await import('@mediabunny/aac-encoder');
      registerAacEncoder();
      conversion = await createConversion();
    }
    if (conversion.discardedTracks.some(({ track }) => track.type === 'audio')) {
      throw new Error('We couldn’t read the audio in this upload. Try uploading a copy with AAC audio, or record a video here.');
    }
    if (!conversion.isValid || conversion.discardedTracks.some(({ track }) => track.type === 'video')) {
      throw new Error('We couldn’t process the video in this upload. Try uploading an MP4 or recording a video here.');
    }
    conversion.onProgress = onProgress;
    await conversion.execute();
    return new File([conversion.output.target.buffer], 'Thankful-at-RCA.mp4', { type: 'video/mp4' });
  } finally {
    input.dispose();
  }
}
