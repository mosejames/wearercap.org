vi.mock('./LoginGate.jsx',()=>({default:({children})=>children,LoginPanel:()=>null}));
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('./data.js', () => ({localScholar:vi.fn(()=>''),saveScholar:vi.fn(),localProfile:vi.fn(),getOwner:vi.fn(),listEvents:vi.fn(),listPhotos:vi.fn(),mediaUrl:vi.fn(()=>'/test.jpg'),hidePhoto:vi.fn(),saveProfile:vi.fn(),setThanks:vi.fn(),categorizePhoto:vi.fn(),conversation:vi.fn(async()=>({reactions:[],comments:[]}))}));
vi.mock('./upload.js',()=>({uploadBatch:vi.fn()}));
import * as db from './data.js';
import App, { Upload } from './App.jsx';
import { makeTextCard } from './textCard.js';
import { uploadBatch } from './upload.js';
vi.mock('./textCard.js',async importOriginal=>({...await importOriginal(),makeTextCard:vi.fn()}));
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
 expect(host.querySelector('.l-own-note').textContent).toContain('this account');
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
 await click(button('Share a moment'));
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
it('opens family preparation uploads in their own album with photos and videos supported',async()=>{
 await click(button('Add a family postcard'));
 const dialog=host.querySelector('dialog');expect(dialog.querySelector('h2').textContent).toBe('What would you like to share?');
 expect(dialog.querySelector('.l-upload-summary').textContent).toContain('Before the adventure');
 expect(dialog.querySelector('input[type="file"]').accept).toContain('video/mp4');
 expect(dialog.querySelector('input[type="file"]').accept).toContain('image/*');
});
it('uses a selected parent question as an editable caption and saves to the preparation album',async()=>{
 const {uploadBatch}=await import('./upload.js');uploadBatch.mockResolvedValue({done:[own],failed:[]});
 db.listEvents.mockResolvedValue([{id:'prep',slug:'before-the-adventure',title:'Before the adventure'}]);
 db.saveProfile.mockResolvedValue({displayName:'Test chaperone',team:''});
 await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(<App />));
 await click(button('Need an idea?'));
 await click([...host.querySelectorAll('.l-inspiration-collections button')].find(b=>b.textContent.includes('What we’re most excited about')));
 expect(window.location.hash).toBe('#/c/most-excited');
 await click(button('Add a moment here'));
 const file=new File(['photo'],'packing.jpg',{type:'image/jpeg'});
 const input=host.querySelector('input[type="file"]');Object.defineProperty(input,'files',{value:[file],configurable:true});
 await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));
 await click(button('Change or add a caption'));expect(host.querySelector('textarea').value).toBe('What are you most excited to see or do?');
 await act(async()=>{const el=host.querySelector('input[placeholder="Mosie, or names for a group moment"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'Mosie');el.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>host.querySelector('dialog form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(uploadBatch).toHaveBeenCalledWith([file],expect.objectContaining({event:expect.objectContaining({id:'prep',slug:'before-the-adventure'}),caption:'What are you most excited to see or do?',scholarName:'Mosie',inspiration:'most-excited'}));
});
it('opens family video postcards through the compact invitation',async()=>{
 db.listEvents.mockResolvedValue([{id:'prep',slug:'before-the-adventure',title:'Before the adventure'}]);
 db.listPhotos.mockResolvedValue([{...own,eventId:'prep',kind:'video',caption:'Ready for London'}]);
 await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(<App />));
 await click(button('View postcards (1)'));
 expect(host.querySelector('.l-grid').textContent).toContain('Video');
 await click(host.querySelector('[aria-label="Open Ready for London"]'));
 expect(host.querySelector('dialog video').controls).toBe(true);expect(window.location.hash).toBe('#/e/before-the-adventure');
});

it('saves a thank-you reaction on the photo and lets a parent undo it',async()=>{
 db.setThanks.mockResolvedValue();
 await click(button('Thanks for sharing'));
 expect(db.setThanks).toHaveBeenLastCalledWith('own',true);
 expect(button('Thanks sent').getAttribute('aria-pressed')).toBe('true');
 await click(button('Thanks sent'));
 expect(db.setThanks).toHaveBeenLastCalledWith('own',false);
});
it('keeps a failed reaction available to retry',async()=>{
 db.setThanks.mockRejectedValueOnce(new Error('offline'));
 await click(button('Thanks for sharing'));
 expect(host.querySelector('[role="alert"]').textContent).toContain('could not be saved');
 expect(button('Thanks for sharing').getAttribute('aria-pressed')).toBe('false');
});

