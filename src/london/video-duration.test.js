import {it,expect,vi,afterEach} from 'vitest';
import {videoDuration} from './video-duration.js';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
function metadata(duration){const node={duration,load:vi.fn(),removeAttribute:vi.fn()};Object.defineProperty(node,'src',{set(){queueMicrotask(()=>node.onloadedmetadata?.());}});vi.spyOn(document,'createElement').mockReturnValue(node);vi.stubGlobal('URL',{createObjectURL:vi.fn(()=> 'blob:clip'),revokeObjectURL:vi.fn()});return node;}
it('reads clip length and releases the local preview before compression',async()=>{const node=metadata(30);expect(await videoDuration(new Blob())).toBe(30);expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:clip');expect(node.removeAttribute).toHaveBeenCalledWith('src');});
it('rejects unreadable durations instead of allowing an unbounded video',async()=>{metadata(Infinity);await expect(videoDuration(new Blob())).rejects.toThrow('video length');expect(URL.revokeObjectURL).toHaveBeenCalled();});
it('honors cancellation before metadata work',async()=>{metadata(10);const controller=new AbortController();controller.abort();await expect(videoDuration(new Blob(),{signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});expect(URL.revokeObjectURL).toHaveBeenCalled();});
