import { beforeEach, describe, expect, it, vi } from 'vitest';
const call=vi.hoisted(()=>vi.fn());
vi.mock('./rewards.js',()=>({rewardCall:call}));
vi.mock('./data.js',()=>({getToken:()=> 'legacy-token'}));
beforeEach(()=>{vi.resetModules();call.mockReset();sessionStorage.clear();});
describe('detail view tracking',()=>{
 it('keeps an anonymous session identifier stable without storing identity',async()=>{const {viewSession}=await import('./viewTracking.js');const id=viewSession();expect(id).toMatch(/^[a-f0-9]{48}$/);expect(viewSession()).toBe(id);});
 it('records a photo only once, including concurrent load events',async()=>{let finish;call.mockReturnValue(new Promise(r=>{finish=r;}));const {recordView}=await import('./viewTracking.js');const first=recordView('photo');await recordView('photo');expect(call).toHaveBeenCalledTimes(1);finish(true);await first;await recordView('photo');expect(call).toHaveBeenCalledTimes(1);});
 it('allows retry after network failure without interrupting viewing',async()=>{call.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(true);const {recordView}=await import('./viewTracking.js');await expect(recordView('photo')).resolves.toBeUndefined();await recordView('photo');expect(call).toHaveBeenCalledTimes(2);});
});
