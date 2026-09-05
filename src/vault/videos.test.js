import { describe, it, expect } from 'vitest';
import { isVideo, videoFormat } from './videos.js';
import { keysFor } from '../../api/vault-sign.js';

describe('video media handling', () => {
  it('recognizes stored videos and files without MIME metadata', () => {
    expect(isVideo({ contentType: 'video/mp4' })).toBe(true);
    expect(isVideo({ name: 'PHONE.MOV' })).toBe(true);
    expect(isVideo({ key: 'event/orig.webm' })).toBe(true);
    expect(isVideo({ contentType: 'image/jpeg' })).toBe(false);
  });
  it('normalizes supported container types and rejects unsupported videos', () => {
    expect(videoFormat({ name: 'PHONE.MOV' })).toEqual({ ext: 'mov', contentType: 'video/quicktime' });
    expect(videoFormat({ name: 'clip', type: 'video/webm' }).ext).toBe('webm');
    expect(() => videoFormat({ name: 'clip.avi', type: 'video/x-msvideo' })).toThrow('MP4');
  });
  it('keeps video originals separate from JPEG gallery previews', () => {
    const keys = keysFor('sparkles-takeover', 'test', 'mp4');
    expect(keys.orig).toMatch(/orig.mp4$/);
    expect(keys.web).toMatch(/web.jpg$/);
    expect(keys.thumb).toMatch(/thumb.jpg$/);
  });
});
