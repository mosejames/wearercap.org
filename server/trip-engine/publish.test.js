// @vitest-environment node
import {beforeEach,expect,it,vi} from 'vitest';
vi.mock('./rpc.js',()=>({engineRpc:vi.fn()}));
import {engineRpc} from './rpc.js';
import {publicConfig,publishAction} from './publish.js';
import {initialRegistry,newDraft} from '../../src/trip-studio/model.js';
const req={headers:{authorization:'Bearer operator'}};
function complete(){return {...newDraft('11111111-1111-1111-1111-111111111111','Verification trip'),cohort:'2035',start:'2030-01-01',end:'2030-01-02',timezone:'America/New_York',slug:'verification-trip',logo:'data:image/png;base64,AAAA'};}
beforeEach(()=>engineRpc.mockReset().mockResolvedValue([]));
it('blocks DC before publication if its cohort or dates are missing',()=>{expect(()=>publicConfig(initialRegistry().trips[0])).toThrow(/Class year, Trip dates/);});
it('requires a saved revision and publishes only a normalized snapshot',async()=>{const d=complete();const registry={revision:3,trips:[d]};await expect(publishAction(req,{action:'publish',id:d.id,revision:2},registry)).rejects.toMatchObject({status:409});await publishAction(req,{action:'publish',id:d.id,revision:3,version:0},registry);const call=engineRpc.mock.calls.find(c=>c[0]==='publish');expect(call[1]).toMatchObject({draftId:d.id,version:0,config:{destination:'Verification trip',cohort:'2035'}});expect(call[1].config.status).toBeUndefined();expect(registry.trips[0].visibility).toBe('private');});
it('cannot launch another trip by supplying an arbitrary id',async()=>{await expect(publishAction(req,{action:'publish',id:'nyc-2026',revision:0},initialRegistry())).rejects.toMatchObject({status:404});expect(engineRpc).not.toHaveBeenCalled();});
it('changes the requested live version rather than changing private draft values',async()=>{const d=complete();engineRpc.mockResolvedValueOnce([{draftId:d.id,slug:d.slug,version:8}]);await publishAction(req,{action:'phase',id:d.id,phase:'Archive',version:8},{revision:2,trips:[d]});expect(engineRpc).toHaveBeenLastCalledWith('phase',{slug:d.slug,version:8,phase:'Archive'},'Bearer operator');expect(d.status).toBe('draft');});
