import {describe,it,expect,vi} from 'vitest';
vi.mock('./auth.js',()=>({supabase:{rpc:vi.fn()}}));
import {cardUrlOK,cardError,newGalleryCard,mergeGalleryCards,cardAsPromo} from './galleryCards.js';
describe('custom gallery cards',()=>{
 it('allows site paths and HTTPS destinations but rejects executable and ambiguous links',()=>{
  for(const url of ['/georgia-goal/','/rcap-capsule/#/e/rcap-trunk-or-treat-photo-booth','https://example.org/path?q=1'])expect(cardUrlOK(url)).toBe(true);
  for(const url of ['javascript:alert(1)','data:text/html,hello','//example.org','/\\example.org','https://name:password@example.org','https://example.org/\nhello','http://example.org'])expect(cardUrlOK(url)).toBe(false);
 });
 it('requires a gallery for publication but allows unassigned drafts and checks dates',()=>{
  const card={...newGalleryCard(),title:'Family night',href:'/feedback/rb-karaoke'};
  expect(cardError(card)).toBe('');expect(cardError({...card,status:'published'})).toMatch(/at least one gallery/);
  expect(cardError({...card,status:'published',event_ids:['gallery']})).toBe('');
  expect(cardError({...card,starts_on:'2026-12-10',ends_on:'2026-12-01'})).toMatch(/end date/);
 });
 it('does not resurrect migrated cards during an outage or when archived',()=>{
  const builtins=[{id:'georgia-goal'},{id:'trunk-booth-gallery'},{id:'karaoke-feedback'}];
  expect(mergeGalleryCards(builtins,null)).toEqual([{id:'karaoke-feedback'}]);
  expect(mergeGalleryCards(builtins,{cards:[],legacy_keys:['georgia-goal']})).toEqual([{id:'karaoke-feedback'}]);
 });
 it('uses exact authored copy and safe previews while preserving standard cards',()=>{
  const card={...newGalleryCard(),id:'one',title:'Our title',body:'Exact message',href:'https://example.org',image:'javascript:alert(1)'};
  const result=mergeGalleryCards([{id:'standard'}],{cards:[card]});
  expect(result.map(c=>c.id)).toEqual(['standard','custom-one']);expect(result[1].variants[0].body).toBe('Exact message');
  expect(result[1].external).toBe(true);expect(result[1].image).toBe('');expect(cardAsPromo({...card,href:'javascript:alert(1)'}).href).toBe('/');
 });
});
