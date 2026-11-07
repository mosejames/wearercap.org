import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect, it, vi} from 'vitest';
import EngineMedia from './EngineMedia.jsx';

vi.mock('./client.js', () => ({
 authClient: () => ({auth: {getSession: async () => ({data: {session: {access_token: 'fixture'}}})}})
}));

it('finds a photo beyond the first moderation page and keeps DC group-free', async () => {
 const photos = Array.from({length: 501}, (_, index) => ({
  id: String(index), contributor: index === 500 ? 'Test upload' : 'Chaperone',
  state: 'visible', album: 'send-off', group: 'Mixed', thumb: '/thumb.jpg', web: '/web.jpg'
 }));
 const fetchMock = vi.fn(async (_url, request) => {
  const payload = JSON.parse(request.body);
  return {ok: true, json: async () => payload.action === 'moderation'
   ? {count: photos.length, photos: photos.slice(payload.offset, payload.offset + 100)}
   : {ok: true}};
 });
 vi.stubGlobal('fetch', fetchMock);
 const container = document.createElement('div');
 document.body.append(container);
 const root = createRoot(container);
 globalThis.IS_REACT_ACT_ENVIRONMENT = true;
 try {
  await act(async () => root.render(<EngineMedia live={{slug:'washington-dc-2030'}} groups={['Group A', 'Mixed']} onError={vi.fn()}/>));
  expect(container.querySelectorAll('article')).toHaveLength(24);
  expect(container.textContent).not.toContain('Photo group');
  const search = container.querySelector('input[type=search]');
  await act(async () => {
   Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(search, 'Test upload');
   search.dispatchEvent(new Event('input', {bubbles: true}));
  });
  expect(container.querySelectorAll('article')).toHaveLength(1);
  await act(async () => container.querySelector('article button').click());
  expect(JSON.parse(fetchMock.mock.lastCall[1].body)).toEqual({action:'admin-photo', id:'500', hidden:true});
  expect(container.querySelectorAll('article')).toHaveLength(0);
 } finally {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
 }
});
