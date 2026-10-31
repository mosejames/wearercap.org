import {describe,it,expect} from 'vitest';
import {galleryCardLayout,cardKind} from './cardLayout.js';
const cards=[{id:'custom-a',title:'A'},{id:'custom-b',title:'B'},{id:'survey',title:'Survey'}];
describe('gallery card variety',()=>{
 it('randomizes placement per visit but keeps a browsing session stable',()=>{
  const a=galleryCardLayout(cards,152,4,'visit-one');
  expect(galleryCardLayout(cards,152,4,'visit-one')).toEqual(a);
  expect(galleryCardLayout(cards,152,4,'visit-two')).not.toEqual(a);
  expect(a.every(s=>s.at>=2&&s.at<=152)).toBe(true);
  expect(new Set(a.map(s=>s.at)).size).toBe(a.length);
  const positions=a.map(s=>s.at);
  expect(positions.slice(1).every((p,i)=>p-positions[i]>=3)).toBe(true);
 });
 it('keeps every custom card available in short and empty albums',()=>{
  for(const count of [0,1,3,152]){
   const slots=galleryCardLayout(cards,count,1,'short');
   expect(new Set(slots.filter(s=>s.type==='promo').map(s=>s.promo.id)).size).toBe(3);
   expect(slots.every(s=>s.at>=0&&s.at<=count)).toBe(true);
  }
 });
 it('preserves card counts and photo invitation controls',()=>{
  expect(galleryCardLayout(cards,152,4,'seed',false).every(s=>s.type==='promo')).toBe(true);
  expect(galleryCardLayout(cards,152,4,'seed').filter(s=>s.type==='upload')).toHaveLength(13);
  expect(new Set(galleryCardLayout(cards,152,4,'seed').map(s=>s.appearance)).size).toBeGreaterThan(1);
 });
 it('can limit informational cards to one appearance with no repeated upload cards',()=>{
  const slots=galleryCardLayout([{id:'custom-goal'}],152,1,'quiet',false,false);
  expect(slots).toHaveLength(1);
  expect(slots[0].type).toBe('promo');
 });
 it('repeats each Trunk or Treat card two or three times, with photos separating them',()=>{
  const promos=[{id:'custom-goal'},{id:'custom-trunk-survey'}];
  for(const count of [74,150])for(let visit=0;visit<40;visit++){
   const slots=galleryCardLayout(promos,count,1,`visit-${visit}`,false,'limited');
   for(const p of promos)expect([2,3]).toContain(slots.filter(s=>s.promo.id===p.id).length);
   expect(slots.every(s=>s.type==='promo'&&s.at>0&&s.at<=count)).toBe(true);
   expect(slots.slice(1).every((s,i)=>s.at-slots[i].at>=6)).toBe(true);
  }
 });
 it('uses small icons relevant to the destination',()=>{
  expect(cardKind({href:'/feedback/rb-karaoke'})).toBe('voice');
  expect(cardKind({href:'/georgia-goal/'})).toBe('school');
  expect(cardKind({href:'/rcap-capsule/#/e/booth'})).toBe('camera');
 });
});
