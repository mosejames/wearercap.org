import {describe,it,expect} from 'vitest';
import {instagramAccount} from './instagram.js';
describe('Instagram photo attribution',()=>{
 it('recognizes imported account credit',()=>expect(instagramAccount({uploaderName:'Shared on Instagram by @kimbearden'})).toBe('kimbearden'));
 it('keeps regular contributors unchanged',()=>expect(instagramAccount({uploaderName:'A trip friend'})).toBeNull());
 it('rejects injected links and malformed names',()=>{for(const name of ['@evil/redirect','x<script>','x?next=evil',''])expect(instagramAccount({uploaderName:'Shared on Instagram by '+name})).toBeNull();});
});
