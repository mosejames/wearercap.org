// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {MemoryStrip} from './App.jsx';
it('renders decoded scrolling photos without gallery selection state',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 vi.stubGlobal('Image',class {naturalWidth=600;naturalHeight=900;decode(){return Promise.resolve();}});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 try {
  await act(async()=>{root.render(<MemoryStrip recent={[{id:'photo',eventId:'event',contentType:'image/jpeg',thumbKey:'thumb.jpg'}]} covers={new Map()} events={[{id:'event',slug:'test',title:'Test gallery'}]}/>);});
  expect(host.querySelector('[aria-label="Moments from our galleries"]')).not.toBeNull();
  expect(host.querySelector('a').getAttribute('href')).toBe('#/e/test/p/photo');
  expect(host.querySelector('.selection-check')).toBeNull();
 } finally {await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
