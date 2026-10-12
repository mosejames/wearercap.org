import {describe,it,expect} from 'vitest';
import {instagramAccount,instagramCredits,distinctStoryMedia} from './instagram.js';
describe('Instagram photo attribution',()=>{
 it('recognizes imported account credit',()=>expect(instagramAccount({uploaderName:'Shared on Instagram by @kimbearden'})).toBe('kimbearden'));
 it('keeps regular contributors unchanged',()=>expect(instagramAccount({uploaderName:'A trip friend'})).toBeNull());
 it('rejects injected links and malformed names',()=>{for(const name of ['@evil/redirect','x<script>','x?next=evil',''])expect(instagramAccount({uploaderName:'Shared on Instagram by '+name})).toBeNull();});
});
it('keeps every repost credit while suppressing only a duplicate whose canonical is visible',()=>{
 const canonical={id:'aec98542-f1d6-520b-a8fd-e42d763c54ca',uploaderName:'Shared on Instagram by @kimbearden'};
 const duplicate={id:'bfa4a2c8-dc73-558b-a9de-0139aa3fa1ba',uploaderName:'Shared on Instagram by @ronclarkacademy'};
 expect(distinctStoryMedia([duplicate,canonical])).toEqual([canonical]);
 expect(distinctStoryMedia([duplicate])).toEqual([duplicate]);
 expect(instagramCredits(canonical).map(x=>x.account)).toEqual(['kimbearden','ronclarkacademy']);
 expect(instagramCredits(duplicate)).toEqual(instagramCredits(canonical));
});
it('credits both sharing accounts for the ATL/LHR collage without adding a new gallery row',()=>{
 const photo={id:'3770f920-b94c-51d9-a83a-58e247276c21',uploaderName:'Shared on Instagram by @ronclarkacademy'};
 expect(instagramCredits(photo).map(x=>x.account)).toEqual(['ronclarkacademy','the.cam_']);
 expect(instagramCredits({id:photo.id,uploaderName:'A trip friend'})).toEqual([]);
});
