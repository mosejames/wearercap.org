import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import MapView from './MapView.jsx';
import { fetchNearby } from '../directory.js';
import { loadMaps } from '../maps.js';
vi.mock('../directory.js', () => ({ fetchNearby: vi.fn(), fetchAreaCount: vi.fn() }));
vi.mock('../maps.js', () => ({ loadMaps: vi.fn() }));
const family = { user_id: 'me', direction: 'both', weekdays: ['tue'], area_lat: 33.6, area_lng: -84.4 };
let host, root;
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  sessionStorage.clear(); vi.clearAllMocks();
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it('shows families before loading maps and keeps them visible if the map fails', async () => {
  fetchNearby.mockResolvedValue([{ ...family, user_id: 'other', parent_name: 'Example parent', area_label: '30291', distance_miles: 3.1 }]);
  loadMaps.mockRejectedValue(new Error('map unavailable'));
  await act(async () => root.render(<MapView family={family} />));
  expect(host.textContent).toContain('Example parent');
  expect(host.textContent).toContain('You both listed Tue morning & afternoon rides');
  expect(loadMaps).not.toHaveBeenCalled();
  await act(async () => host.querySelector('#cp-area-map-head').click());
  expect(host.textContent).toContain('The map could not load');
  expect(host.textContent).toContain('Example parent');
});
it('distinguishes a failed request from an empty neighborhood and supports retry', async () => {
  fetchNearby.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([]);
  await act(async () => root.render(<MapView family={family} />));
  expect(host.textContent).toContain('We could not load nearby families');
  expect(host.textContent).not.toContain('No active families');
  await act(async () => host.querySelector('button').click());
  expect(host.textContent).toContain('No active families in your search area');
});
it('uses one area circle for families sharing a centroid and cleans up on collapse', async () => {
  const remove = vi.fn();
  const circles = [];
  loadMaps.mockResolvedValue({
    Map: class {},
    Circle: class { constructor(options) { circles.push(options); } setMap(value) { remove(value); } },
  });
  fetchNearby.mockResolvedValue([{ ...family, user_id: 'other', parent_name: 'Example parent', area_label: '30291', distance_miles: 0 }]);
  await act(async () => root.render(<MapView family={family} />));
  await act(async () => host.querySelector('#cp-area-map-head').click());
  expect(circles).toHaveLength(1);
  expect(circles[0].center).toEqual({ lat: family.area_lat, lng: family.area_lng });
  await act(async () => host.querySelector('#cp-area-map-head').click());
  expect(remove).toHaveBeenCalledWith(null);
});
