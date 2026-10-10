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
