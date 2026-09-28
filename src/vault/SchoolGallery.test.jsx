// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
vi.mock('./config.js', async importOriginal => ({ ...await importOriginal(), IS_SCHOOL: true }));
vi.mock('./data.js', async importOriginal => ({
  ...await importOriginal(),
  listPhotos: vi.fn(async () => [
    {id:'first', owner:'a', uploaderName:'First family', width:600, height:900, likes:2, thumbKey:'one.jpg'},
    {id:'favorite', owner:'b', uploaderName:'Favorite family', width:900, height:600, likes:8, thumbKey:'two.jpg'},
    {id:'hidden', hidden:true, likes:99, thumbKey:'hidden.jpg'},
  ]),
  myLikes: async () => new Set(), commentCounts: async () => new Map(),
  houseBoard: async () => [{house:'amistad',photos:2,families:1}],
}));
vi.mock('./rewards.js', async importOriginal => ({
  ...await importOriginal(),
  rewardCall: vi.fn(async () => [
    {owner:'engaged',display_name:'Many likes',uploads:0,score:100},
    {owner:'small',display_name:'Small batch',uploads:1,score:90},
    {owner:'large',display_name:'Large batch',uploads:12,score:60},
    {owner:'tied',display_name:'Tied batch',uploads:12,score:60},
  ]),
}));
import { rewardCall } from './rewards.js';
import { SchoolGallery } from './App.jsx';
import { listPhotos } from './data.js';
it('opens the event gallery first and keeps house standings and ranked photos behind the leaderboard', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host=document.createElement('div'); document.body.append(host); const root=createRoot(host);
  const onAdd=vi.fn();
  const event={id:'bingo',slug:'bingo-night',title:'Bingo Night',startsOn:'2026-09-15',endsOn:'2026-09-15',kind:'school',open:true,featured:true};
  try {
    await act(async()=>root.render(<SchoolGallery events={[event,{...event,id:'future',slug:'future',startsOn:'2026-10-01'}]} today="2026-09-16" onAdd={onAdd} showToast={vi.fn()} />));
    expect(listPhotos).toHaveBeenCalledWith('bingo');
    expect(host.querySelectorAll('.grid .tile')).toHaveLength(2);
    const arrange = host.querySelector('[aria-label="Arrange photos by"]');
    expect(arrange.value).toBe('time');
    await act(async () => { arrange.value = 'loved'; arrange.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(host.querySelector('.grid .tile').getAttribute('aria-label')).toContain('Favorite family');
    expect(host.querySelector('.house-board')).toBeNull();
    expect(host.querySelector('.home-intro')).toBeNull();
    await act(async()=>host.querySelector('[aria-label="Add photos or videos"]').click());
    expect(onAdd).toHaveBeenCalledWith(event);
    await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Leaderboard').click());
    expect(host.querySelector('.house-board')).not.toBeNull();
    await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Most liked').click());
    const ranked=host.querySelectorAll('.sheet .tile');
    expect(ranked).toHaveLength(2);
    expect(ranked[0].getAttribute('aria-label')).toContain('Favorite family');
    expect(host.querySelectorAll('.event > .shell .tile')).toHaveLength(2);
    await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Contributors').click());
    expect(rewardCall).toHaveBeenCalledWith('vault_contributors', expect.objectContaining({p_event:'bingo'}));
    const contributors=host.querySelectorAll('.contributor-board li');
    expect(contributors).toHaveLength(3);
    expect(contributors[0].textContent).toContain('Large batch');
    expect([...contributors].map(r=>r.querySelector('.leader-rank').textContent)).toEqual(['1','1','2']);
    expect(contributors[0].querySelector('.leader-name').getAttribute('href')).toBe('#/person/large');
  } finally {await act(async()=>root.unmount());host.remove();}
});

it('offers bulk deletion to admins and selects only visible uploads', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host=document.createElement('div'); document.body.append(host); const root=createRoot(host);
  const event={id:'bingo',slug:'bingo-night',title:'Bingo Night',startsOn:'2026-09-15',kind:'school',open:true};
  const button = text => [...host.querySelectorAll('button')].find(b=>b.textContent===text);
  try {
    await act(async()=>root.render(<SchoolGallery events={[event]} today="2026-09-16" canMove admin showToast={vi.fn()} refreshEvents={vi.fn()} />));
    await act(async()=>button('Select uploads').click());
    expect(button('Delete selected').disabled).toBe(true);
    await act(async()=>button('Select all (up to 500)').click());
    expect(host.querySelector('.move-toolbar').textContent).toContain('2 selected');
    await act(async()=>button('Delete selected').click());
    expect(host.querySelector('.sheet').textContent).toContain('Delete 2 selected uploads');
    await act(async()=>button('Cancel').click());
    expect(host.querySelector('.move-toolbar').textContent).toContain('2 selected');
    expect(button('Move selected')).toBeTruthy();
  } finally {await act(async()=>root.unmount());host.remove();}
});

it('refreshes incoming photos in date order but pauses during selection', async () => {
  vi.useFakeTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const event = {id:'dates',slug:'dates',title:'Dates',startsOn:'2026-09-15',kind:'school',open:true};
  const late = {id:'late',owner:'a',uploaderName:'Late photo',takenAt:'2026-09-27T23:00:00Z',thumbKey:'late.jpg'};
  const early = {...late,id:'early',owner:'b',uploaderName:'Early photo',takenAt:'2026-09-27T22:00:00Z'};
  listPhotos.mockResolvedValueOnce([late]).mockResolvedValueOnce([late,early]);
  try {
    await act(async () => root.render(<SchoolGallery events={[event]} today="2026-09-16" canMove admin showToast={vi.fn()} />));
    await act(async () => vi.advanceTimersByTimeAsync(30000));
    expect(host.querySelector('.grid .tile').getAttribute('aria-label')).toContain('Early photo');
    await act(async () => [...host.querySelectorAll('button')].find(b => b.textContent === 'Select uploads').click());
    const calls = listPhotos.mock.calls.length;
    await act(async () => vi.advanceTimersByTimeAsync(60000));
    expect(listPhotos.mock.calls.length).toBe(calls);
  } finally { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); }
});
