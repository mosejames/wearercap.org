import {it,expect} from 'vitest';import {photoDay,matchesGalleryFilters} from './galleryFilters.js';
it('uses the London capture date across midnight and upload delays',()=>{expect(photoDay({takenAt:'2026-10-11T23:30:00Z',createdAt:'2026-10-15T00:00:00Z'})).toBe('2026-10-12');});
it('combines Instagram, day, and assigned place without assuming a location',()=>{
 const p={uploaderName:'Shared on Instagram by @kimbearden',takenAt:'2026-10-12T10:00:00Z',inspiration:'tower-of-london'};
 expect(matchesGalleryFilters(p,{source:'instagram',day:'2026-10-12',place:'tower-of-london'})).toBe(true);
 expect(matchesGalleryFilters(p,{source:'shared'})).toBe(false);
 expect(matchesGalleryFilters(p,{place:'trafalgar-square'})).toBe(false);
 expect(matchesGalleryFilters({...p,inspiration:''},{place:'unassigned'})).toBe(true);
 expect(matchesGalleryFilters({...p,inspiration:''},{place:'tower-of-london'})).toBe(false);
});
