import { it, expect } from 'vitest';
import { socialUrl, validateListing, emptyListing } from './model.js';
it('turns handles into links and preserves full company URLs', () => {
  expect(socialUrl({platform:'Instagram',url:'@omg.booth'})).toBe('https://www.instagram.com/omg.booth');
  expect(socialUrl({platform:'TikTok',url:'@omgbooth'})).toBe('https://www.tiktok.com/@omgbooth');
  expect(socialUrl({platform:'LinkedIn',url:'https://www.linkedin.com/company/omg/'})).toBe('https://www.linkedin.com/company/omg/');
  expect(() => socialUrl({platform:'Other',url:'javascript:alert(1)'})).toThrow();
});
it('keeps social profiles and ignores unused extra rows', () => {
  const result=validateListing({...emptyListing(),name:'OMG',bio:'Photo booths',email:'hi@omgbooth.com',phone:'404 555 0100',social_profiles:[{platform:'Instagram',url:'@omgbooth'},{platform:'Instagram',url:''}]},true);
  expect(result.social_profiles).toEqual([{platform:'Instagram',url:'https://www.instagram.com/omgbooth'}]);
});
it('keeps a creation spotlight and safely falls back after its photo is removed', () => {
 const result=validateListing({...emptyListing(),name:'Author',product_name:'My Book',product_description:'A story',product_url:'example.com/book',product_photo:'removed',photos:[]});
 expect(result.product_name).toBe('My Book');
 expect(result.product_url).toBe('https://example.com/book');
 expect(result.product_photo).toBe('');
});
