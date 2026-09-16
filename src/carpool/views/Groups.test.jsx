import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import Groups from './Groups.jsx';
import * as api from '../groups.js';
import { fetchNearby } from '../directory.js';
vi.mock('../groups.js', async (original) => ({
  ...await original(),
  fetchGroups: vi.fn(), fetchMyMemberships: vi.fn(), fetchMyRequests: vi.fn(),
  fetchCanOrganize: vi.fn(), fetchPendingRequesters: vi.fn(), fetchRoster: vi.fn(),
  createGroup: vi.fn(), requestToJoin: vi.fn(), seedOwnMembership: vi.fn(),
  buildGroupRecord: vi.fn(() => ({ name: 'Demo group', created_by: 'me' })),
}));
vi.mock('../directory.js', async (original) => ({ ...await original(), fetchNearby: vi.fn(), isMissingRpcError: () => false }));
const family = { user_id: 'me', direction: 'both', weekdays: ['mon'], area_lat: 33.6, area_lng: -84.4, radius_miles: 10 };
const groups = ['one', 'two'].map((id) => ({ ...family, id, created_by: 'other', name: id, status: 'forming', area_label: 'Demo' }));
let host, root;
const buttons = (text) => [...host.querySelectorAll('button')].filter((b) => b.textContent.includes(text));
const click = async (el) => act(async () => el.click());
const render = async () => act(async () => root.render(<Groups family={family} />));
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  api.fetchGroups.mockResolvedValue(groups);
  api.fetchMyMemberships.mockResolvedValue([]); api.fetchMyRequests.mockResolvedValue([]);
  api.fetchCanOrganize.mockResolvedValue(true); api.fetchPendingRequesters.mockResolvedValue([]);
  api.fetchRoster.mockResolvedValue([]); api.createGroup.mockResolvedValue({ id: 'created' });
  api.requestToJoin.mockResolvedValue(undefined); api.seedOwnMembership.mockResolvedValue(undefined);
  fetchNearby.mockResolvedValue([]);
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it('requires separate opt-in for each group, and unchecking prevents the request', async () => {
  await render();
  expect(buttons('Request to join')).toHaveLength(2);
  expect(buttons('Request to join').every((b) => b.disabled)).toBe(true);
  expect(host.querySelector('#request-consent-one').checked).toBe(false);
  await click(host.querySelector('#request-consent-one'));
  expect(buttons('Request to join')[0].disabled).toBe(false);
  expect(buttons('Request to join')[1].disabled).toBe(true);
  await click(host.querySelector('#request-consent-one'));
  await click(buttons('Request to join')[0]);
  expect(api.requestToJoin).not.toHaveBeenCalled();
});
it('sends only the selected group request and resets consent after success', async () => {
  await render();
  await click(host.querySelector('#request-consent-one'));
  await click(buttons('Request to join')[0]);
  expect(api.requestToJoin).toHaveBeenCalledExactlyOnceWith('one');
  expect(host.querySelector('#request-consent-one').checked).toBe(false);
  expect(api.createGroup).not.toHaveBeenCalled();
});
it('blocks group creation without consent, including direct form submission', async () => {
  await render();
  await click(buttons('Create a group nearby')[0]);
  const form = host.querySelector('form');
  expect(host.querySelector('#create-sharing-consent').checked).toBe(false);
  expect(buttons('Create group')[0].disabled).toBe(true);
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(api.createGroup).not.toHaveBeenCalled();
  await click(host.querySelector('#create-sharing-consent'));
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(api.createGroup).toHaveBeenCalledTimes(1);
  expect(host.querySelector('#create-sharing-consent').checked).toBe(false);
});
it('also requires consent when recovering an unfinished organizer membership', async () => {
  api.fetchGroups.mockResolvedValue([{ ...groups[0], created_by: 'me' }]);
  await render();
  expect(buttons('Add me to this group')[0].disabled).toBe(true);
  await click(buttons('Add me to this group')[0]);
  expect(api.seedOwnMembership).not.toHaveBeenCalled();
  await click(host.querySelector('#seed-consent-one'));
  await click(buttons('Add me to this group')[0]);
  expect(api.seedOwnMembership).toHaveBeenCalledExactlyOnceWith('one', 'me');
});
it('associates each checkbox with the explanation about future members', async () => {
  await render();
  const input = host.querySelector('#request-consent-one');
  expect(input.labels[0].textContent).toContain('If I’m accepted');
  expect(host.querySelector(`#${input.getAttribute('aria-describedby')}`).textContent)
    .toContain('Members accepted by the organizer later');
});
