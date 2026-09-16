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
  } finally {await act(async()=>root.unmount());host.remove();}
});
