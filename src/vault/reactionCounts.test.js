import {it,expect,vi} from 'vitest';
import {attachReactionCounts} from './reactionCounts.js';
it('loads counts from awaitable Supabase builders without requiring Promise.catch',async()=>{
 const photos=[{id:'a',likes:7},{id:'b',likes:2}];
 const rpc=vi.fn(()=>({then:resolve=>resolve({data:[{photo_id:'a',reaction:'spooky',count:3}]})}));
 await attachReactionCounts(photos,{rpc});expect(photos[0]).toEqual({id:'a',likes:7,reactions:[{reaction:'spooky',count:3}]});expect(photos[1].reactions).toEqual([]);
});
it('batches large galleries and leaves photos available when reactions cannot load',async()=>{
 const photos=Array.from({length:501},(_,id)=>({id:String(id),likes:4}));const rpc=vi.fn().mockImplementationOnce(()=>{throw Error('Offline');}).mockResolvedValueOnce({data:[{photo_id:'500',reaction:'fun',count:1}]});
 await attachReactionCounts(photos,{rpc});expect(rpc).toHaveBeenCalledTimes(2);expect(rpc.mock.calls[0][1].p_ids).toHaveLength(500);expect(photos[0].reactions).toEqual([]);expect(photos[500].reactions[0].count).toBe(1);expect(photos[500].likes).toBe(4);
});
