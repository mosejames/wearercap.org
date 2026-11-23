import React, { useEffect, useState } from 'react';
import { wrapCardText } from '../london/textCard.js';
import { loadVideoWordmark } from './video-wordmark.js';
import { STORY_WIDTH, STORY_HEIGHT } from './PhotoFrame.jsx';

async function makeStory(photo, message, author, credit, signal) {
  const image = await createImageBitmap(photo);
  const canvas = Object.assign(document.createElement('canvas'), { width: STORY_WIDTH, height: STORY_HEIGHT });
  const ctx = canvas.getContext('2d');
  try {
    ctx.drawImage(image, 0, 0, STORY_WIDTH, STORY_HEIGHT);
  } finally {
    image.close();
  }

  const margin = 76;
  const maxWidth = STORY_WIDTH - margin * 2;
  const authorSize = 40;
  const authorStep = 48;
  const bottom = STORY_HEIGHT - 270;
  const creditStep = 38;
  ctx.font = '32px Arial';
  const creditLines = credit ? wrapCardText(ctx, credit, maxWidth) : [];
  ctx.font = `700 ${authorSize}px Arial`;
  const authorLines = wrapCardText(ctx, author, maxWidth);
  const authorAscent = ctx.measureText('H').actualBoundingBoxAscent;
  const authorY = bottom - creditLines.length * creditStep - authorStep * (authorLines.length - 1);
  let fontSize = message.length > 210 ? 46 : message.length > 125 ? 54 : message.length > 75 ? 64 : 74;
  let lines;
  do {
    ctx.font = `600 ${fontSize}px Georgia`;
    lines = wrapCardText(ctx, message, maxWidth);
    if (lines.length * fontSize * 1.2 <= 900) break;
    fontSize -= 2;
  } while (fontSize >= 24);
  const descender = ctx.measureText(lines.at(-1)).actualBoundingBoxDescent;
  const firstLine = authorY - authorAscent - descender - 38 - (lines.length - 1) * fontSize * 1.2;
  const gradient = ctx.createLinearGradient(0, firstLine - fontSize - 130, 0, firstLine - fontSize);
  gradient.addColorStop(0, '#07101a00');
  gradient.addColorStop(1, '#07101af0');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, Math.max(0, firstLine - fontSize - 130), STORY_WIDTH, STORY_HEIGHT);
  const topFade = ctx.createLinearGradient(0, 0, 0, 390);
  topFade.addColorStop(0, '#07101a91');
  topFade.addColorStop(1, '#07101a00');
  ctx.fillStyle = topFade;
  ctx.fillRect(0, 0, STORY_WIDTH, 390);
  ctx.fillStyle = '#efbd61';
  lines.forEach((line, i) => ctx.fillText(line, margin, firstLine + i * fontSize * 1.2));
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${authorSize}px Arial`;
  authorLines.forEach((line, i) => ctx.fillText(line, margin, authorY + authorStep * i));
  ctx.fillStyle = '#e4e7ed';
  ctx.font = '32px Arial';
  creditLines.forEach((line, i) => ctx.fillText(line, margin, bottom - (creditLines.length - 1 - i) * creditStep));
  const duration = 6;
  const frameRate = 24;
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource } = await import('mediabunny');
  const frame = Object.assign(document.createElement('canvas'), { width: STORY_WIDTH, height: STORY_HEIGHT });
  const frameContext = frame.getContext('2d', { alpha: false });
  const drawWordmark = await loadVideoWordmark(frameContext, STORY_WIDTH, STORY_HEIGHT, duration, {
    placement: 'top',
    sequence: [
      { time: 0, text: 'FAMILY.' },
      { time: 1.25, text: 'GRATEFUL.' },
      { time: 2.65, text: 'THANKFUL.' },
      { time: 4.05 },
    ],
  });

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const source = new CanvasSource(frame, { codec: 'avc', bitrate: 3_000_000 });
  output.addVideoTrack(source, { frameRate });
  try {
    signal.throwIfAborted();
    await output.start();
    for (let i = 0; i < duration * frameRate; i++) {
      signal.throwIfAborted();
      frameContext.drawImage(canvas, 0, 0);
      drawWordmark(i / frameRate);
      await source.add(i / frameRate, 1 / frameRate);
    }
    source.close();
    await output.finalize();
    return new File([output.target.buffer], STORY_FILENAME, { type: 'video/mp4' });
  } finally {
    if (output.state !== 'finalized') await output.cancel().catch(() => {});
    frame.width = canvas.width = 0;
  }
}

const STORY_FILENAME = 'Thankful-at-RCA-Story.mp4';

export default function PhotoStory({ photo, message, author, credit, children }) {
  const [story, setStory] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    makeStory(photo, message, author, credit, controller.signal).then((file) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(file);
      setStory({ file, url: objectUrl });
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo, message, author, credit]);

  if (error) return <>{children}<p className="hint">Your card was submitted. The Story video couldn’t be created on this device.</p></>;
  if (!story) return <>{children}<p className="hint" role="status">Preparing your Story video…</p></>;
  const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const shareData = { files: [story.file] };
  const canSaveToPhotos = isAppleMobile && navigator.share && navigator.canShare?.(shareData);

  async function saveToPhotos() {
    setSaveError(false);
    try {
      await navigator.share(shareData);
    } catch (cause) {
      if (cause.name !== 'AbortError') setSaveError(true);
    }
  }

  return <>
    <video className="photo-story-preview" src={story.url} aria-label="Animated gratitude card" controls playsInline preload="metadata"/>
    {canSaveToPhotos ? <>
      <button className="button" type="button" onClick={saveToPhotos}>Save to Photos</button>
      <p className="hint">Choose Save Video to add the card to Photos. <a href={story.url} download={STORY_FILENAME}>Download file</a></p>
    </> : <a className="button" href={story.url} download={STORY_FILENAME}>Download Story video</a>}
    {saveError && <p className="error" role="alert">The share menu couldn’t open. Try Download file.</p>}
  </>;
}
