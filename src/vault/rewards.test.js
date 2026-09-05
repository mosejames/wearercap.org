import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(()=>({rpc:vi.fn(),upload:vi.fn(),remove:vi.fn(),prepare:vi.fn()}));
vi.mock('./auth.js',()=>({supabase:{rpc:mocks.rpc,storage:{from:()=>({upload:mocks.upload,remove:mocks.remove})}}}));
vi.mock('./images.js',()=>({prepareImage:mocks.prepare}));
import { saveAvatar, monthNow } from './rewards.js';
beforeEach(()=>{vi.clearAllMocks();mocks.rpc.mockImplementation(async name=>({data:name==='vault_actor'?'owner':'owner/profile.jpg'}));mocks.upload.mockResolvedValue({});mocks.remove.mockResolvedValue({});mocks.prepare.mockResolvedValue({thumb:new Blob(['compressed'],{type:'image/jpeg'})});});
describe('optional profile photo',()=>{
 it('uploads the compressed JPEG, not the original, into the member’s single replaceable slot',async()=>{
 const file=new File(['original'],'headshot.png',{type:'image/png'});await saveAvatar(file);
 expect(mocks.prepare).toHaveBeenCalledWith(file);expect(mocks.upload.mock.calls[0][0]).toBe('owner/profile.jpg');expect(mocks.upload.mock.calls[0][1]).not.toBe(file);expect(mocks.upload.mock.calls[0][2]).toMatchObject({upsert:true,contentType:'image/jpeg'});
 expect(mocks.rpc).toHaveBeenCalledWith('vault_avatar',{p_remove:false});
 });
 it('does not publish a failed upload',async()=>{mocks.upload.mockResolvedValue({error:new Error('Offline')});await expect(saveAvatar(new File(['x'],'x.jpg'))).rejects.toThrow('Offline');expect(mocks.rpc).not.toHaveBeenCalledWith('vault_avatar',{p_remove:false});});
 it('removes the profile reference and the stored photo',async()=>{await saveAvatar(null,true);expect(mocks.remove).toHaveBeenCalledWith(['owner/profile.jpg']);expect(mocks.prepare).not.toHaveBeenCalled();});
 it('rejects oversized files before decoding or uploading',async()=>{await expect(saveAvatar({size:21*1024*1024})).rejects.toThrow('20 MB');expect(mocks.prepare).not.toHaveBeenCalled();});
 it('uses Eastern month boundaries',()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-01T03:30:00Z'));expect(monthNow()).toBe('2026-08');vi.useRealTimers();});
});
