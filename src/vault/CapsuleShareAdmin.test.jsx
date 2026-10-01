import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { it, expect, vi } from 'vitest';
vi.mock('./capsuleShare.js', () => ({ adminShare: vi.fn(), shareUrl: token => `https://example.test/share/${token}` }));
import { adminShare } from './capsuleShare.js';
import { CapsuleShareAdmin } from './CapsuleShareAdmin.jsx';
it('generates, copies, disables and updates quality permissions from the admin panel', async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let row = null;
  adminShare.mockImplementation(async (_id, action, _pass, patch) => {
    if (action === 'create') row = { token: 'a'.repeat(64), enabled: true, allow_web_download: true, allow_full_download: true, download_count: 0, created_at: new Date().toISOString() };
    if (action === 'update') row = { ...row, ...patch };
    if (action === 'regenerate') row = { ...row, token: 'b'.repeat(64) };
    return row;
  });
  const copy = vi.fn(async () => {});
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const button = text => [...host.querySelectorAll('button')].find(b => b.textContent === text);
  try {
    await act(async () => root.render(<CapsuleShareAdmin event={{ id: 'event' }} pass="pass" />));
    await act(async () => button('Generate private link').click());
    expect(host.querySelector('a[aria-label="Private share URL"]').href).toContain('a'.repeat(64));
    await act(async () => button('Copy Link').click());
    expect(copy).toHaveBeenCalledWith(`https://example.test/share/${'a'.repeat(64)}`);
    expect(host.querySelector('a').target).toBe('_blank');
    await act(async () => button('Disable').click());
    expect(button('Enable')).toBeTruthy();
    await act(async () => host.querySelector('input[type="checkbox"]').click());
    expect(adminShare).toHaveBeenLastCalledWith('event', 'update', 'pass', { allow_web_download: false });
    await act(async () => button('Regenerate').click());
    expect(host.querySelector('a[aria-label="Private share URL"]').href).toContain('b'.repeat(64));
  } finally { await act(async () => root.unmount()); host.remove(); }
});
