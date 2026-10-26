import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import LaunchPanel from './LaunchPanel.jsx';
import {initialRegistry,newDraft} from './model.js';
let root,host;const request=vi.fn(),onResult=vi.fn(),onError=vi.fn(),onBusy=vi.fn();
const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent===text);
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;host=document.createElement('div');document.body.append(host);root=createRoot(host);request.mockResolvedValue({registry:{revision:2,trips:[]}});});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.clearAllMocks();});
function render(props={}){return act(async()=>root.render(<LaunchPanel draft={initialRegistry().trips[0]} revision={1} request={request} onResult={onResult} onError={onError} onBusy={onBusy} {...props}/>));}
it('keeps DC private with an explicit missing-details checklist',async()=>{await render();expect(host.textContent).toContain('Class year');expect(host.textContent).toContain('Trip dates');expect(button('Launch trip').disabled).toBe(true);expect(request).not.toHaveBeenCalled();});
it('requires a saved complete configuration and a deliberate launch review',async()=>{const draft={...newDraft('11111111-1111-1111-1111-111111111111','Verification trip'),cohort:'2035',start:'2030-01-01',end:'2030-01-02',timezone:'America/New_York',slug:'verification-trip',logo:'data:image/png;base64,AAAA'};await render({draft});expect(button('Launch trip').disabled).toBe(true);await act(async()=>host.querySelector('input[type=checkbox]').click());await act(async()=>button('Launch trip').click());expect(request).toHaveBeenCalledWith('POST',{action:'publish',id:draft.id,revision:1,version:0});expect(onResult).toHaveBeenCalled();});
it('does not expose launching in a local workspace even for complete drafts',async()=>{await render({local:true});expect(button('Launch trip').disabled).toBe(true);expect(host.textContent).toContain('Local drafts cannot publish');});
it('separates phase previews from applying a live phase',async()=>{await render({live:{published:true,slug:'verification-trip',phase:'Active trip',version:4,count:0}});await act(async()=>button('Archive').click());expect(request).not.toHaveBeenCalled();await act(async()=>button('Apply archive phase').click());expect(request).toHaveBeenLastCalledWith('POST',expect.objectContaining({action:'phase',phase:'Archive',version:4}));});
