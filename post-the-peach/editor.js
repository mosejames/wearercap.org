export function createEditor(canvas, onChange = () => {}) {
  const ctx = canvas.getContext('2d'), points = new Map();
  const W = 1080, H = 1920;
  let photo = null, artwork = null, sticker = null, active = 'photo';
  let min = 1, zoom = 1, x = 0, y = 0, disabled = false;
  canvas.width = W; canvas.height = H;
  function clamp() {
    if (!photo) return;
    x = Math.min(0, Math.max(W - photo.naturalWidth * zoom, x));
    y = Math.min(0, Math.max(H - photo.naturalHeight * zoom, y));
    if (sticker) {
      sticker.x = Math.max(0, Math.min(W - sticker.w, sticker.x));
      sticker.y = Math.max(0, Math.min(H - sticker.h, sticker.y));
    }
  }
  function draw(target, selected = false) {
    target.clearRect(0, 0, W, H);
    if (!photo) return;
    target.drawImage(photo, x, y, photo.naturalWidth * zoom, photo.naturalHeight * zoom);
    if (sticker) {
      target.drawImage(artwork, sticker.x, sticker.y, sticker.w, sticker.h);
      if (selected && active === 'sticker' && !disabled) {
        target.save(); target.strokeStyle = '#fff'; target.lineWidth = 4;
        target.shadowColor = '#152845'; target.shadowBlur = 5;
        target.setLineDash([14, 10]);
        target.strokeRect(sticker.x - 6, sticker.y - 6, sticker.w + 12, sticker.h + 12);
        target.restore();
      }
    }
  }
  function render() {
    draw(ctx, true);
    onChange({ active, hasSticker: !!sticker, photoZoom: zoom / min, stickerSize: sticker ? sticker.w / W : .55, composition: JSON.stringify({ x, y, zoom, sticker }) });
  }
  function resetPhoto() { zoom = min; x = (W - photo.naturalWidth * zoom) / 2; y = (H - photo.naturalHeight * zoom) / 2; }
  function resizeSticker(width, anchor) {
    if (!sticker) return;
    const next = Math.max(W * .2, Math.min(W * .9, width));
    const center = anchor || { x: sticker.x + sticker.w / 2, y: sticker.y + sticker.h / 2 };
    const ratio = next / sticker.w;
    sticker.x = center.x - (center.x - sticker.x) * ratio;
    sticker.y = center.y - (center.y - sticker.y) * ratio;
    sticker.w = next; sticker.h = next * artwork.naturalHeight / artwork.naturalWidth;
  }
  function scale(value, anchor = { x: W / 2, y: H / 2 }) {
    if (!photo || disabled) return;
    if (active === 'sticker') resizeSticker(sticker.w * value, anchor);
    else {
      const next = Math.max(min, Math.min(min * 5, zoom * value)), ratio = next / zoom;
      x = anchor.x - (anchor.x - x) * ratio; y = anchor.y - (anchor.y - y) * ratio; zoom = next;
    }
    clamp(); render();
  }
  function pos(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
  function move(dx, dy) { if (active === 'sticker') { sticker.x += dx; sticker.y += dy; } else { x += dx; y += dy; } clamp(); render(); }
  canvas.addEventListener('pointerdown', e => {
    if (!photo || disabled || points.size >= 2) return;
    e.preventDefault(); const p = pos(e);
    if (!points.size) {
      active = sticker && p.x >= sticker.x - 40 && p.x <= sticker.x + sticker.w + 40 && p.y >= sticker.y - 40 && p.y <= sticker.y + sticker.h + 40 ? 'sticker' : 'photo';
      render();
    }
    canvas.setPointerCapture(e.pointerId); points.set(e.pointerId, p);
  });
  canvas.addEventListener('pointermove', e => {
    if (!points.has(e.pointerId) || disabled) return;
    e.preventDefault(); const old = [...points.values()], previous = points.get(e.pointerId), current = pos(e);
    points.set(e.pointerId, current);
    if (points.size === 1) move(current.x - previous.x, current.y - previous.y);
    else {
      const next = [...points.values()];
      const a = { x: (old[0].x + old[1].x) / 2, y: (old[0].y + old[1].y) / 2 }, b = { x: (next[0].x + next[1].x) / 2, y: (next[0].y + next[1].y) / 2 };
      const d = Math.hypot(old[1].x - old[0].x, old[1].y - old[0].y), n = Math.hypot(next[1].x - next[0].x, next[1].y - next[0].y);
      if (d > 0) scale(n / d, a);
      move(b.x - a.x, b.y - a.y);
    }
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, e => points.delete(e.pointerId));
  canvas.addEventListener('wheel', e => { if (!photo || disabled) return; e.preventDefault(); scale(Math.exp(-e.deltaY * .002), pos(e)); }, { passive: false });
  canvas.addEventListener('keydown', e => {
    if (!photo || disabled) return;
    const step = e.shiftKey ? 60 : 20;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault(); move(e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0);
    } else if (['+', '=', '-'].includes(e.key)) { e.preventDefault(); scale(e.key === '-' ? .9 : 1.1); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { if (active === 'sticker') { e.preventDefault(); sticker = null; active = 'photo'; render(); } }
  });
  return {
    set(image, stickerArtwork) { photo = image; artwork = stickerArtwork; sticker = null; active = 'photo'; points.clear(); disabled = false; min = Math.max(W / photo.naturalWidth, H / photo.naturalHeight); resetPhoto(); render(); },
    addSticker() { if (!photo || !artwork || disabled) return; if (!sticker) { const w = W * .55, h = w * artwork.naturalHeight / artwork.naturalWidth; sticker = { x: (W - w) / 2, y: H - h - 160, w, h }; } active = 'sticker'; render(); },
    removeSticker() { if (disabled) return; sticker = null; active = 'photo'; render(); },
    select(value) { if (disabled || (value === 'sticker' && !sticker)) return; active = value; render(); },
    reset() { if (!photo || disabled) return; resetPhoto(); render(); },
    setZoom(value) { if (!photo || disabled) return; const previous = active; active = 'photo'; scale(min * value / zoom); active = previous; render(); },
    setStickerSize(value) { if (!sticker || disabled) return; resizeSticker(W * value); clamp(); render(); },
    disable(value) { disabled = value; points.clear(); render(); },
    clear() { photo = artwork = sticker = null; active = 'photo'; points.clear(); ctx.clearRect(0, 0, W, H); },
    async export() {
      // Draw to a separate canvas so selection guides never enter the saved JPEG.
      const output = document.createElement('canvas'); output.width = W; output.height = H; draw(output.getContext('2d'));
      let blob = await new Promise(resolve => output.toBlob(resolve, 'image/jpeg', .9));
      if (blob?.size > 2100000) blob = await new Promise(resolve => output.toBlob(resolve, 'image/jpeg', .72));
      if (!blob || blob.size > 2100000) throw Error('Please choose a smaller photo.');
      return blob;
    }
  };
}
