import {it,expect,vi} from 'vitest';
import {sendCode,supabase} from '../vault/auth.js';
it('uses existing-account-only OTP for reveal while preserving other vault defaults',async()=>{const send=vi.spyOn(supabase.auth,'signInWithOtp').mockResolvedValue({error:null});try{await sendCode('5550001234',{shouldCreateUser:false});expect(send).toHaveBeenLastCalledWith({phone:'+15550001234',options:{channel:'sms',shouldCreateUser:false}});await sendCode('5550001234');expect(send).toHaveBeenLastCalledWith({phone:'+15550001234',options:{channel:'sms'}});}finally{send.mockRestore();}});
