import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('./data.js', () => ({localProfile:vi.fn(),getOwner:vi.fn(),listEvents:vi.fn(),listPhotos:vi.fn(),mediaUrl:vi.fn(()=>'/test.jpg'),hidePhoto:vi.fn(),saveProfile:vi.fn()}));
vi.mock('./upload.js',()=>({uploadBatch:vi.fn()}));
import * as db from './data.js';
import App from './App.jsx';
let root,host;
const own={id:'own',owner:'me',eventId:'event',uploaderName:'Test chaperone',caption:'Our day',team:''};
const other={...own,id:'other',owner:'someone-else',caption:'Another perspective'};
beforeEach(async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 vi.clearAllMocks(); window.location.hash='';sessionStorage.clear();
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};
 Element.prototype.scrollIntoView=vi.fn();
 db.localProfile.mockReturnValue({displayName:'Test chaperone',team:''});db.getOwner.mockResolvedValue('me');
 db.listEvents.mockResolvedValue([{id:'event',slug:'the-whole-adventure',title:'The whole adventure'}]);db.listPhotos.mockResolvedValue([own,other]);db.hidePhoto.mockResolvedValue();
 host=document.createElement('div');document.body.append(host);root=createRoot(host);
 await act(async()=>root.render(<App />));
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const button=(text)=>[...host.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
const click=async(el)=>{expect(el).toBeTruthy();await act(async()=>el.click());};
it('shows only this contributor’s photos in My uploads and no removal control on another person’s photo',async()=>{
 expect(host.querySelectorAll('.l-remove')).toHaveLength(1);
 await click(button('My uploads'));
 expect(host.querySelectorAll('.l-photo')).toHaveLength(1);
 expect(host.querySelector('.l-photo').textContent).toContain('Our day');
 expect(host.querySelector('.l-own-note').textContent).toContain('this device');
 await click(button('Everyone’s photos'));
 await click(host.querySelector('[aria-label="Open Another perspective"]'));
 expect(host.querySelector('dialog').textContent).not.toContain('Remove from album');
});
it('requires removal confirmation, preserves a failed removal and allows retry without admin access',async()=>{
 db.hidePhoto.mockRejectedValueOnce(new Error('Please try again.')).mockResolvedValueOnce();
 await click(host.querySelector('.l-remove'));
 expect(db.hidePhoto).not.toHaveBeenCalled();
 await click(button('Remove from album'));
 expect(db.hidePhoto).toHaveBeenCalledWith('own','');
 expect(host.querySelector('[role="alert"]').textContent).toContain('Please try again.');
 expect(host.querySelector('dialog')).toBeTruthy();
 db.listPhotos.mockResolvedValue([other]);await click(button('Remove from album'));
 expect(host.querySelector('dialog')).toBeNull();expect(host.querySelectorAll('.l-photo')).toHaveLength(1);
});
it('starts returning contributors with photo selection and keeps optional details out of the way',async()=>{
 await click(button('Add photos'));
 const dialog=host.querySelector('dialog');expect(dialog.querySelector('input').type).toBe('file');
 expect(dialog.textContent).toContain('Sharing as Test chaperone');expect(dialog.querySelector('textarea')).toBeNull();
 await click(button('Change or add a caption'));
 expect(dialog.querySelector('textarea')).toBeTruthy();expect(dialog.querySelector('input[autocomplete="name"]').value).toBe('Test chaperone');
});
it('uses the map to select the corresponding guide chapter',async()=>{
 await click(host.querySelector('[aria-label="Explore Versailles"]'));
 expect(window.location.hash).toBe('#/e/a-day-to-remember');
 expect(host.querySelector('.l-route-day').textContent).toContain('Paris + Versailles');
 expect(host.querySelector('.l-destination-photo').src).toContain('versailles.jpg');
});
it('shares a clean link to the exact gallery photo instead of a hash-only album link',async()=>{
 const share=vi.fn().mockResolvedValue();Object.defineProperty(navigator,'share',{configurable:true,value:share});
 await click(host.querySelector('[aria-label="Open Our day"]'));await click(button('Share this photo'));
 expect(share).toHaveBeenCalledWith({title:'The whole adventure · Class of 2028',url:`${window.location.origin}/e/the-whole-adventure/p/own`});
 delete navigator.share;
});
it('opens a valid shared photo after gallery loading and does not reopen it after closing',async()=>{
 const photoId='11111111-1111-4111-8111-111111111111';db.listPhotos.mockResolvedValue([{...own,id:photoId}]);
 await act(async()=>{window.location.hash=`#/e/the-whole-adventure/p/${photoId}`;window.dispatchEvent(new HashChangeEvent('hashchange'));});
 // Remount to exercise a fresh share landing with async gallery data.
 await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(<App />));
 expect(host.querySelector('dialog').textContent).toContain('Our day');
 await click(host.querySelector('[aria-label="Close"]'));expect(host.querySelector('dialog')).toBeNull();
 await act(async()=>window.dispatchEvent(new HashChangeEvent('hashchange')));expect(host.querySelector('dialog')).toBeNull();
});
