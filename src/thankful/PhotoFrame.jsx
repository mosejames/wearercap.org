import React, { useRef } from 'react';

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
const STORY_ASPECT = STORY_WIDTH / STORY_HEIGHT;

export const initialCrop = { x: 0, y: 0, zoom: 1 };

// Coordinates are relative to the 9:16 card, so the export matches the editor.
function cover(image) {
  const aspect = image.naturalWidth / image.naturalHeight;
  return { width: Math.max(1, aspect / STORY_ASPECT), height: Math.max(1, STORY_ASPECT / aspect) };
}

export function limitCrop(image, crop) {
  if (!image?.naturalWidth) return initialCrop;
  const { width, height } = cover(image);
  const zoom = Math.min(4, Math.max(1, crop.zoom));
  const xLimit = (width * zoom - 1) / 2;
  const yLimit = (height * zoom - 1) / 2;
  return {
    x: Math.min(xLimit, Math.max(-xLimit, crop.x)),
    y: Math.min(yLimit, Math.max(-yLimit, crop.y)),
    zoom,
  };
}

export async function exportPhoto(image, crop) {
  await image.decode();
  const canvas = Object.assign(document.createElement('canvas'), { width: STORY_WIDTH, height: STORY_HEIGHT });
  const context = canvas.getContext('2d');
  const base = cover(image);
  const width = base.width * crop.zoom * canvas.width;
  const height = base.height * crop.zoom * canvas.height;
  context.drawImage(image, (canvas.width - width) / 2 + crop.x * canvas.width,
    (canvas.height - height) / 2 + crop.y * canvas.height, width, height);
  return new Promise((resolve, reject) => canvas.toBlob(
    blob => blob ? resolve(blob) : reject(Error('Photo unavailable')),
    'image/jpeg', .9,
  ));
}

function measure(points) {
  const [one, two] = [...points.values()];
  if (!two) return { x: one.x, y: one.y, distance: 0 };
  return { x: (one.x + two.x) / 2, y: (one.y + two.y) / 2, distance: Math.hypot(one.x - two.x, one.y - two.y) };
}

export default function PhotoFrame({ photo, imageRef, crop, onCrop, disabled }) {
  const points = useRef(new Map());

  function move(event) {
    if (disabled || !points.current.has(event.pointerId)) return;
    const before = measure(points.current);
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const after = measure(points.current);
    const box = event.currentTarget.getBoundingClientRect();
    onCrop(current => {
      const zoom = before.distance > 0 ? Math.min(4, Math.max(1, current.zoom * after.distance / before.distance)) : current.zoom;
      const ratio = zoom / current.zoom;
      const anchorX = (before.x - box.left) / box.width - .5;
      const anchorY = (before.y - box.top) / box.height - .5;
      return limitCrop(imageRef.current, {
        x: anchorX + (current.x - anchorX) * ratio + (after.x - before.x) / box.width,
        y: anchorY + (current.y - anchorY) * ratio + (after.y - before.y) / box.height,
        zoom,
      });
    });
  }

  return <div className="photo-gesture" onPointerDown={event => {
    if (disabled || event.button !== 0 || points.current.size >= 2) return;
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
  }} onPointerMove={move} onLostPointerCapture={event => points.current.delete(event.pointerId)}>
    <img ref={imageRef} src={photo} alt="" draggable={false} style={{
      transform: `translate(${crop.x * 100}%, ${crop.y * 100}%) scale(${crop.zoom})`,
    }}/>
  </div>;
}
