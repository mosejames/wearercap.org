import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import Playlist from './Playlist.jsx';
import * as api from '../api.js';
vi.mock('../api.js', () => ({ loadSongs: vi.fn(), submitSong: vi.fn() }));
let root, container;
const song = { id: 'one', title: 'Candy', artist: 'Cameo', wall_name: 'Parent P.', house: 'reveur', from_thread: true };
const props = { slug: 'karaoke-sept-27', token: 'test-token', going: true, event: { status: 'open' }, onRsvp: vi.fn() };
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  api.loadSongs.mockResolvedValue([song]); api.submitSong.mockResolvedValue('saved');
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = async (p = {}) => act(async () => { root.render(<Playlist {...props} {...p} />); });
async function fill(id, value) {
  await act(async () => {
    const input = container.querySelector(id);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const submit = async () => act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
it('shows attributed songs and keeps artist mentions distinct', async () => {
  await render();
  expect(container.querySelector('.rv-songs').textContent).toContain('CandyCameo');
  expect(container.querySelector('.rv-songs').textContent).toContain('From the Thread · Parent P.');
  expect(container.querySelector('.rv-artist-mentions').textContent).toContain('Keith Sweat');
});
it('opens RSVP without submitting a song when parent is not recognized', async () => {
  await render({ going: false });
  const button = [...container.querySelectorAll('button')].find(b => b.textContent === 'RSVP to add your song');
  await act(async () => button.click());
  expect(props.onRsvp).toHaveBeenCalled(); expect(api.submitSong).not.toHaveBeenCalled();
});
it('submits separate title and artist, then refreshes and clears fields', async () => {
  await render(); await fill('#song-title', '  Best Part '); await fill('#song-artist', ' H.E.R. '); await submit();
  expect(api.submitSong).toHaveBeenCalledWith(props.slug, props.token, 'Best Part', 'H.E.R.');
  expect(container.querySelector('#song-title').value).toBe('');
  expect(container.textContent).toContain('Your song is in the mix');
  expect(api.loadSongs).toHaveBeenCalledTimes(2);
});
it('keeps input and displays a useful error on duplicate rejection', async () => {
  api.submitSong.mockRejectedValue({ message: 'duplicate_song' });
  await render(); await fill('#song-title', 'Candy'); await fill('#song-artist', 'Cameo'); await submit();
  expect(container.querySelector('[role="alert"]').textContent).toContain('already added');
  expect(container.querySelector('#song-title').value).toBe('Candy');
});
it('closes submissions for a closed event', async () => {
  await render({ event: { status: 'closed' } });
  expect(container.querySelector('input')).toBeNull(); expect(container.textContent).toContain('submissions are closed');
});
it('keeps the form available when the song feed fails', async () => {
  api.loadSongs.mockRejectedValue(new Error('offline'));
  await render();
  expect(container.textContent).toContain('could not load'); expect(container.querySelector('#song-title')).not.toBeNull();
});
