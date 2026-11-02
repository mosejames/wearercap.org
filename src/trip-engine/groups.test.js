import {expect,it} from 'vitest';
import {usesGroups,uploadGroup} from './groups.js';
const groups=['Group A','Group AA','Mixed'];
it('ignores a stale remembered group for DC uploads and keeps the valid shared storage contract',()=>{
 const dc={slug:'washington-dc-2030',groups};
 expect(usesGroups(dc)).toBe(false);
 expect(uploadGroup(dc,'Group A')).toBe('Mixed');
 expect(uploadGroup(dc,'')).toBe('Mixed');
});
it('preserves group selection for other configured trips',()=>{
 const other={slug:'another-trip',groups};expect(usesGroups(other)).toBe(true);expect(uploadGroup(other,'Group AA')).toBe('Group AA');
});
