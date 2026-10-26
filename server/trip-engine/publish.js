import {cleanDraft,problem} from '../trip-studio/model.js';
import {readiness} from '../../src/trip-studio/model.js';
import {engineRpc} from './rpc.js';
export function publicConfig(draft){const d=cleanDraft(draft);const missing=readiness(d);if(missing.length)throw problem(`Complete these before launch: ${missing.join(', ')}.`);return Object.fromEntries(['destination','cohort','start','end','timezone','slug','colors','logo','hero','features','groups','milestones','videoUploadUrl','videoDownloadUrl','exportDays','recipientBinding'].map(k=>[k,d[k]]));}
export async function liveList(req){return engineRpc('list',{},req.headers.authorization);}
export async function publishAction(req,body,registry){
 const draft=registry.trips.find(t=>t.id===body.id);if(!draft)throw problem('Save this draft before launching it.',404);
 const live=(await liveList(req)).find(t=>t.draftId===draft.id);
 if(body.action==='publish'){
  if(registry.revision!==body.revision)throw problem('Your saved draft changed. Reload before launching.',409);
  const config=publicConfig(draft);
  return engineRpc('publish',{draftId:draft.id,config,version:body.version??0},req.headers.authorization);
 }
 if(!live)throw problem('This trip has not been launched.',404);
 if(!['phase','unpublish'].includes(body.action))throw problem('Unknown launch action.');
 return engineRpc(body.action,{slug:live.slug,version:body.version,phase:body.phase},req.headers.authorization);
}