it('collects matching moments from different parents and keeps unrelated photos out',async()=>{
 db.listPhotos.mockResolvedValue([{...own,inspiration:'packing-bags'}, {...other,inspiration:'packing-bags'}, {...own,id:'unrelated',inspiration:'airport-hellos',caption:'Airport wave'}]);
 await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(<App />));
 await click(button('Need an idea?'));
 await click([...host.querySelectorAll('.l-inspiration-collections button')].find(b=>b.textContent.includes('Packing bags')));
 expect(host.querySelector('.l-grid').textContent).toContain('Our day');
 expect(host.querySelector('.l-grid').textContent).toContain('Another perspective');
 expect(host.querySelector('.l-grid').textContent).not.toContain('Airport wave');
 expect(host.querySelectorAll('.l-photo')).toHaveLength(2);
 await click(button('Back to all postcards'));
 expect(host.querySelectorAll('.l-photo')).toHaveLength(3);
});
it('restores a collection from its link and offers the correct day and collection for upload',async()=>{
 db.listEvents.mockResolvedValue([{id:'stones',slug:'palaces-and-stones',title:'Palaces, stones & a little magic'}]);
 window.location.hash='#/c/hampton-court';
 await act(async()=>root.unmount());root=createRoot(host);await act(async()=>root.render(<App />));
 expect(host.querySelector('.l-section-head h2').textContent).toBe('Hampton Court Palace');
 await click(button('Add a moment here'));
 expect(host.querySelector('dialog h2').textContent).toBe('What’s happening at Hampton Court Palace?');
 await click(button('Change or add a caption'));
 expect(host.querySelector('.l-upload-summary').textContent).toContain('Hampton Court Palace');
 expect(host.querySelector('dialog').textContent).not.toContain('Inspiration collection (optional)');
 expect([...host.querySelectorAll('select')].find(el=>el.value==='palaces-and-stones')).toBeTruthy();
});

