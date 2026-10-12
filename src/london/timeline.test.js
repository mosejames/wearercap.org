import { describe, it, expect } from 'vitest';
import { captureTime, newestCapturedFirst } from './timeline.js';
describe('trip timeline',()=>{
 it('places a late imported clip among photos from its capture time',()=>{
  const before={id:'before',takenAt:'2026-10-11T17:00:00Z',createdAt:'2026-10-11T17:01:00Z'};
  const clip={id:'clip',takenAt:'2026-10-11T18:00:00Z',createdAt:'2026-10-12T12:00:00Z'};
  const after={id:'after',takenAt:'2026-10-11T19:00:00Z',createdAt:'2026-10-11T19:01:00Z'};
  expect([clip,before,after].sort(newestCapturedFirst).map(p=>p.id)).toEqual(['after','clip','before']);
 });
 it('uses upload time when capture metadata is missing or invalid',()=>{
  expect(captureTime({takenAt:'invalid',createdAt:'2026-10-11T18:00:00Z'})).toBe(Date.parse('2026-10-11T18:00:00Z'));
  expect(captureTime({takenAt:null,createdAt:'2026-10-11T18:00:00Z'})).toBe(Date.parse('2026-10-11T18:00:00Z'));
 });
});
