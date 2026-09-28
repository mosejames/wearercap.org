// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('./data.js', async original => ({ ...await original(), removeUpload: vi.fn() }));
import { removeUpload } from './data.js';
import { BulkDeleteSheet } from './App.jsx';
afterEach(() => vi.resetAllMocks());
async function mount() {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host); const onRemoved = vi.fn(), onClose = vi.fn();
  await act(async () => root.render(<BulkDeleteSheet ids={['one','two','three']} pass="admin-pass" onRemoved={onRemoved} onClose={onClose} />));
  return {host,onRemoved,onClose,button: text => [...host.querySelectorAll('button')].find(b => b.textContent === text),close: async () => { await act(async () => root.unmount()); host.remove(); }};
}
it('requires explicit confirmation and cancellation does not delete anything', async () => {
  const ui = await mount();
  try {
    expect(ui.host.textContent).toContain('This cannot be undone');
    expect(removeUpload).not.toHaveBeenCalled();
    await act(async () => ui.button('Cancel').click());
    expect(ui.onClose).toHaveBeenCalledOnce();
    expect(removeUpload).not.toHaveBeenCalled();
  } finally { await ui.close(); }
});
it('keeps failed uploads retryable without deleting successful ones again', async () => {
  removeUpload.mockResolvedValueOnce({removed:true}).mockRejectedValueOnce(new Error('File cleanup could not finish.')).mockResolvedValueOnce({removed:true}).mockResolvedValueOnce({removed:true});
  const ui = await mount();
  try {
    await act(async () => ui.button('Delete 3 uploads').click());
    expect(removeUpload.mock.calls).toEqual([['one','admin-pass'],['two','admin-pass'],['three','admin-pass']]);
    expect(ui.onRemoved.mock.calls).toEqual([['one'],['three']]);
    expect(ui.onClose).not.toHaveBeenCalled();
    expect(ui.host.querySelector('[role="status"]').textContent).toContain('2 of 3');
    await act(async () => ui.button('Retry 1 upload').click());
    expect(removeUpload.mock.calls.at(-1)).toEqual(['two','admin-pass']);
    expect(removeUpload).toHaveBeenCalledTimes(4);
    expect(ui.onClose).toHaveBeenCalledOnce();
  } finally { await ui.close(); }
});
it('blocks duplicate submissions and closing while deletion is running', async () => {
  let finish;
  removeUpload.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({removed:true});
  const ui = await mount();
  try {
    await act(async () => ui.button('Delete 3 uploads').click());
    expect(ui.button('Deleting…').disabled).toBe(true);
    expect(ui.button('Cancel').disabled).toBe(true);
    await act(async () => ui.host.querySelector('[aria-label="Close"]').click());
    expect(ui.onClose).not.toHaveBeenCalled();
    await act(async () => finish({removed:true}));
    expect(removeUpload).toHaveBeenCalledTimes(3);
    expect(ui.onClose).toHaveBeenCalledOnce();
  } finally { await ui.close(); }
});
