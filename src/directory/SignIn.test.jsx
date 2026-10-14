import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect, vi } from 'vitest';
const auth = vi.hoisted(() => ({ signInWithOtp: vi.fn(), verifyOtp: vi.fn() }));
vi.mock('./api.js', () => ({ supabase: { auth }, listBusinesses: vi.fn(), saveBusiness: vi.fn(), uploadPhoto: vi.fn(), removePhotos: vi.fn(), photoUrl: vi.fn() }));
import { SignIn } from './App.jsx';
it('accepts emailed codes and allows retry after an expired code', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  auth.signInWithOtp.mockResolvedValue({error:null});
  auth.verifyOtp.mockResolvedValueOnce({error:{message:'Code expired'}}).mockResolvedValueOnce({error:null});
  const host=document.createElement('div'); document.body.append(host);
  const root=createRoot(host), onError=vi.fn();
  const change=async (input,value) => { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value); input.dispatchEvent(new Event('input',{bubbles:true})); }); };
  const submit=async form => { await act(async () => form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))); };
  try {
    await act(async () => root.render(<SignIn onError={onError} />));
    await change(host.querySelector('input[type=email]'),'owner@example.com');
    await submit(host.querySelector('form'));
    const code=host.querySelector('input[autocomplete="one-time-code"]');
    expect(code).not.toBeNull();
    await change(code,'123456');
    await submit(code.closest('form'));
    expect(onError).toHaveBeenCalledWith('Code expired');
    await change(code,'654321');
    await submit(code.closest('form'));
    expect(auth.verifyOtp).toHaveBeenLastCalledWith({email:'owner@example.com',token:'654321',type:'email'});
  } finally { await act(async () => root.unmount()); host.remove(); }
});
