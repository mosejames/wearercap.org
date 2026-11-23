import React, { useEffect, useState } from 'react';
import { wrapCardText } from '../london/textCard.js';
import { STORY_WIDTH, STORY_HEIGHT } from './PhotoFrame.jsx';

async function makeStory(photo, message, author, credit) {
  const image = await createImageBitmap(photo);
  const logo = new Image();
  logo.src = '/images/we-are-rcap-logo.png';
  const canvas = Object.assign(document.createElement('canvas'), { width: STORY_WIDTH, height: STORY_HEIGHT });
  const ctx = canvas.getContext('2d');
  try {
    await logo.decode();
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
  ctx.drawImage(logo, margin, 100, 142, 142 * logo.naturalHeight / logo.naturalWidth);
  ctx.fillStyle = '#efbd61';
  lines.forEach((line, i) => ctx.fillText(line, margin, firstLine + i * fontSize * 1.2));
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${authorSize}px Arial`;
  authorLines.forEach((line, i) => ctx.fillText(line, margin, authorY + authorStep * i));
  ctx.fillStyle = '#e4e7ed';
  ctx.font = '32px Arial';
  creditLines.forEach((line, i) => ctx.fillText(line, margin, bottom - (creditLines.length - 1 - i) * creditStep));
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Story image unavailable')), 'image/jpeg', .92,
  ));
}

const STORY_FILENAME = 'Thankful-at-RCA-Story.jpg';

export default function PhotoStory({ photo, message, author, credit }) {
  const [story, setStory] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl;
    makeStory(photo, message, author, credit).then((blob) => {
      if (!active) return;
      const file = new File([blob], STORY_FILENAME, { type: 'image/jpeg' });
      objectUrl = URL.createObjectURL(file);
      setStory({ file, url: objectUrl });
    }).catch(() => { if (active) setError(true); });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo, message, author, credit]);

  if (error) return <p className="hint">Your card was submitted. The Story image couldn’t be saved on this device.</p>;
  if (!story) return <p className="hint" role="status">Preparing your Story image…</p>;
  const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const shareData = { files: [story.file] };
  if (!isAppleMobile || !navigator.share || !navigator.canShare?.(shareData)) {
    return <a className="button" href={story.url} download={STORY_FILENAME}>Download Story image</a>;
  }

  async function saveToPhotos() {
    setSaveError(false);
    try {
      await navigator.share(shareData);
    } catch (cause) {
      if (cause.name !== 'AbortError') setSaveError(true);
    }
  }

  return <>
    <button className="button" type="button" onClick={saveToPhotos}>Save to Photos</button>
    <p className="hint">Choose Save Image to add the card to Photos. <a href={story.url} download={STORY_FILENAME}>Download file</a></p>
    {saveError && <p className="error" role="alert">The share menu couldn’t open. Try Download file.</p>}
  </>;
}
