import React, { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('./rewards.js', () => ({ rewardCall: vi.fn(), badgeName: n => n === 1 ? 'First Share' : 'Memory maker' }));
vi.mock('./data.js', () => ({ mediaUrl: p => '/'+p.thumbKey }));
import { rewardCall } from './rewards.js';
import { ThankYouButton, PostUploadShare, CapsuleInbox } from './CapsuleCommunity.jsx';
let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();delete navigator.clipboard;vi.restoreAllMocks();});
const button = text => [...host.querySelectorAll('button')].find(b=>b.textContent.includes(text));
it('requires sign-in without sending a reaction for a visitor',async()=>{
  const signIn=vi.fn();
  await act(async()=>root.render(<ThankYouButton photoId="photo" onSignIn={signIn}/>));
  await act(async()=>button('Thank you').click());
  expect(signIn).toHaveBeenCalled();expect(rewardCall).not.toHaveBeenCalled();
});
it('sends one private thank-you and supports undo',async()=>{
  rewardCall.mockImplementation(async(_name,args)=>({thanked:args.p_action==='send'}));
  await act(async()=>root.render(<ThankYouButton photoId="photo" owner="sender" onSignIn={vi.fn()}/>));
  await act(async()=>button('Thank you').click());
  expect(rewardCall).toHaveBeenCalledWith('capsule_community',{p_action:'send',p_photo:'photo'});
  expect(button('Thank-you sent').getAttribute('aria-pressed')).toBe('true');
  expect(host.textContent).toContain('Shared privately');
  await act(async()=>button('Thank-you sent').click());
  expect(rewardCall).toHaveBeenCalledWith('capsule_community',{p_action:'undo',p_photo:'photo'});
  expect(button('Thank you').getAttribute('aria-pressed')).toBe('false');
});
it('does not show success for a failed thank-you',async()=>{
  rewardCall.mockImplementation(async(_name,args)=>{if(args.p_action==='send')throw new Error('Offline');return {thanked:false};});
  await act(async()=>root.render(<ThankYouButton photoId="photo" owner="sender"/>));
  await act(async()=>button('Thank you').click());
  expect(host.querySelector('[role="alert"]').textContent).toContain('Offline');
  expect(button('Thank you').getAttribute('aria-pressed')).toBe('false');
});
it('celebrates once under StrictMode and copies an event-specific invitation',async()=>{
  rewardCall.mockResolvedValue({first_share:true});
  const writeText=vi.fn().mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{writeText} });
  await act(async()=>root.render(<StrictMode><PostUploadShare event={{title:'Bingo Night',slug:'bingo-night'}}/></StrictMode>));
  expect(rewardCall).toHaveBeenCalledTimes(1);
  expect(host.textContent).toContain('Your first memories are in the Capsule');
  await act(async()=>button('Copy message').click());
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Just added my Bingo Night photos!'));
  expect(writeText).toHaveBeenCalledWith(expect.stringContaining('e/bingo-night'));
  expect(host.textContent).toContain('Message copied');
});
it('does not celebrate an already-recognized contributor',async()=>{
  rewardCall.mockResolvedValue({first_share:false});
  await act(async()=>root.render(<PostUploadShare event={{title:'Bingo Night',slug:'bingo-night'}}/>));
  expect(host.querySelector('.capsule-first-share')).toBeNull();
  expect(button('Share')).toBeTruthy();
});
it('marks only displayed notifications as read and links to their photos',async()=>{
  rewardCall.mockResolvedValue({first_share_at:'2026-09-16',total:1,items:[{id:'thanks-id',photo_id:'photo',slug:'bingo-night',title:'Bingo Night',sender:'A parent',thumb_key:'thumb.jpg',storage:'r2',read_at:null}]});
  await act(async()=>root.render(<CapsuleInbox owner="recipient"/>));
  expect(host.querySelector('a').getAttribute('href')).toBe('#/e/bingo-night/p/photo');
  expect(host.textContent).toContain('First Share');
  await act(async()=>button('Mark these as read').click());
  expect(rewardCall).toHaveBeenCalledWith('capsule_community',{p_action:'read',p_ids:['thanks-id']});
});
