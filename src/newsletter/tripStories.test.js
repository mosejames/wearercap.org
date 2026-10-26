import {describe,it,expect,vi} from 'vitest';
import {tripSubmission,submitTripStory,TRIPS} from './tripStories.js';
import {cleanSubmission} from '../../server/newsletter-intake.js';
const values={trip:'Savannah',comment:'We loved seeing our child grow in confidence.',name:'A parent',email:'parent@example.com',permission:'on'};
describe('parent trip stories',()=>{
 it('accepts every trip, records the parent perspective and permission to use the supplied name',()=>{
  expect(TRIPS).toEqual(['London','New York','Savannah']);
  for(const trip of TRIPS){const payload=tripSubmission({...values,trip});expect(cleanSubmission(payload)).toMatchObject({title:`${trip}: a parent’s perspective`,category:'Photos or recap',relationship:'Parent or family member'});expect(payload.details).toContain('Parent name as supplied.');}
 });
 it('requires a real trip selection, words and permission',()=>{
  expect(()=>tripSubmission({...values,trip:'Other'})).toThrow();expect(()=>tripSubmission({...values,comment:''})).toThrow();expect(()=>tripSubmission({...values,permission:''})).toThrow();expect(()=>tripSubmission({...values,comment:'x'.repeat(1501)})).toThrow();
 });
 it('submits words without making a photo mandatory',async()=>{
  const call=vi.fn().mockResolvedValue({ok:true});await submitTripStory(tripSubmission(values),null,{call});expect(call).toHaveBeenCalledWith('submit',expect.objectContaining({attachmentIndices:[],permission:'on'}));
 });
 it('does not submit a story or report success when the photo upload fails',async()=>{
  const call=vi.fn().mockResolvedValueOnce({token:'upload-token'}).mockRejectedValueOnce(Error('Photo upload failed'));
  await expect(submitTripStory(tripSubmission(values),{}, {call,prepare:async()=>({web:{size:100}}),encode:async()=>'photo'})).rejects.toThrow('Photo upload failed');expect(call.mock.calls.map(c=>c[0])).toEqual(['uploadSession','uploadAttachment']);
 });
 it('finalizes the private photo and permission only after upload succeeds',async()=>{
  const call=vi.fn().mockResolvedValueOnce({token:'upload-token'}).mockResolvedValueOnce({index:0}).mockResolvedValueOnce({ok:true});
  await submitTripStory(tripSubmission(values),{}, {call,prepare:async()=>({web:{size:100}}),encode:async()=>'photo'});
  expect(call.mock.calls.map(c=>c[0])).toEqual(['uploadSession','uploadAttachment','submit']);expect(call.mock.calls[2][1]).toMatchObject({token:'upload-token',attachmentIndices:[0],permission:'on'});
 });
 it('requires a confirmed server save before showing success',async()=>{
  await expect(submitTripStory(tripSubmission(values),null,{call:async()=>({})})).rejects.toThrow('could not confirm');
 });
});
