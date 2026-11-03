import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createEditor } from './editor.js';
let canvas, editor, contexts, photo, sticker, state;
beforeEach(() => {
  contexts = [];
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function () {
    if (!this.context) { this.context = { clearRect: vi.fn(), drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), setLineDash: vi.fn(), strokeRect: vi.fn() }; contexts.push(this.context); }
    return this.context;
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback, type) { callback(new Blob(['jpeg'], { type })); });
  canvas = document.createElement('canvas'); canvas.setPointerCapture = vi.fn();
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1080, height: 1920 });
  photo = { naturalWidth: 1080, naturalHeight: 1920 };
  sticker = { naturalWidth: 1521, naturalHeight: 306 };
  editor = createEditor(canvas, value => { state = value; }); editor.set(photo, sticker);
});
afterEach(() => vi.restoreAllMocks());
function pointer(type, x, y, id = 1) { const e = new Event(type, { cancelable: true }); Object.assign(e, { clientX: x, clientY: y, pointerId: id }); canvas.dispatchEvent(e); }
function placement() { return contexts[0].drawImage.mock.calls.filter(call => call[0] === sticker).at(-1).slice(1); }
it('starts with a plain full-bleed photo and exports the moved sticker without selection guides', async () => {
  expect(contexts[0].drawImage.mock.calls.at(-1)).toEqual([photo, 0, 0, 1080, 1920]);
  expect(state.hasSticker).toBe(false);
  editor.addSticker(); const initial = placement();
  pointer('pointerdown', initial[0] + 100, initial[1] + 40); pointer('pointermove', initial[0] + 200, initial[1] - 160); pointer('pointerup', 0, 0);
  const moved = placement(); expect(moved[0]).toBeCloseTo(initial[0] + 100); expect(moved[1]).toBeCloseTo(initial[1] - 200);
  expect((await editor.export()).type).toBe('image/jpeg');
  expect(contexts[1].drawImage.mock.calls.at(-1)).toEqual([sticker, ...moved]);
  expect(contexts[1].strokeRect).not.toHaveBeenCalled();
});
it('resizes only the selected sticker with two pointers and keeps it on the image', () => {
  editor.addSticker(); const [x, y, w] = placement();
  pointer('pointerdown', x + 100, y + 30, 1); pointer('pointerdown', x + 200, y + 30, 2);
  pointer('pointermove', x + 300, y + 30, 2);
  expect(placement()[2]).toBeGreaterThan(w); expect(state.photoZoom).toBe(1);
  pointer('pointerup', 0, 0, 2); pointer('pointermove', -10000, -10000, 1);
  expect(placement().slice(0, 2)).toEqual([0, 0]);
});
it('freezes composition during submission, preserves its retry identity, and supports removal', () => {
  editor.addSticker(); const before = state.composition, [x, y] = placement();
  editor.disable(true); editor.setStickerSize(.9); editor.removeSticker(); pointer('pointerdown', x, y); pointer('pointermove', 0, 0);
  expect(state.composition).toBe(before); expect(state.hasSticker).toBe(true);
  editor.disable(false); expect(state.composition).toBe(before);
  editor.removeSticker(); expect(state.hasSticker).toBe(false); expect(state.active).toBe('photo');
});
it('keyboard movement and size changes preserve the photo and constrain the sticker', () => {
  editor.addSticker(); const [x, y] = placement();
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true }));
  expect(placement()[0]).toBe(x - 20); expect(placement()[1]).toBe(y);
  editor.setStickerSize(20); expect(placement()[2]).toBe(972);
  canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', cancelable: true }));
  expect(state.hasSticker).toBe(false);
});
