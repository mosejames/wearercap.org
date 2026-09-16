import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { prepareImage } from './images.js';
vi.mock('exifr', () => ({ parse: async () => ({ DateTimeOriginal: new Date('2026-09-15T12:00:00Z') }) }));
let encodes, bitmap;
beforeEach(() => {
  encodes = [];
  bitmap = { width: 4032, height: 3024, close: vi.fn() };
  vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap));
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(tag => {
    if (tag !== 'canvas') return create(tag);
    const canvas = { width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage() {} }),
      toBlob(callback, type, quality) {
        encodes.push({ width: this.width, height: this.height, type, quality });
        callback(new Blob(['compressed'], { type }));
      },
    };
    return canvas;
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('saves an optimized JPEG master with its actual dimensions and capture date', async () => {
  const input = new File(['camera source bytes'], 'camera.png', { type:'image/png' });
  const out = await prepareImage(input, { optimize:true });
  expect(encodes[0]).toEqual({ width:2560, height:1920, type:'image/jpeg', quality:0.85 });
  expect(out).toMatchObject({ width:2560, height:1920, ext:'jpg', contentType:'image/jpeg', takenAt:new Date('2026-09-15T12:00:00Z') });
  expect(out.orig).not.toBe(input);
  expect(out.orig.size).toBeLessThan(input.size);
  expect(bitmap.close).toHaveBeenCalled();
});
it('preserves portrait proportions and never enlarges a smaller photo', async () => {
  bitmap.width=1200; bitmap.height=1800;
  const out=await prepareImage(new File(['png'], 'portrait.png', { type:'image/png' }), { optimize:true });
  expect(out).toMatchObject({ width:1200, height:1800 });
  expect(encodes[0]).toMatchObject({ width:1200, height:1800 });
});
it('retains an already-small JPEG when recompression would increase its size', async () => {
  bitmap.width=800; bitmap.height=600;
  const file=new File(['tiny'], 'small.jpg', { type:'image/jpeg' });
  const out=await prepareImage(file, { optimize:true });
  expect(out.orig).toBe(file);
  expect(out).toMatchObject({width:800,height:600});
});
it('keeps original storage behavior for other apps that share the image pipeline', async () => {
  const file=new File(['original'], 'camera.png', {type:'image/png'});
  const out=await prepareImage(file);
  expect(out.orig).toBe(file);
  expect(out).toMatchObject({width:4032,height:3024,ext:'png',contentType:'image/png'});
  expect(encodes).toHaveLength(2);
});
