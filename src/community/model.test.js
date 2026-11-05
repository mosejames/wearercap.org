import {describe,it,expect} from 'vitest';
import content from './content.json';
import {validateContent,publicTools,upcomingItems,homepageTools,dateCard} from './model.js';
import {readInstallPreference,saveInstallPreference,INSTALL_NUDGE_KEY} from '../app/installPreference.js';
const clone=()=>structuredClone(content);
describe('Shared main website and app content',()=>{
 it('validates the actual published registry',()=>expect(validateContent(content)).toBe(content));
 it('shows a newly added public tool in the app directory without a second registration',()=>{
  const next=clone();next.tools.push({id:'new-public-tool',title:'New tool',detail:'For families.',href:'/new-tool/',group:'resources',icon:'BookOpen',color:'blue',homepage:{order:7,body:'New tool description'}});
  validateContent(next);
  expect(publicTools(next).find(t=>t.id==='new-public-tool').href).toBe('/new-tool/');
  expect(homepageTools(next).find(t=>t.id==='new-public-tool').href).toBe('/new-tool/');
  expect(publicTools(next).some(t=>t.id==='recap')).toBe(false);
 });
 it('uses the same edited event for Next up and homepage date cards and expires it automatically',()=>{
  const next=clone();next.events.push({start:'2026-11-07',end:'2026-11-07',title:'New RCAP event',href:'/events/new/'});
  const event=upcomingItems(next,'2026-11-07')[0];
  expect(event.title).toBe('New RCAP event');expect(dateCard(event).label).toBe(event.title);
  expect(upcomingItems(next,'2026-11-08').some(e=>e.title==='New RCAP event')).toBe(false);
 });
 it('rejects broken destinations, duplicate tools, missing core tools and invalid date ranges before release',()=>{
  const unsafe=clone();unsafe.tools[0].href='javascript:alert(1)';expect(()=>validateContent(unsafe)).toThrow();
  const duplicate=clone();duplicate.tools.push(duplicate.tools[0]);expect(()=>validateContent(duplicate)).toThrow();
  const missing=clone();missing.tools=missing.tools.filter(t=>t.id!=='calendar');expect(()=>validateContent(missing)).toThrow();
  const bad=clone();bad.events.push({start:'2026-02-30',end:'2026-03-01',title:'Invalid'});expect(()=>validateContent(bad)).toThrow();
 });
 it('merges editorial links into an existing calendar event without showing it twice',()=>{
  const next=clone();const existing=next.calendar.dates.find(e=>e.kind==='exp');next.events.push({...existing,href:'/invite/',cta:'Help at EXP'});
  const matches=upcomingItems(next,'2026-11-05').filter(e=>e.start===existing.start&&e.title===existing.title);
  expect(matches).toHaveLength(1);expect(matches[0].cta).toBe('Help at EXP');
 });
 it('labels multi-month homepage cards accurately',()=>{
  expect(dateCard({start:'2026-12-21',end:'2027-01-05',title:'Break'})).toMatchObject({month:'Dec–Jan',year:'2026–2027',day:'21–5'});
 });
});
describe('Home screen setup preference',()=>{
 it('persists dismissal and viewed instructions across visits',()=>{
  localStorage.clear();expect(readInstallPreference(localStorage)).toBe(false);
  saveInstallPreference(localStorage,'seen');expect(readInstallPreference(localStorage)).toBe(true);
  expect(localStorage.getItem(INSTALL_NUDGE_KEY)).toBe('seen');
  saveInstallPreference(localStorage,'confirmed');expect(readInstallPreference(localStorage)).toBe(true);
 });
 it('keeps the app usable when the browser blocks local storage',()=>{
  const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
  expect(readInstallPreference(blocked)).toBe(false);expect(saveInstallPreference(blocked)).toBe(false);
 });
});
