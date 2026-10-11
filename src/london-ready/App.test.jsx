vi.mock('../london/LoginGate.jsx',()=>({default:({children})=>children,LoginPanel:()=>null}));
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import Ready from './App.jsx';
import * as db from '../london/data.js';
import { uploadBatch } from '../london/upload.js';
vi.mock('../london/data.js',()=>({localScholar:vi.fn(()=>''),saveScholar:vi.fn(),localProfile:vi.fn(()=>({displayName:'Parent',team:''})),getOwner:vi.fn(async()=>'parent'),listEvents:vi.fn(async()=>[{id:'prep',slug:'before-the-adventure'},{id:'trip',slug:'hello-london'},{id:'departure',slug:'off-we-go'}]),listPhotos:vi.fn(async()=>[]),saveProfile:vi.fn(async p=>p),mediaUrl:vi.fn(()=>'/test.jpg'),hidePhoto:vi.fn(async()=>{}),conversation:vi.fn(async()=>({reactions:[],comments:[]}))}));
vi.mock('../london/upload.js',()=>({uploadBatch:vi.fn(async()=>({done:[{id:'new'}],failed:[]}))}));
let host,root;
beforeEach(async()=>{vi.clearAllMocks();globalThis.IS_REACT_ACT_ENVIRONMENT=true;HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};host=document.createElement('div');document.body.append(host);root=createRoot(host);await act(async()=>root.render(<Ready/>));});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const click=async el=>{expect(el).toBeTruthy();await act(async()=>el.click());};
it('gives families their own page without a trip-vault link or chaperone controls',()=>{expect(host.textContent).toContain('Share your airport moments');expect(host.textContent).not.toContain('trip collection');expect(host.textContent).not.toMatch(/chaperone|Admin|Parent tools/);expect(host.querySelector('a[href*="2028-london/"]')).toBeNull();});
it('uploads airport moments into the departure album without day or group choices',async()=>{
 await click([...host.querySelectorAll('button')].find(b=>b.textContent.includes('Share your airport moments')));
 for(let i=0;i<100&&!host.querySelector('dialog');i++) await act(async()=>{await new Promise(r=>setTimeout(r,20));});
 expect(host.querySelector('dialog')).toBeTruthy();
 await click([...host.querySelectorAll('button')].find(b=>b.textContent==='Add a caption or change name'));
 expect(host.querySelector('dialog select')).toBeNull();
 const input=host.querySelector('input[type=file]');Object.defineProperty(input,'files',{value:[new File(['photo'],'bag.jpg',{type:'image/jpeg'})]});
 await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));
 await act(async()=>{const el=host.querySelector('input[placeholder="Mosie, or names for a group moment"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Mosie');el.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>host.querySelector('dialog form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(uploadBatch).toHaveBeenCalledWith(expect.any(Array),expect.objectContaining({event:{id:'departure',slug:'off-we-go'},scholarName:'Mosie',inspiration:'airport-hellos',caption:'Airport hugs, smiles, and see-you-soons.'}));
});
it('shows family moments together and lets parents filter and remove their own uploads',async()=>{
 db.listPhotos.mockResolvedValueOnce([{id:'own',owner:'parent',eventId:'prep',caption:'Our packing'},{id:'other',owner:'another',eventId:'prep'},{id:'trip',owner:'parent',eventId:'trip'}]);
 await act(async()=>{root.unmount();root=createRoot(host);root.render(<Ready/>);});
 expect(host.querySelectorAll('.ready-mine article')).toHaveLength(2);
 await click([...host.querySelectorAll('button')].find(b=>b.textContent==='Your uploads'));
 expect(host.querySelectorAll('.ready-mine article')).toHaveLength(1);
 const remove=[...host.querySelectorAll('.ready-mine button')].find(b=>b.textContent==='Remove my upload');await click(remove);expect(db.hidePhoto).not.toHaveBeenCalled();await click(remove);expect(db.hidePhoto).toHaveBeenCalledWith('own');
});

it('retires the pre-trip traveler questions',()=>{
 expect(host.querySelector('.ready-choices')).toBeNull();
 expect(host.querySelector('.ready-more')).toBeNull();
 expect(host.textContent).not.toContain('A little question');
});
