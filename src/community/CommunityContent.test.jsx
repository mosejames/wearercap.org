import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import initial from './content.json';
import {CommunityProvider,useCommunityContent} from './CommunityContent.jsx';
function View({name}) {const content=useCommunityContent();return <p data-view={name}>{content.homepage.eventsIntro}</p>;}
it('refreshes both consumer views from one public feed and retains good content on a bad response',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 let payload=structuredClone(initial);payload.homepage.eventsIntro='One update, both views';
 const fetchMock=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>({ok:true,json:async()=>payload}));
 const node=document.createElement('div');document.body.append(node);const root=createRoot(node);
 try {
  await act(async()=>{root.render(<CommunityProvider><View name="website"/><View name="app"/></CommunityProvider>);});
  expect([...node.querySelectorAll('p')].map(p=>p.textContent)).toEqual(['One update, both views','One update, both views']);
  expect(fetchMock).toHaveBeenCalledTimes(1);expect(fetchMock.mock.calls[0][1].cache).toBe('no-store');
  payload=structuredClone(initial);payload.homepage.eventsIntro='Published revision';
  await act(async()=>{window.dispatchEvent(new Event('focus'));});
  expect(node.querySelector('[data-view="website"]').textContent).toBe('Published revision');
  expect(node.querySelector('[data-view="app"]').textContent).toBe('Published revision');
  payload={schemaVersion:99};await act(async()=>{window.dispatchEvent(new Event('focus'));});
  expect(node.querySelector('p').textContent).toBe('Published revision');
 } finally {await act(async()=>root.unmount());node.remove();fetchMock.mockRestore();globalThis.IS_REACT_ACT_ENVIRONMENT=false;}
});
