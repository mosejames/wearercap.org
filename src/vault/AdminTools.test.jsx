// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
vi.mock('./rewards.js',()=>({rewardCall:vi.fn(async()=>[{id:'owner',name:'Owner Name',role:'owner'},{id:'mod',name:'Moderator Name',role:'moderator'},...Array.from({length:30},(_,i)=>({id:`p${i}`,name:`Parent ${i}`,role:null}))])}));
import {StaffPanel} from './AdminTools.jsx';
it('keeps contributors out of Team and paginates the member directory',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try{
  await act(async()=>root.render(<StaffPanel/>));
  expect(host.querySelectorAll('.staff-row')).toHaveLength(2);
  expect(host.textContent).not.toContain('Parent 0');
  await act(async()=>root.render(<StaffPanel key="directory" directory/>));
  expect(host.querySelectorAll('.staff-row')).toHaveLength(25);
  const next=[...host.querySelectorAll('button')].find(b=>b.textContent==='Next');
  await act(async()=>next.click());
  expect(host.querySelectorAll('.staff-row')).toHaveLength(7);
 }finally{await act(async()=>root.unmount());host.remove();}
});
