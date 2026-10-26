import {shareSvg} from '../trip-engine/branding.js';
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
export async function shareImage(trip) {
  const canvas = document.createElement('canvas');canvas.width=1200;canvas.height=630;
  const url=URL.createObjectURL(new Blob([shareSvg(trip)],{type:'image/svg+xml'}));
  try{const image=await loadImage(url);canvas.getContext('2d').drawImage(image,0,0);return canvas.toDataURL('image/png');}
  finally{URL.revokeObjectURL(url);}
}
export function downloadFile(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); }
