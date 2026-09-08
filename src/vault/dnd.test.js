import { describe, it, expect } from 'vitest';
import { filesFromDrop, droppable, DROP_CAP } from './dnd.js';

const file = (name, type = 'image/jpeg') => new File([new Uint8Array([1, 2, 3])], name, { type });

// Minimal stand-ins for the FileSystem entry API, which jsdom does not ship.
const fileEntry = (f) => ({ isFile: true, isDirectory: false, file: (ok) => ok(f) });
const dirEntry = (children) => ({
  isFile: false,
  isDirectory: true,
  createReader() {
    // The real reader hands back a slice at a time and ends with an empty
    // batch. Anything that calls it once is wrong, so model that here.
    let i = 0;
    return { readEntries(ok) { const batch = children.slice(i, i + 2); i += batch.length; ok(batch); } };
  },
});
const dt = ({ entries = [], files = [] }) => ({
  items: entries.map((e) => ({ kind: 'file', webkitGetAsEntry: () => e })),
  files,
});

describe('droppable', () => {
  it('takes photos and videos', () => {
    expect(droppable(file('a.jpg'))).toBe(true);
    expect(droppable(file('b.HEIC', ''))).toBe(true);
    expect(droppable(file('c.mp4', 'video/mp4'))).toBe(true);
  });
  it('skips dotfiles and other junk', () => {
    expect(droppable(file('.DS_Store', ''))).toBe(false);
    expect(droppable(file('notes.txt', 'text/plain'))).toBe(false);
    expect(droppable(null)).toBe(false);
  });
});

describe('filesFromDrop', () => {
  it('reads a plain multi-file drag', async () => {
    const out = await filesFromDrop(dt({ entries: [fileEntry(file('a.jpg')), fileEntry(file('b.jpg'))] }));
    expect(out.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg']);
  });

  it('walks a dropped folder past one readEntries batch', async () => {
    const kids = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg'].map((n) => fileEntry(file(n)));
    const out = await filesFromDrop(dt({ entries: [dirEntry(kids)] }));
    expect(out).toHaveLength(5);
  });

  it('walks nested folders and drops the junk on the way', async () => {
    const inner = dirEntry([fileEntry(file('deep.jpg')), fileEntry(file('.DS_Store', ''))]);
    const out = await filesFromDrop(dt({ entries: [dirEntry([fileEntry(file('top.jpg')), inner])] }));
    expect(out.map((f) => f.name).sort()).toEqual(['deep.jpg', 'top.jpg']);
  });

  it('stops at the cap instead of walking a whole library', async () => {
    const many = Array.from({ length: DROP_CAP + 50 }, (_, i) => fileEntry(file(`p${i}.jpg`)));
    const out = await filesFromDrop(dt({ entries: [dirEntry(many)] }));
    expect(out.length).toBeGreaterThanOrEqual(DROP_CAP);
    expect(out.length).toBeLessThan(DROP_CAP + 50);
  });

  it('falls back to dataTransfer.files when there is no entry API', async () => {
    const out = await filesFromDrop({ items: [], files: [file('x.png', 'image/png'), file('y.txt', 'text/plain')] });
    expect(out.map((f) => f.name)).toEqual(['x.png']);
  });

  it('survives an empty drop', async () => {
    expect(await filesFromDrop(null)).toEqual([]);
  });
});
