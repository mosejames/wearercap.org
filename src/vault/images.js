// ---------------------------------------------------------------------------
// Client-side image preparation. Runs on the phone before anything uploads.
//
// For each picked file this produces three blobs — the untouched original,
// a ~1800px web rendition for the lightbox, a ~560px thumb for the grid —
// plus dimensions and the EXIF capture time. HEIC that the browser cannot
// decode (Chrome on a Mac, mostly; iPhones hand Safari a JPEG) is converted
// with heic-to, loaded only when it is actually needed.
// ---------------------------------------------------------------------------
import { WEB_MAX, THUMB_MAX, WEB_QUALITY, THUMB_QUALITY, HEIC_ORIGINAL_QUALITY } from './config.js';

const isHeic = (file) =>
  /image\/hei[cf]/i.test(file.type || '') || /\.hei[cf]$/i.test(file.name || '');

export const extOf = (file) => {
  const fromName = (file.name || '').split('.').pop().toLowerCase();
  if (/^(jpe?g|png|webp|gif|heic|heif)$/.test(fromName)) return fromName === 'jpeg' ? 'jpg' : fromName;
  const t = (file.type || '').toLowerCase();
  if (t === 'image/jpeg') return 'jpg';
  if (t === 'image/png') return 'png';
  if (t === 'image/webp') return 'webp';
  if (t === 'image/gif') return 'gif';
  if (/hei[cf]/.test(t)) return 'heic';
  return 'jpg';
};

export async function readTakenAt(file) {
  try {
    const exifr = await import('exifr');
    const out = await exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate'] });
    const d = out?.DateTimeOriginal || out?.CreateDate || out?.ModifyDate;
    if (d instanceof Date && !Number.isNaN(d.getTime()) && d.getFullYear() > 2000) return d;
  } catch { /* no EXIF is normal for screenshots and forwarded images */ }
  if (file.lastModified && file.lastModified > 0) return new Date(file.lastModified);
  return null;
}

// Decode to something drawImage accepts, honouring EXIF orientation.
async function decode(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch { /* fall back to <img> below */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await (img.decode ? img.decode() : new Promise((ok, no) => { img.onload = ok; img.onerror = no; }));
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const sizeOf = (src) => ({
  w: src.naturalWidth || src.width,
  h: src.naturalHeight || src.height,
});

function fit(w, h, max) {
  const s = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

async function toJpeg(src, max, quality) {
  const { w, h } = sizeOf(src);
  const t = fit(w, h, max);
  const canvas = document.createElement('canvas');
  canvas.width = t.w; canvas.height = t.h;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, t.w, t.h);
  ctx.drawImage(src, 0, 0, t.w, t.h);
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', quality));
  canvas.width = canvas.height = 0;
  if (!blob) throw new Error('Could not encode JPEG');
  return { blob, w: t.w, h: t.h };
}

async function heicToJpeg(file) {
  const { heicTo } = await import('heic-to');
  const out = await heicTo({ blob: file, type: 'image/jpeg', quality: HEIC_ORIGINAL_QUALITY });
  return new File([out], (file.name || 'photo').replace(/\.hei[cf]$/i, '') + '.jpg', { type: 'image/jpeg' });
}

/**
 * @param {File} file
 * @returns {Promise<{id:string, ext:string, contentType:string, orig:Blob, web:Blob, thumb:Blob, width:number, height:number, takenAt:Date|null, name:string}>}
 */
export async function prepareImage(file) {
  const takenAt = await readTakenAt(file);
  let orig = file;
  let bitmap;
  try {
    bitmap = await decode(orig);
  } catch (e) {
    if (!isHeic(file)) throw new Error(`Could not read ${file.name || 'this image'}`);
    orig = await heicToJpeg(file);
    bitmap = await decode(orig);
  }
  // Chrome on iOS can decode HEIC but cannot re-encode it; if the original is
  // still HEIC we keep it as-is (Safari and Photos open it) — the web and
  // thumb renditions are JPEG either way.
  try {
    const { w, h } = sizeOf(bitmap);
    const web = await toJpeg(bitmap, WEB_MAX, WEB_QUALITY);
    const thumb = await toJpeg(bitmap, THUMB_MAX, THUMB_QUALITY);
    return {
      id: crypto.randomUUID(),
      name: file.name || 'photo',
      ext: extOf(orig),
      contentType: orig.type || 'image/jpeg',
      orig, web: web.blob, thumb: thumb.blob,
      width: w, height: h,
      takenAt,
    };
  } finally {
    if (bitmap && typeof bitmap.close === 'function') bitmap.close();
  }
}
