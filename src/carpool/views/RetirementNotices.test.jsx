import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import RetirementNotices from './RetirementNotices.jsx';
import { fetchRetirementNotices, dismissRetirementNotice } from '../retirementNotices.js';
vi.mock('../retirementNotices.js', () => ({ fetchRetirementNotices: vi.fn(), dismissRetirementNotice: vi.fn() }));
let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.resetAllMocks();
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it('explains retirement and opens creation without dismissing or joining anything', async () => {
  const onCreate = vi.fn();
  fetchRetirementNotices.mockResolvedValue([{ id: 'n1', group_name: 'College Park Carpool Crew' }]);
  await act(async () => root.render(<RetirementNotices userId="parent1" canCreate onCreate={onCreate} />));
  expect(fetchRetirementNotices).toHaveBeenCalledWith('parent1');
  expect(host.textContent).toContain('was a test crew and is now closed');
  await act(async () => host.querySelector('button').click());
  expect(onCreate).toHaveBeenCalledOnce();
  expect(dismissRetirementNotice).not.toHaveBeenCalled();
  expect(host.textContent).toContain('A quick update');
});
it('only removes the notice after a successful explicit dismissal', async () => {
  fetchRetirementNotices.mockResolvedValue([{ id: 'n1', group_name: 'Test crew' }]);
  dismissRetirementNotice.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce();
  await act(async () => root.render(<RetirementNotices userId="parent1" canCreate={false} />));
  expect(host.textContent).not.toContain('Create your crew');
  await act(async () => host.querySelector('button').click());
  expect(host.textContent).toContain('We could not dismiss');
  expect(host.textContent).toContain('Test crew');
  await act(async () => Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Got it').click());
  expect(dismissRetirementNotice).toHaveBeenLastCalledWith('n1','parent1');
  expect(host.textContent).not.toContain('Test crew');
});
it('renders no targeted notice for an unaffected family', async () => {
  fetchRetirementNotices.mockResolvedValue([]);
  await act(async () => root.render(<RetirementNotices userId="other" canCreate />));
  expect(host.textContent).toBe('');
});
