import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
vi.mock('./config.js',async load=>({...await load(),VIDEO_UPLOADS:{'rcap-trunk-or-treat-2026':'https://www.dropbox.com/request/smaf7j5ulsrwua0ssdhc'}}));
import {UploadSheet} from './App.jsx';
it('routes Trunk videos to Dropbox even when dropped or pasted into the photo picker',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const video=new File(['video'],'family.mov',{type:'video/quicktime'});
 try{
  await act(async()=>root.render(<UploadSheet event={{slug:'rcap-trunk-or-treat-2026',title:'Trunk or Treat'}} profile={{display_name:'Family'}} initialFiles={[video]} onClose={()=>{}} onDone={()=>{}}/>));
  const sheet=document.querySelector('.sheet');
  expect(sheet.textContent).toContain('Photos here. Videos through Dropbox.');
  expect(sheet.textContent).not.toMatch(/50 MB|H.264/);
  const picker=sheet.querySelector('input[type=file]');
  expect(picker.accept).not.toContain('video');
  expect([...sheet.querySelectorAll('button')].find(b=>b.textContent.startsWith('Add photos')).disabled).toBe(true);
  expect(sheet.querySelector('a[href*="dropbox.com/request"]').target).toBe('_blank');
  Object.defineProperty(picker,'files',{configurable:true,value:[video]});
  await act(async()=>picker.dispatchEvent(new Event('change',{bubbles:true})));
  expect(sheet.textContent).toContain('Choose photos here. Use the Dropbox button for videos.');
 }finally{await act(async()=>root.unmount());host.remove();}
});
