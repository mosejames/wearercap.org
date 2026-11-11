import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import Neighbors from './Neighbors.jsx';
import * as api from '../neighbors.js';

vi.mock('../neighbors.js', async (original) => ({
  ...await original(),
  fetchNeighbors: vi.fn(), fetchWaitingCount: vi.fn(), setInterest: vi.fn(), setPaused: vi.fn(),
}));
vi.mock('../family.js', () => ({ setFamilyRadius: vi.fn() }));

const family = { user_id: 'me', parent_name: 'Jordan Parker', direction: 'both', weekdays: ['mon', 'tue'], area_label: '30291', radius_miles: null, paused_at: null };
let host, root;
const buttons = (text) => [...host.querySelectorAll('button')].filter((b) => b.textContent.includes(text));
const render = async (props = {}) => act(async () => root.render(<Neighbors family={family} userId="me" {...props} />));

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  api.fetchWaitingCount.mockResolvedValue(0);
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it('shows an area, never a name, for a family that has not said yes', async () => {
  api.fetchNeighbors.mockResolvedValue([
    { user_id: 'n1', area_label: '30291', direction: 'am', weekdays: ['mon'], distance_miles: 0.2, interested: false, mutual: false, parent_name: null },
  ]);
  await render();
  expect(host.textContent).toContain('A family in Union City');
  expect(host.textContent).toContain('What happens next');
  expect(buttons("I'm interested")).toHaveLength(1);
});

it('saves interest privately and confirms the other family was not told', async () => {
  api.fetchNeighbors.mockResolvedValue([
    { user_id: 'n1', area_label: '30291', direction: 'am', weekdays: ['mon'], distance_miles: 2, interested: false, mutual: false },
  ]);
  api.setInterest.mockResolvedValue({ interested: true, mutual: false });
  await render();
  await act(async () => buttons("I'm interested")[0].click());
  expect(api.setInterest).toHaveBeenCalledWith('n1', true);
  expect(host.textContent).toContain('Thank you for showing interest');
});

it('reveals name and contact only for a mutual match', async () => {
  api.fetchNeighbors.mockResolvedValue([
    { user_id: 'm1', area_label: '30291', direction: 'am', weekdays: ['mon'], distance_miles: 0, interested: true, mutual: true,
      parent_name: 'Taylor Reed', child_names: 'Avery', contact_email: 'taylor@example.com', contact_phone: '(404) 555-0142' },
  ]);
  await render();
  expect(host.textContent).toContain('You both said yes');
  expect(host.textContent).toContain('Taylor Reed');
  expect(host.querySelector('a[href^="sms:"]')).not.toBeNull();
  expect(host.querySelector('a[href^="mailto:taylor@example.com"]')).not.toBeNull();
});

it('offers a wider search when nobody is near', async () => {
  api.fetchNeighbors.mockResolvedValue([]);
  await render({ fromIntro: true });
  expect(host.textContent).toContain('No families near you yet');
  expect(buttons('25 mi')).toHaveLength(1);
  expect(host.textContent).toContain('You came from an introduction');
});

it('tells a family someone nearby is interested without pointing at which card', async () => {
  api.fetchWaitingCount.mockResolvedValue(1);
  api.fetchNeighbors.mockResolvedValue([
    { user_id: 'n1', area_label: '30291', direction: 'am', weekdays: ['mon'], distance_miles: 1, interested: false, mutual: false },
    { user_id: 'n2', area_label: '30349', direction: 'am', weekdays: ['mon'], distance_miles: 3, interested: false, mutual: false },
  ]);
  await render();
  expect(host.textContent).toContain('A family near you is interested.');
  expect(host.textContent).toContain("We won't say which one");
  expect(buttons("I'm interested")).toHaveLength(2);
});

it('still lists families when the waiting count cannot load', async () => {
  api.fetchWaitingCount.mockRejectedValue(new Error('offline'));
  api.fetchNeighbors.mockResolvedValue([
    { user_id: 'n1', area_label: '30291', direction: 'am', weekdays: ['mon'], distance_miles: 1, interested: false, mutual: false },
  ]);
  await render();
  expect(buttons("I'm interested")).toHaveLength(1);
});
