import { it, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { preparePreview } from './preview.js';
function file(name, bytes = 'same image') { return { name, size: bytes.length, arrayBuffer: async () => new TextEncoder().encode(bytes).buffer }; }
it('skips duplicate bytes within a batch and in the existing gallery', async () => {
    vi.stubGlobal('crypto', webcrypto);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    const prepare = vi.fn(async () => ({ id: 'test', web: new Blob(), thumb: new Blob(), takenAt: new Date('2026-10-21T16:00:00Z') }));
    const first = await preparePreview([file('one.jpg'), file('renamed.jpg')], [], { contributor: 'Tester' }, prepare);
    expect(first.photos).toHaveLength(1);
    expect(first.skipped).toBe(1);
    expect(prepare).toHaveBeenCalledTimes(1);
    const second = await preparePreview([file('again.jpg')], first.photos, {}, prepare);
    expect(second.photos).toHaveLength(0);
    expect(second.skipped).toBe(1);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
it('rejects videos and oversized input before preparation', async () => {
    const prepare = vi.fn();
    const result = await preparePreview([file('clip.mp4'), { ...file('large.jpg'), size: 51 * 1024 * 1024 }], [], {}, prepare);
    expect(prepare).not.toHaveBeenCalled();
    expect(result.errors).toHaveLength(2);
});
