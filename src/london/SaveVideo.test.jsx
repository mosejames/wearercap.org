import React,{StrictMode,act} from 'react';import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';import {File,Blob} from 'node:buffer';
import SaveVideo from './SaveVideo.jsx';
it('prepares the opened clip and invokes native file saving immediately from the tap, including StrictMode remounts',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;vi.stubGlobal('File',File);const blob=new Blob([new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109,0,0,0,0])]);
 const share=vi.fn(async()=>{});vi.stubGlobal('navigator',{canShare:()=>true,share});const fetcher=vi.fn(async()=>({ok:true,headers:new Headers({'Content-Type':'video/mp4'}),blob:async()=>blob}));vi.stubGlobal('fetch',fetcher);
 const host=document.createElement('div'),root=createRoot(host);document.body.append(host);
 try{
  await act(async()=>{root.render(<StrictMode><SaveVideo id="clip" url="https://media.example/playback.mp4"/></StrictMode>);});
  expect(host.querySelector('button').textContent).toBe('Save video');expect(host.querySelector('a')).toBeNull();
  await act(async()=>{host.querySelector('button').click();expect(share).toHaveBeenCalledOnce();});
  const data=share.mock.calls[0][0];expect(data.url).toBeUndefined();expect(data.files[0].type).toBe('video/mp4');expect(data.files[0].size).toBe(blob.size);expect(data.files[0].name).toBe('london-2028-clip.mp4');
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
