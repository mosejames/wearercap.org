export function createEditor(canvas, onChange = () => {}) {
  const ctx = canvas.getContext('2d'), points = new Map(), W = 1080, H = 1920;
  let photo = null, artwork = null, stickers = [], active = null, remembered = null, nextId = 1;
  let min = 1, zoom = 1, x = 0, y = 0, disabled = false, handle = null;
  canvas.width = W; canvas.height = H;
  const selected = () => stickers.find(s => s.id === active);
  const rotate = (p, angle) => ({ x: p.x * Math.cos(angle) - p.y * Math.sin(angle), y: p.x * Math.sin(angle) + p.y * Math.cos(angle) });
  function clamp() {
    if (!photo) return;
    x = Math.min(0, Math.max(W - photo.naturalWidth * zoom, x));
    y = Math.min(0, Math.max(H - photo.naturalHeight * zoom, y));
    for (const s of stickers) {
      const ex = (Math.abs(Math.cos(s.angle)) * s.w + Math.abs(Math.sin(s.angle)) * s.h) / 2;
      const ey = (Math.abs(Math.sin(s.angle)) * s.w + Math.abs(Math.cos(s.angle)) * s.h) / 2;
      s.cx = Math.max(ex, Math.min(W - ex, s.cx)); s.cy = Math.max(ey, Math.min(H - ey, s.cy));
    }
  }
  function deleteGrip(s) { const p = rotate({ x: -s.w / 2, y: -s.h / 2 }, s.angle); return { x: s.cx + p.x, y: s.cy + p.y }; }
  function grip(s) { const p = rotate({ x: s.w / 2, y: s.h / 2 }, s.angle); return { x: s.cx + p.x, y: s.cy + p.y }; }
  function draw(target, guides = false) {
    target.clearRect(0, 0, W, H); if (!photo) return;
    target.drawImage(photo, x, y, photo.naturalWidth * zoom, photo.naturalHeight * zoom);
    for (const s of stickers) {
      target.save(); target.translate(s.cx, s.cy); target.rotate(s.angle);
      target.drawImage(s.image, -s.w / 2, -s.h / 2, s.w, s.h);
      if (guides && s.id === active && !disabled) {
        target.strokeStyle = '#fff'; target.lineWidth = 5; target.shadowColor = '#152845'; target.shadowBlur = 6; target.setLineDash([14, 10]);
        target.strokeRect(-s.w / 2 - 8, -s.h / 2 - 8, s.w + 16, s.h + 16);
        target.setLineDash([]); target.beginPath(); target.arc(s.w / 2, s.h / 2, 40, 0, Math.PI * 2); target.fillStyle = '#152845'; target.fill(); target.stroke();
        target.fillStyle = '#fff'; target.font = 'bold 44px sans-serif'; target.textAlign = 'center'; target.textBaseline = 'middle'; target.fillText('↔', s.w / 2, s.h / 2);
        target.beginPath(); target.arc(-s.w / 2, -s.h / 2, 48, 0, Math.PI * 2); target.fillStyle = '#a03430'; target.fill(); target.stroke();
        target.fillStyle = '#fff'; target.font = 'bold 58px sans-serif'; target.fillText('×', -s.w / 2, -s.h / 2);
      }
      target.restore();
    }
  }
  function render() {
    draw(ctx, true); const s = selected(); if (s) remembered = s.id;
    onChange({ active: s ? 'sticker' : 'photo', hasSticker: stickers.length > 0, stickerKey: s?.key || null, count: stickers.length,
      composition: JSON.stringify({ x, y, zoom, stickers: stickers.map(({ image, ...value }) => value) }) });
  }
  function resetPhoto() { zoom = min; x = (W - photo.naturalWidth * zoom) / 2; y = (H - photo.naturalHeight * zoom) / 2; }
  function scaleSticker(s, ratio) { const w = Math.max(W * .15, Math.min(W * .85, s.w * ratio)); s.h *= w / s.w; s.w = w; }
  function transform(ratio, delta = 0, from = { x: W / 2, y: H / 2 }, to = from) {
    const s = selected();
    if (s) {
      const oldWidth = s.w; scaleSticker(s, ratio); const actualRatio = s.w / oldWidth;
      const offset = rotate({ x: (s.cx - from.x) * actualRatio, y: (s.cy - from.y) * actualRatio }, delta);
      s.cx = to.x + offset.x; s.cy = to.y + offset.y; s.angle = Math.atan2(Math.sin(s.angle + delta), Math.cos(s.angle + delta));
    } else {
      const next = Math.max(min, Math.min(min * 5, zoom * ratio)), r = next / zoom;
      x = to.x - (from.x - x) * r; y = to.y - (from.y - y) * r; zoom = next;
    }
    clamp(); render();
  }
  function move(dx, dy) { const s = selected(); if (s) { s.cx += dx; s.cy += dy; } else { x += dx; y += dy; } clamp(); render(); }
  function pos(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
  function hit(s, p) { const q = rotate({ x: p.x - s.cx, y: p.y - s.cy }, -s.angle); return Math.abs(q.x) <= s.w / 2 + 32 && Math.abs(q.y) <= s.h / 2 + 32; }
  canvas.addEventListener('pointerdown', e => {
    if (!photo || disabled || points.size >= 2) return;
    e.preventDefault(); const p = pos(e), s = selected();
    if (!points.size) {
      const d = s && deleteGrip(s);
      if (d && Math.hypot(d.x - p.x, d.y - p.y) < 80) { remove(); return; }
      const g = s && grip(s);
      if (g && Math.hypot(g.x - p.x, g.y - p.y) < 76) handle = { id: e.pointerId };
      else { active = [...stickers].reverse().find(item => hit(item, p))?.id || null; handle = null; }
      render();
    } else handle = null;
    canvas.setPointerCapture(e.pointerId); points.set(e.pointerId, p);
  });
  canvas.addEventListener('pointermove', e => {
    if (!points.has(e.pointerId) || disabled) return;
    e.preventDefault(); const old = [...points.values()], previous = points.get(e.pointerId), current = pos(e); points.set(e.pointerId, current);
    const s = selected();
    if (points.size === 1 && handle && s) {
      const a = { x: previous.x - s.cx, y: previous.y - s.cy }, b = { x: current.x - s.cx, y: current.y - s.cy };
      const distance = Math.hypot(a.x, a.y);
      if (distance > 1) transform(Math.hypot(b.x, b.y) / distance, Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x), { x: s.cx, y: s.cy });
    } else if (points.size === 1) move(current.x - previous.x, current.y - previous.y);
    else {
      const next = [...points.values()], a = { x: (old[0].x + old[1].x) / 2, y: (old[0].y + old[1].y) / 2 }, b = { x: (next[0].x + next[1].x) / 2, y: (next[0].y + next[1].y) / 2 };
      const d = Math.hypot(old[1].x - old[0].x, old[1].y - old[0].y), n = Math.hypot(next[1].x - next[0].x, next[1].y - next[0].y);
      if (d > 1) transform(n / d, Math.atan2(next[1].y - next[0].y, next[1].x - next[0].x) - Math.atan2(old[1].y - old[0].y, old[1].x - old[0].x), a, b);
    }
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, e => { points.delete(e.pointerId); handle = null; });
  canvas.addEventListener('wheel', e => { if (!photo || disabled) return; e.preventDefault(); transform(Math.exp(-e.deltaY * .002), 0, pos(e)); }, { passive: false });
  function remove() { if (disabled || !selected()) return; stickers = stickers.filter(s => s.id !== active); active = null; render(); }
  canvas.addEventListener('keydown', e => {
    if (!photo || disabled) return; const step = e.shiftKey ? 60 : 20;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); move(e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0, e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0); }
    else if (['+', '=', '-'].includes(e.key)) { e.preventDefault(); const s = selected(); transform(e.key === '-' ? .9 : 1.1, 0, s ? { x: s.cx, y: s.cy } : undefined); }
    else if (['[', ']'].includes(e.key) && selected()) { e.preventDefault(); const s = selected(); transform(1, (e.key === '[' ? -1 : 1) * Math.PI / 36, { x: s.cx, y: s.cy }); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { if (selected()) { e.preventDefault(); remove(); } }
  });
  return {
    set(image, stickerArtwork) { photo = image; artwork = stickerArtwork; stickers = []; active = null; points.clear(); handle = null; disabled = false; min = Math.max(W / photo.naturalWidth, H / photo.naturalHeight); resetPhoto(); render(); },
    addSticker(image = artwork, key = 'rca') {
      if (!photo || !image || disabled) return;
      const w = W * .55, h = w * image.naturalHeight / image.naturalWidth, offset = (stickers.length % 5) * 100;
      const s = { id: nextId++, key, image, cx: W / 2, cy: H - h / 2 - 160 - offset, w, h, angle: 0 };
      stickers.push(s); active = s.id; clamp(); render();
    },
    removeSticker: remove,
    select(value) { if (disabled) return; active = value === 'photo' ? null : stickers.find(s => s.id === remembered)?.id || stickers.at(-1)?.id || null; render(); },
    reset() { if (!photo || disabled) return; resetPhoto(); render(); },
    disable(value) { disabled = value; points.clear(); handle = null; render(); },
    clear() { photo = artwork = null; stickers = []; active = null; points.clear(); handle = null; ctx.clearRect(0, 0, W, H); },
    async export() {
      const output = document.createElement('canvas'); output.width = W; output.height = H; draw(output.getContext('2d'));
      let blob = await new Promise(resolve => output.toBlob(resolve, 'image/jpeg', .9));
      if (blob?.size > 2100000) blob = await new Promise(resolve => output.toBlob(resolve, 'image/jpeg', .72));
      if (!blob || blob.size > 2100000) throw Error('Please choose a smaller photo.'); return blob;
    }
  };
}
