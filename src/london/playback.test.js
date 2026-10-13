import {it,expect} from 'vitest';import {playbackKey} from './playback.js';
it('uses compatible video renditions without changing archived originals',()=>{
 const p={kind:'video',key:'london-2028/original.mp4'};expect(playbackKey(p,{[p.key]:'london-2028/compatible.mp4'})).toBe('london-2028/compatible.mp4');expect(p.key).toBe('london-2028/original.mp4');
});
it('falls back safely when a rendition is missing or outside the vault',()=>{
 const p={kind:'video',key:'london-2028/original.mp4'};for(const map of [{},{[p.key]:'other-vault/video.mp4'},{[p.key]:'london-2028/../video.mp4'}])expect(playbackKey(p,map)).toBe(p.key);
});
it('does not change photo share renditions',()=>{const p={kind:'photo',key:'london-2028/original.jpg'};expect(playbackKey(p,{[p.key]:'london-2028/compatible.mp4'})).toBe(p.key);});
it('uses the automatic viewing rendition while preserving the m4v archive',()=>{expect(playbackKey({kind:'video',key:'london-2028/12345678/the-whole-adventure/id/orig.m4v'})).toBe('london-2028/12345678/the-whole-adventure/id/playback.mp4');});