it('keeps organizing out of uploads and lets parents label another contributor’s photo later',async()=>{
 db.categorizePhoto.mockResolvedValue();
 expect(host.querySelector('.l-collection-editor')).toBeNull();
 await click(button('Parent tools'));
 const article=[...host.querySelectorAll('.l-photo')].find(el=>el.textContent.includes('Another perspective'));
 const select=article.querySelector('select');
 await act(async()=>{select.value='packing-bags';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await click([...article.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save label'));
 expect(db.categorizePhoto).toHaveBeenCalledWith('other','packing-bags');
 expect(article.querySelector('select').value).toBe('packing-bags');
 expect(article.textContent).not.toContain('Remove');
 await click(button('Done organizing'));
 expect(host.querySelector('.l-collection-editor')).toBeNull();
 await click(button('Share a moment'));
 await click(button('Change or add a caption'));
 expect(host.querySelector('dialog').textContent).not.toContain('Collection for');
 expect(host.querySelector('dialog').textContent).not.toContain('Inspiration collection');
});
it('keeps a failed parent label change available to retry',async()=>{
 db.categorizePhoto.mockRejectedValueOnce(new Error('offline'));
 await click(button('Parent tools'));
 const select=host.querySelector('.l-collection-editor select');
 await act(async()=>{select.value='packing-bags';select.dispatchEvent(new Event('change',{bubbles:true}));});
 await click(button('Save label'));
 expect(host.querySelector('[role="alert"]').textContent).toContain('could not be saved');
 expect(button('Save label').disabled).toBe(false);
});

it('shares an attributed quote as an R2-ready card in the chosen album',async()=>{
 const card=new File(['card'],'quote-moment.jpg',{type:'image/jpeg'});
 makeTextCard.mockResolvedValue({file:card,caption:'I love London! (Mosie)'});
 uploadBatch.mockResolvedValue({done:[{id:'new'}],failed:[]});
 db.saveProfile.mockResolvedValue({displayName:'Parent',team:''});
 await act(async()=>root.render(<Upload parentOnly events={[{id:'prep',slug:'before-the-adventure'}]} initialAlbum="before-the-adventure" initialPrompt="What do you think London will be like?" initialInspiration="dreaming-of-london" profile={{displayName:'Parent',team:''}} setProfile={()=>{}} close={()=>{}} done={()=>{}} viewUploads={()=>{}}/>));
 await click([...host.querySelectorAll('[role=tab]')].find(b=>b.querySelector('b')?.textContent==='Write a response'));
 const textarea=host.querySelector('textarea');
 const setValue=async(el,value)=>{await act(async()=>{Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));});};
 await setValue(textarea,'I love London!');
 await setValue(host.querySelector('input[placeholder="Mosie, or names for a group moment"]'),'Mosie');
 expect(host.querySelector('input[type=file]')).toBeNull();
 await act(async()=>host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(host.querySelector('dialog h2').textContent).toBe('That’s a memory worth keeping.');
 expect(button('Bring the group chat along')).toBeTruthy();
 expect(makeTextCard).toHaveBeenCalledWith(expect.objectContaining({mode:'quote',text:'I love London!',speaker:'Mosie'}));
 expect(uploadBatch).toHaveBeenCalledWith([card],expect.objectContaining({event:{id:'prep',slug:'before-the-adventure'},inspiration:'dreaming-of-london',scholarName:'Mosie',caption:'I love London! (Mosie)'}));
});
it('offers written modes without requiring a photograph',async()=>{
 await click(button('Share a moment'));
 await click([...host.querySelectorAll('[role=tab]')].find(b=>b.querySelector('b')?.textContent==='Finish a thought'));
 const starters=host.querySelector('#share-panel select');
 expect(starters.options).toHaveLength(20);
 await act(async()=>{starters.value='One thing I’m curious about at Versailles is…';starters.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(starters.value).toBe('One thing I’m curious about at Versailles is…');
 expect(host.querySelector('textarea')).toBeTruthy();
 expect(host.querySelector('input[type=file]')).toBeNull();
});

it('does not offer empty sharing options to a new parent writing a quote',async()=>{
 await act(async()=>root.render(<Upload parentOnly events={[{id:'prep',slug:'before-the-adventure'}]} initialAlbum="before-the-adventure" profile={null} setProfile={()=>{}} close={()=>{}} done={()=>{}} viewUploads={()=>{}}/>));
 await click(host.querySelector('#share-tab-comment'));
 expect(host.querySelector('.l-upload-summary button')).toBeNull();
 expect(host.querySelector('.l-share-example').textContent).toContain('packing extra room');
 expect(host.querySelector('input[autocomplete="name"]')).toBeTruthy();
});

it('thanks a successful contributor and opens the parent invitation in native sharing',async()=>{
 const share=vi.fn(async()=>{});Object.defineProperty(navigator,'share',{configurable:true,value:share});
 const {ShareThanks}=await import('./App.jsx');
 await act(async()=>root.render(<ShareThanks parentOnly again={()=>{}} close={()=>{}} viewUploads={()=>{}}/>));
 await click(button('Bring the group chat along'));
 expect(share).toHaveBeenCalledWith(expect.objectContaining({url:new URL('/2028-london-ready/',window.location.origin).href,text:expect.stringContaining('getting-ready')}));
 Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
 const writeText=vi.fn(async()=>{});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}});
 await click(button('Bring the group chat along'));
 expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/2028-london-ready/'));
 expect(host.textContent).toContain('Invite copied.');
});

it('offers only positive reactions and posts comments on the selected moment',async()=>{
 const {Conversation}=await import('./App.jsx');
 db.conversation.mockResolvedValue({reactions:[],comments:[]});
 await act(async()=>root.render(<Conversation photoId="own"/>));
 expect([...host.querySelectorAll('.l-positive-reactions button')].map(b=>b.textContent)).toEqual(['❤️ Love','🎉 Celebrate','💙 Thanks']);
 await click(host.querySelectorAll('.l-positive-reactions button')[1]);
 expect(db.conversation).toHaveBeenCalledWith('own','react',{p_reaction:'celebrate'});
 await act(async()=>{const el=host.querySelector('textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'So excited for you!');el.dispatchEvent(new Event('input',{bubbles:true}));});
 await act(async()=>host.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(db.conversation).toHaveBeenCalledWith('own','comment',{p_body:'So excited for you!',p_name:'Test chaperone'});
});

it('asks for scholar attribution in every sharing mode, separately from the adult name',async()=>{
 await click(button('Share a moment'));
 for(const label of ['Photo / video','Write a response','Finish a thought']){
  await click([...host.querySelectorAll('[role=tab]')].find(b=>b.querySelector('b')?.textContent===label));
  expect(host.querySelector('input[placeholder="Mosie, or names for a group moment"]').required).toBe(true);
 }
 await act(async()=>host.querySelector('dialog form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
 expect(host.querySelector('[role=alert]').textContent).toContain('scholar’s first name');
 expect(uploadBatch).not.toHaveBeenCalled();
});
