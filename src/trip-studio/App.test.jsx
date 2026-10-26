import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {initialRegistry} from './model.js';
vi.mock('./client.js',()=>({authClient:vi.fn(),callStudio:vi.fn()}));
vi.mock('./images.js',()=>({shareImage:vi.fn(async()=> 'data:image/png;base64,AAAA'),prepareBrandImage:vi.fn(),downloadFile:vi.fn()}));
import {authClient,callStudio} from './client.js';
import App from './App.jsx';
import {prepareBrandImage} from './images.js';
let root,host;
const button=text=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes(text));
async function click(text){await act(async()=>button(text).click());}
async function fill(input,value){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}
beforeEach(()=>{globalThis.IS_REACT_ACT_ENVIRONMENT=true;authClient.mockReturnValue({auth:{getSession:vi.fn(async()=>({data:{session:{access_token:'admin'}}})),onAuthStateChange:()=>({data:{subscription:{unsubscribe:vi.fn()}}}),signOut:vi.fn(async()=>({}))}});callStudio.mockImplementation(async(method,body)=>({registry:method==='POST'?{revision:1,trips:[{...body.draft,updatedAt:'2026-10-26T16:00:00Z'}]}:initialRegistry(),me:{email:'operator@example.org'}}));host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.clearAllMocks();});
it('lists DC as a private draft and keeps existing trips as read-only references',async()=>{await act(async()=>root.render(<App/>));expect(host.textContent).toContain('Washington, DC');expect(host.textContent).toContain('Cohort not set');expect(host.querySelectorAll('.studio-reference')).toHaveLength(2);expect(host.querySelectorAll('.studio-reference button')).toHaveLength(0);expect(callStudio).toHaveBeenCalledWith(undefined,undefined);});
it('saves real draft settings with the current revision and blank DC dates',async()=>{await act(async()=>root.render(<App/>));await click('Continue setup');const destination=host.querySelector('input[placeholder="Where are they headed?"]');await fill(destination,'Washington, DC Trip');await click('Save draft');const payload=callStudio.mock.calls.find(c=>c[0]==='POST')[1];expect(payload).toMatchObject({action:'save',revision:0,draft:{destination:'Washington, DC Trip',cohort:'',start:'',end:'',status:'draft',visibility:'private'}});expect(host.textContent).toContain('Private draft saved.');});
it('previews phases and messages without saving or publishing a phase',async()=>{await act(async()=>root.render(<App/>));await click('Continue setup');await click('Phases & messages');await click('Active trip');expect(host.textContent).toContain('Preview only · still a private draft');expect(host.querySelector('textarea').value).toContain('[trip link available after launch]');expect(callStudio.mock.calls.filter(c=>c[0]==='POST')).toHaveLength(0);});
it('allows one-tap batch switching and omits a scholar-name field in regular preview intake',async()=>{await act(async()=>root.render(<App/>));await click('Continue setup');await click('Family experience');await click('Preview photo intake');await click('Group AA');expect(button('Group AA').getAttribute('aria-pressed')).toBe('true');expect(host.querySelector('.studio-preview-intake').textContent).not.toContain('Scholar');expect(host.querySelector('input[autocomplete="off"]')).not.toBeNull();});
it('keeps unsaved settings visible when a concurrent save is rejected',async()=>{await act(async()=>root.render(<App/>));await click('Continue setup');await fill(host.querySelector('input[placeholder="Where are they headed?"]'),'Changed DC');callStudio.mockRejectedValueOnce(Error('Another save arrived first. Reload saved drafts before trying again.'));await click('Save draft');expect(host.querySelector('[role="alert"]').textContent).toContain('Another save');expect(host.querySelector('input[placeholder="Where are they headed?"]').value).toBe('Changed DC');expect(button('Save draft').disabled).toBe(false);});
it('never displays drafts when server access is denied',async()=>{callStudio.mockRejectedValue(Error('This account does not have Trip Studio access.'));await act(async()=>root.render(<App/>));expect(host.textContent).not.toContain('Washington, DC');expect(host.querySelector('[role="alert"]').textContent).toContain('does not have Trip Studio access');});

it('does not save before a selected branding image finishes preparing',async()=>{
  let finish;prepareBrandImage.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
  await act(async()=>root.render(<App/>));await click('Continue setup');await click('Brand & sharing');
  const input=host.querySelector('input[aria-label="Choose logo"]');
  Object.defineProperty(input,'files',{value:[new File(['image'],'logo.png',{type:'image/png'})],configurable:true});
  await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));
  expect(button('Preparing image…').disabled).toBe(true);
  await act(async()=>finish('data:image/png;base64,AAAA'));
  expect(button('Save draft').disabled).toBe(false);
  await click('Save draft');expect(callStudio.mock.calls.find(c=>c[0]==='POST')[1].draft.logo).toBe('data:image/png;base64,AAAA');
});
