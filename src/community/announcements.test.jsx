import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {describe,it,expect,vi} from 'vitest';
import content from './content.json';
import Announcements from './Announcements.jsx';
import {CommunityProvider} from './CommunityContent.jsx';
import {activeAnnouncements,publicContent,validateContent} from './model.js';
import {communityContent} from '../../scripts/community-content-plugin.mjs';
import {resolve} from 'node:path';
const clone=()=>structuredClone(content);
const ids=(node,scope)=>[...node.querySelectorAll(scope+' [data-announcement]')].map(e=>e.dataset.announcement).sort();
describe('Shared promotions and announcements',()=>{
 it('uses inclusive start and exclusive end times, excluding drafts and archived records',()=>{
  const data=clone(),sample=data.announcements.find(item=>item.placement==='card');
  data.announcements=[{...sample,id:'scheduled',startsAt:'2026-11-05T15:00:00-05:00',endsAt:'2026-11-05T16:00:00-05:00'}, {...sample,id:'draft',status:'draft'}, {...sample,id:'archived',status:'archived'}];
  expect(activeAnnouncements(data,new Date('2026-11-05T19:59:59Z'))).toEqual([]);
  expect(activeAnnouncements(data,new Date('2026-11-05T20:00:00Z')).map(a=>a.id)).toEqual(['scheduled']);
  expect(activeAnnouncements(data,new Date('2026-11-05T21:00:00Z'))).toEqual([]);
 });
 it('removes the past raffle promotion and keeps all three current homepage cards',()=>{
  const items=activeAnnouncements(content,new Date('2026-11-05T20:00:00Z'));
  expect(items.map(a=>a.id)).toEqual(['trunk-or-treat-survey','trunk-or-treat-photos','fall-raffle-results']);
 });
 it('validates links and rejects ambiguous or backwards schedules before publication',()=>{
  const invalid=clone();invalid.announcements[0].startsAt='2026-11-05T15:00:00';expect(()=>validateContent(invalid)).toThrow(/time zone/);
  invalid.announcements[0].startsAt='2026-11-06T15:00:00-05:00';expect(()=>validateContent(invalid)).toThrow(/end after/);
  const unsafe=clone();unsafe.announcements[1].href='javascript:alert(1)';expect(()=>validateContent(unsafe)).toThrow(/link/);
 });
 it('omits draft and archived copy from the public JSON and compiled source',()=>{
  const data=clone();const sample=data.announcements[1];
  data.announcements.push({...sample,id:'private-draft',status:'draft',title:'UNPUBLISHED_MARKER'}, {...sample,id:'old-archived',status:'archived',title:'ARCHIVED_MARKER'});
  expect(JSON.stringify(publicContent(data))).not.toContain('UNPUBLISHED_MARKER');
  const transformed=communityContent({sourceFile:resolve('src/community/content.json')}).transform(JSON.stringify(data),resolve('src/community/content.json')).code;
  expect(transformed).not.toContain('UNPUBLISHED_MARKER');expect(transformed).not.toContain('ARCHIVED_MARKER');
 });
 it('shows the same announcements in both views, schedules them automatically, and archives them after a single shared update',async()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-05T20:00:00Z'));globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  let payload=clone();payload.announcements.push({...payload.announcements[1],id:'scheduled-card',title:'Scheduled community note',startsAt:'2026-11-05T20:01:00Z',endsAt:'2026-11-05T20:02:00Z'});
  const fetchMock=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>({ok:true,json:async()=>payload}));
  const node=document.createElement('div');document.body.append(node);const root=createRoot(node);
  try{
   await act(async()=>{root.render(<CommunityProvider><div id="website"><Announcements view="main" placement="featured"/><Announcements view="main" placement="card"/></div><div id="app"><Announcements/></div></CommunityProvider>);});
   expect(ids(node,'#website')).toEqual(ids(node,'#app'));expect(ids(node,'#app')).not.toContain('scheduled-card');
   await act(async()=>{vi.advanceTimersByTime(60000);});
   expect(ids(node,'#app')).toContain('scheduled-card');expect(ids(node,'#website')).toEqual(ids(node,'#app'));
   await act(async()=>{vi.advanceTimersByTime(60000);});expect(ids(node,'#app')).not.toContain('scheduled-card');
   payload=structuredClone(payload);payload.announcements.find(a=>a.id==='trunk-or-treat-survey').status='archived';
   await act(async()=>{window.dispatchEvent(new Event('focus'));});
   expect(ids(node,'#app')).not.toContain('trunk-or-treat-survey');expect(ids(node,'#website')).toEqual(ids(node,'#app'));
  }finally{await act(async()=>root.unmount());node.remove();fetchMock.mockRestore();vi.useRealTimers();globalThis.IS_REACT_ACT_ENVIRONMENT=false;}
 });
});
