// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi,afterEach} from 'vitest';
import {QUESTIONS} from './data.js';
const mock=vi.hoisted(()=>({call:vi.fn(),sync:vi.fn(),session:{user:{id:'member',email:'member@example.com'}},record:null}));
vi.mock('./api.js',()=>({call:mock.call,syncDrive:mock.sync,supabase:{auth:{getSession:async()=>({data:{session:mock.session}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}}}));
import App from './App.jsx';
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
it.each([false,true])('saves before navigation and limits the committee switcher to admins (admin=%s)',async(isAdmin)=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const storage=new Map();vi.stubGlobal('localStorage',{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)});
 mock.record={committee:{id:'marcom',name:'Marketing',folder_id:'folder',doc_id:'doc',record_id:'record'},role:'member',is_admin:isAdmin,entries:[],comments:[],questions:[],actions:[]};
 mock.sync.mockResolvedValue({synced_at:'2026-10-09T18:00:00Z'});
 mock.call.mockImplementation(async(action,payload)=>{if(action==='memberships')return [{id:'marcom',name:'Marketing'}];if(action==='load')return structuredClone(mock.record);if(action==='save'){mock.record.entries=[{...payload,id:'entry',author_id:'member',updated_at:'2026-10-09T18:00:00Z',created_at:'2026-10-09T18:00:00Z'}];return {id:'entry'};}throw Error(action);});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const input=async(el,value)=>act(async()=>{Object.getOwnPropertyDescriptor(el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});
 try{
  await act(async()=>{root.render(<App/>);});
  expect(host.querySelector('h1').textContent).toBe(QUESTIONS[0].title);
  expect(Boolean(host.querySelector('select#committee'))).toBe(isAdmin);
  await input(host.querySelector('input[autocomplete="name"]'),'Member');
  await input(host.querySelector('#your-thought'),'Leave a clear message for the next team.');
  await act(async()=>{[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Save & keep going')).click();});
  expect(mock.call).toHaveBeenCalledWith('save',expect.objectContaining({content:'Leave a clear message for the next team.',committee:'marcom',question_id:QUESTIONS[0].id}));
  expect(host.querySelector('h1').textContent).toBe(QUESTIONS[1].title);
  expect(mock.sync).toHaveBeenCalledWith('marcom');
  await act(async()=>{[...host.querySelectorAll('button')].find(b=>b.textContent==='Previous question').click();});
  expect(host.querySelector('#your-thought').value).toBe('Leave a clear message for the next team.');
  expect(host.querySelector('.pb-entry-text').textContent).toContain('Leave a clear message');
 }finally{await act(async()=>root.unmount());host.remove();}
});

it('shows chairs an invite button and labels contributions and replies with their authors',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const storage=new Map();vi.stubGlobal('localStorage',{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)});
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 mock.record={committee:{id:'marcom',name:'Marketing',folder_id:'folder',doc_id:'doc'},role:'lead',is_admin:false,entries:[{id:'peer-entry',question_id:QUESTIONS[0].id,question_text:QUESTIONS[0].title,section:'purpose',author_id:'peer',author_name:'Jordan Smith',content:'A shared perspective.',kind:'insight',created_at:'2026-10-10',updated_at:'2026-10-10'}],comments:[{id:'reply',entry_id:'peer-entry',author_name:'Casey Jones',content:'Building on Jordan’s idea.',created_at:'2026-10-10'}],questions:[],actions:[]};
 mock.call.mockImplementation(async(action)=>{if(action==='memberships')return [{id:'marcom',name:'Marketing'}];if(action==='load')return structuredClone(mock.record);if(action==='add_member')return {ok:true};throw Error(action);});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{await act(async()=>{root.render(<App/>);});
 expect(host.querySelector('select#committee')).toBeNull();
 expect(host.querySelector('.pb-person b').textContent).toBe('Jordan Smith');
 await act(async()=>{[...host.querySelectorAll('button')].find(b=>b.textContent.includes('1 reply')).click();});
 expect(host.querySelector('.pb-reply b').textContent).toBe('Casey Jones');
 await act(async()=>{[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Invite contributors')).click();});
 const el=host.querySelector('dialog input[type="email"]');
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'guest@example.com');el.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>{host.querySelector('dialog form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
 expect(mock.call).toHaveBeenCalledWith('add_member',{committee:'marcom',email:'guest@example.com',role:'member'});
 expect(host.querySelector('dialog textarea').value).toContain('committee=marcom');
 expect(host.querySelector('dialog').textContent).toContain('The invitation has not been sent.');
 }finally{await act(async()=>root.unmount());host.remove();}
});
