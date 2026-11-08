import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('./data.js',()=>({browserToken:()=> 'a'.repeat(64),request:vi.fn()}));
import Conversation from './Conversation.jsx';
import {request} from './data.js';
let host,root;
const state=(count=0,mine=false)=>({reactions:[{kind:'thanks',count,mine}],comments:[]});
const render=async id=>{await act(async()=>root.render(<Conversation slug="washington-dc-2030" photo={{id}}/>));};
const thanks=()=>host.querySelector('button[aria-label="Thank you"]');
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;request.mockReset().mockResolvedValue(state());host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
it('saves and undoes a reaction with server-confirmed counts',async()=>{await render('a');request.mockResolvedValueOnce(state(1,true));await act(async()=>thanks().click());expect(thanks().getAttribute('aria-pressed')).toBe('true');expect(thanks().textContent).toContain('1');expect(request).toHaveBeenLastCalledWith('washington-dc-2030','conversation',expect.objectContaining({id:'a',operation:'react',active:true}));request.mockResolvedValueOnce(state());await act(async()=>thanks().click());expect(thanks().getAttribute('aria-pressed')).toBe('false');expect(request).toHaveBeenLastCalledWith('washington-dc-2030','conversation',expect.objectContaining({active:false}));});
it('does not show a previous photo’s reactions while the next photo loads',async()=>{request.mockResolvedValueOnce(state(8,true));await render('a');let finish;request.mockReturnValueOnce(new Promise(r=>{finish=r;}));await render('b');expect(thanks().disabled).toBe(true);expect(thanks().getAttribute('aria-pressed')).toBe('false');expect(thanks().textContent).not.toContain('8');await act(async()=>finish(state(2,false)));expect(thanks().disabled).toBe(false);expect(thanks().textContent).toContain('2');});
it('keeps the confirmed reaction after a failed write so a family can retry',async()=>{await render('a');request.mockRejectedValueOnce(Error('Connection interrupted. Try again.'));await act(async()=>thanks().click());expect(host.querySelector('[role=alert]').textContent).toContain('Connection interrupted');expect(thanks().getAttribute('aria-pressed')).toBe('false');expect(thanks().disabled).toBe(false);});
it('allows retry after the initial conversation read fails',async()=>{request.mockRejectedValueOnce(Error('Unavailable'));await render('a');expect(thanks().disabled).toBe(true);request.mockResolvedValueOnce(state(3));await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Try again').click());expect(thanks().disabled).toBe(false);expect(thanks().textContent).toContain('3');});
it('keeps a failed comment draft and confirms a successful retry',async()=>{
 await render('a');
 const form=host.querySelector('.engine-comment-form');
 expect(form.querySelector('summary').textContent).toBe('Leave a comment');
 function enter(field,value){
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field),'value').set.call(field,value);
  field.dispatchEvent(new Event('input',{bubbles:true}));
 }
 await act(async()=>{enter(form.querySelector('input'),'Trip family');enter(form.querySelector('textarea'),'Thank you!');});
 request.mockRejectedValueOnce(Error('Please try again.'));
 await act(async()=>form.requestSubmit());
 expect(form.querySelector('[role=alert]').textContent).toBe('Please try again.');
 expect(form.querySelector('textarea').value).toBe('Thank you!');
 request.mockResolvedValueOnce({...state(),comments:[{id:'c',name:'Trip family',body:'Thank you!'}]});
 await act(async()=>form.requestSubmit());
 expect(form.querySelector('[role=status]').textContent).toBe('Comment posted.');
 expect(form.querySelector('textarea').value).toBe('');
 expect(host.querySelector('article').textContent).toContain('Thank you!');
});
