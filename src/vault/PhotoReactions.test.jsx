import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('./auth.js',()=>({supabase:{rpc}}));
import PhotoReactions from './PhotoReactions.jsx';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,host;
const base={photo:{id:'photo-a',likes:7},owner:'parent',profile:{name:'Parent'},liked:true,onLove:vi.fn(),onNeedName:vi.fn()};
beforeEach(()=>{rpc.mockReset();rpc.mockResolvedValue({data:[],error:null});host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(()=>root.unmount());host.remove();});
const button=name=>host.querySelector(`[aria-label="${name}"]`);
const render=async(props={})=>act(async()=>root.render(<PhotoReactions {...base} {...props}/>));
it('offers the same five reactions while preserving existing hearts',async()=>{
 await render();expect([...host.querySelectorAll('.photo-reaction-options button')].map(b=>b.getAttribute('aria-label'))).toEqual(['Love','Celebrate','Thank you','Amazing','Bravo']);
 expect(button('Love').textContent).toContain('7');expect(button('Love').getAttribute('aria-pressed')).toBe('true');
 await act(async()=>button('Love').click());expect(base.onLove).toHaveBeenCalledWith(base.photo);
});
it('saves and undoes exact-photo reactions with confirmed counts and grid updates',async()=>{
 await render();const listener=vi.fn();window.addEventListener('vault-photo-reactions',listener);
 rpc.mockResolvedValueOnce({data:[{reaction:'celebrate',count:1,mine:true}],error:null});
 await act(async()=>button('Celebrate').click());expect(rpc).toHaveBeenLastCalledWith('vault_photo_reactions',{p_photo:'photo-a',p_action:'set',p_reaction:'celebrate',p_active:true});
 expect(button('Celebrate').getAttribute('aria-pressed')).toBe('true');expect(button('Celebrate').textContent).toContain('1');expect(listener.mock.calls[0][0].detail.photoId).toBe('photo-a');
 rpc.mockResolvedValueOnce({data:[],error:null});await act(async()=>button('Celebrate').click());expect(rpc.mock.calls.at(-1)[1].p_active).toBe(false);expect(button('Celebrate').getAttribute('aria-pressed')).toBe('false');window.removeEventListener('vault-photo-reactions',listener);
});
it('keeps a failed response available to retry without changing confirmed counts',async()=>{
 await render();rpc.mockResolvedValueOnce({data:null,error:{message:'Connection interrupted'}});await act(async()=>button('Amazing').click());expect(host.querySelector('[role=alert]').textContent).toContain('Connection interrupted');expect(button('Amazing').getAttribute('aria-pressed')).toBe('false');expect(button('Amazing').disabled).toBe(false);
});
it('asks guests to sign in without writing a reaction',async()=>{
 const signIn=vi.fn();await render({owner:null,profile:null,onNeedName:signIn});await act(async()=>button('Bravo').click());expect(signIn).toHaveBeenCalled();expect(rpc).toHaveBeenCalledTimes(1);
});
it('does not show the previous photo’s reactions while the next one loads',async()=>{
 rpc.mockResolvedValueOnce({data:[{reaction:'thanks',count:9,mine:true}],error:null});await render();let finish;rpc.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));await render({photo:{id:'photo-b',likes:0}});expect(button('Thank you').disabled).toBe(true);expect(button('Thank you').textContent).not.toContain('9');await act(async()=>finish({data:[],error:null}));expect(button('Thank you').getAttribute('aria-pressed')).toBe('false');
});

it('uses event-specific reactions in both Trunk or Treat galleries',async()=>{
 for(const eventSlug of ['rcap-trunk-or-treat-2026','rcap-trunk-or-treat-photo-booth']){
  await render({eventSlug});expect([...host.querySelectorAll('.photo-reaction-options button')].map(b=>b.getAttribute('aria-label'))).toEqual(['Love','Spooky','Great costume','So much fun','Thank you']);
 }
 rpc.mockResolvedValueOnce({data:[{reaction:'spooky',count:1,mine:true}],error:null});await act(async()=>button('Spooky').click());expect(rpc.mock.calls.at(-1)[1].p_reaction).toBe('spooky');expect(button('Spooky').getAttribute('aria-pressed')).toBe('true');
});
