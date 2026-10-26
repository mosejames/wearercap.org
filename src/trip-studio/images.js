export async function loadImage(src) {
  const image = new Image(); image.src = src;
  await image.decode(); return image;
}
export async function prepareBrandImage(file, logo = false) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10000000) throw Error('Choose a PNG, JPEG or WebP under 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url), scale = Math.min(1, (logo ? 400 : 1400) / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL(logo ? 'image/png' : 'image/jpeg', .8);
    if (data.length > 650000) throw Error('This image is too detailed. Choose a smaller image.');
    return data;
  } finally { URL.revokeObjectURL(url); }
}
function wrap(ctx, text, x, y, width, line) {
  // Character wrapping also bounds long destination names without spaces.
  let row = '', rows = 0;
  for (const char of text) {
    if (ctx.measureText(row + char).width > width && row) {
      ctx.fillText(row.trim(), x, y); y += line; row = ''; rows++;
      if (rows >= 3) return;
    }
    row += char;
  }
  ctx.fillText(row.trim(), x, y);
}
export async function shareImage(trip) {
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 630;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = trip.colors.navy; ctx.fillRect(0, 0, 1200, 630);
  if (trip.hero) {
    const hero = await loadImage(trip.hero); const scale = Math.max(380 / hero.width, 630 / hero.height);
    ctx.save(); ctx.beginPath(); ctx.rect(820, 0, 380, 630); ctx.clip(); ctx.drawImage(hero, 820 + (380 - hero.width * scale) / 2, (630 - hero.height * scale) / 2, hero.width * scale, hero.height * scale); ctx.restore();
  }
  ctx.fillStyle = trip.colors.paper; ctx.font = 'bold 24px Arial'; ctx.fillText('RON CLARK ACADEMY', 66, 82);
  if (trip.logo) { const image = await loadImage(trip.logo); const scale = Math.min(130 / image.width, 100 / image.height); ctx.drawImage(image, 650, 40, image.width * scale, image.height * scale); }
  const title = trip.destination || 'Your next adventure'; ctx.font = `bold ${title.length > 35 ? 48 : 64}px Arial`; wrap(ctx, title, 66, 245, 700, 78);
  ctx.fillStyle = trip.colors.yellow; ctx.font = 'bold 34px Arial'; ctx.fillText(trip.cohort ? `CLASS OF ${trip.cohort}` : 'CLASS YEAR TO COME', 66, 460);
  ctx.fillStyle = trip.colors.paper; ctx.font = '26px Arial'; ctx.fillText('One trip. Every moment.', 66, 520);
  ctx.fillStyle = trip.colors.yellow; ctx.fillRect(0, 605, 1200, 25);
  return canvas.toDataURL('image/png');
}
export function downloadFile(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); }
