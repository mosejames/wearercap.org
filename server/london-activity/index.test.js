import {describe,it,expect,beforeEach} from 'vitest';
import {cleanSession,summarize} from './index.js';
const now=1792000000000;
const input={session:'1ff08459-560d-51ee-a2d8-44c8a3834831',visitor:'9ed3d4cc-ae0d-5bca-bad8-279ac6fa2b9d',page:'gallery',started:now-60000,seconds:999999,counts:{comments:3,caption:'must not persist'}};
beforeEach(()=>{process.env.LONDON_IMPORT_STATE_KEY='ab'.repeat(32);});
describe('London activity',()=>{
 it('stores only anonymous bounded totals without content or source identifiers',()=>{const s=cleanSession(input,now);expect(s.seconds).toBe(60);expect(s.visitor).not.toBe(input.visitor);expect(s.counts.comments).toBe(3);expect(s.counts.caption).toBeUndefined();expect(()=>cleanSession({...input,page:'/secret'},now)).toThrow();});
 it('counts one visitor across multiple visits, excluding stale or background tabs from live visitors',()=>{const s=cleanSession(input,now);const data=summarize([{...s,seconds:30,active:true},{...s,session:'other',seconds:90,active:false},{...s,visitor:'second',lastSeen:now-100000,seconds:0,active:true}],now);expect(data.visits).toBe(3);expect(data.visitors).toBe(2);expect(data.activeNow).toBe(1);expect(data.averageSeconds).toBe(40);expect(data.counts.comments).toBe(9);});
 it('rejects old sessions and caps negative counters',()=>{expect(()=>cleanSession({...input,started:now-86400001},now)).toThrow();expect(cleanSession({...input,seconds:-1,counts:{comments:-1}},now).seconds).toBe(0);});
});
