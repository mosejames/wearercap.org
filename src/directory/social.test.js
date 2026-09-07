import { it, expect } from 'vitest';
import { socialUrl, validateListing, emptyListing } from './model.js';
it('turns handles into links and preserves full company URLs', () => {
  expect(socialUrl({platform:'Instagram',url:'@omg.booth'})).toBe('https://www.instagram.com/omg.booth');
  expect(socialUrl({platform:'TikTok',url:'@omgbooth'})).toBe('https://www.tiktok.com/@omgbooth');
  expect(socialUrl({platform:'LinkedIn',url:'https://www.linkedin.com/company/omg/'})).toBe('https://www.linkedin.com/company/omg/');
  expect(() => socialUrl({platform:'Other',url:'javascript:alert(1)'})).toThrow();
});
it('publishes with social contact alone and ignores unused extra rows', () => {
  const result=validateListing({...emptyListing(),name:'OMG',bio:'Photo booths',social_profiles:[{platform:'Instagram',url:'@omgbooth'},{platform:'Instagram',url:''}]},true);
  expect(result.social_profiles).toEqual([{platform:'Instagram',url:'https://www.instagram.com/omgbooth'}]);
});
