vi.mock('../london/LoginGate.jsx',()=>({default:({children})=>children,LoginPanel:()=>null}));
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import Ready from './App.jsx';
import * as db from '../london/data.js';
import { uploadBatch } from '../london/upload.js';
vi.mock('../london/data.js',()=>({localProfile:vi.fn(()=>({displayName:'Parent',team:''})),getOwner:vi.fn(async()=>'parent'),listEvents:vi.fn(async()=>[{id:'prep',slug:'before-the-adventure'},{id:'trip',slug:'hello-london'}]),listPhotos:vi.fn(async()=>[]),saveProfile:vi.fn(async p=>p),mediaUrl:vi.fn(()=>'/test.jpg'),hidePhoto:vi.fn(async()=>{}),conversation:vi.fn(async()=>({reactions:[],comments:[]}))}));
vi.mock('../london/upload.js',()=>({uploadBatch:vi.fn(async()=>({done:[{id:'new'}],failed:[]}))}));
let host,root;
beforeEach(async()=>{vi.clearAllMocks();globalThis.IS_REACT_ACT_ENVIRONMENT=true;HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(<Ready/>));});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const click=async el=>{expect(el).toBeTruthy();await act(async()=>el.click());};
it('gives families their own page without a trip-vault link or chaperone controls',()=>{expect(host.textContent).toContain('A little question');expect(host.textContent).not.toContain('trip collection');expect(host.textContent).not.toMatch(/chaperone|Admin|Parent tools/);expect(host.querySelector('a[href*="2028-london/"]')).toBeNull();});
it('uploads a packing moment into the existing preparation album with no day or group choice',async()=>{
 let packing;
 for(let i=0;i<3;i++){packing=[...host.querySelectorAll('.ready-choices button')].find(b=>b.textContent.includes('absolutely has to come'));if(packing)break;await click(host.querySelector('.ready-more'));}
 await click(packing);
 await act(async()=>{await new Promise(r=>setTimeout(r,30));});
 expect(host.querySelector('dialog')).toBeTruthy();
 await click([...host.querySelectorAll('button')].find(b=>b.textContent==='Add a caption or change name'));
 expect(host.querySelector('dialog select')).toBeNull();
 const input=host.querySelector('input[type=file]');Object.defineProperty(input,'files',{value:[new File(['photo'],'bag.jpg',{type:'image/jpeg'})]});
 await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));
 await act(async()=>host.querySelector('dialog form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(uploadBatch).toHaveBeenCalledWith(expect.any(Array),expect.objectContaining({event:{id:'prep',slug:'before-the-adventure'},inspiration:'packing-bags',caption:'What’s going in your suitcase that absolutely has to come?'}));
});
it('shows only this parent’s preparation uploads and confirms removal',async()=>{
 db.listPhotos.mockResolvedValueOnce([{id:'own',owner:'parent',eventId:'prep',caption:'Our packing'},{id:'other',owner:'another',eventId:'prep'},{id:'trip',owner:'parent',eventId:'trip'}]);
 await act(async()=>{root.unmount();root=createRoot(host);root.render(<Ready/>);});
 expect(host.querySelectorAll('.ready-mine article')).toHaveLength(1);
 const remove=[...host.querySelectorAll('.ready-mine button')].find(b=>b.textContent==='Remove my upload');await click(remove);expect(db.hidePhoto).not.toHaveBeenCalled();await click(remove);expect(db.hidePhoto).toHaveBeenCalledWith('own');
});

it('offers three random choices and cycles through all nine without repeats',async()=>{
 const seen=new Set();
 for(let i=0;i<3;i++){
  const choices=host.querySelectorAll('.ready-choices button');expect(choices).toHaveLength(3);
  choices.forEach(b=>seen.add(b.textContent));
  await click(host.querySelector('.ready-more'));
 }
 expect(seen.size).toBe(9);
 expect(host.textContent).toContain('Answer one or all.');
});
