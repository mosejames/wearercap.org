import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getToken, setToken, clearToken, isToken, adoptTokenFromUrl, privateLink,
  loadEvent, loadWall, loadMine, rsvp, cancel, comment, sendConfirmation, uploadPhoto, adminList,
} from './api.js';
import { supabase } from '../carpool/supabaseClient.js';

vi.mock('../carpool/supabaseClient.js', () => ({
  supabase: { rpc: vi.fn(), functions: { invoke: vi.fn() }, channel: vi.fn(), removeChannel: vi.fn() },
}));

const T = '0b6e3a52-3d6f-4f59-9a2f-5d0c7c3e9b11';

/* A plain in-memory Storage. Node 25 ships its own localStorage global that
   shadows jsdom's and has no clear(), so the test brings its own. */
function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', memoryStorage());
});

describe('tokens', () => {
  it('stores per event', () => {
    setToken('a', T);
    expect(getToken('a')).toBe(T);
    expect(getToken('b')).toBeNull();
    clearToken('a');
    expect(getToken('a')).toBeNull();
  });
  it('recognises uuids only', () => {
    expect(isToken(T)).toBe(true);
    expect(isToken('abc')).toBe(false);
    expect(isToken(null)).toBe(false);
  });
  it('adopts ?t= and strips it from the address bar', () => {
    const hist = { replaceState: vi.fn() };
    const t = adoptTokenFromUrl('k', { search: `?t=${T}&x=1`, pathname: '/rsvp/k', hash: '' }, hist);
    expect(t).toBe(T);
    expect(getToken('k')).toBe(T);
    expect(hist.replaceState).toHaveBeenCalledWith(null, '', '/rsvp/k?x=1');
  });
  it('falls back to the stored token and ignores junk in ?t=', () => {
    setToken('k', T);
    const hist = { replaceState: vi.fn() };
    expect(adoptTokenFromUrl('k', { search: '?t=nope', pathname: '/rsvp/k', hash: '' }, hist)).toBe(T);
    expect(hist.replaceState).not.toHaveBeenCalled();
  });
  it('builds the private link', () => {
    expect(privateLink('karaoke-sept-27', T, 'https://wearercap.org')).toBe(`https://wearercap.org/rsvp/karaoke-sept-27?t=${T}`);
  });
});

describe('rpc calls', () => {
  it('loads the event and wall by slug', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: { slug: 'k', going_count: 3 }, error: null });
    expect(await loadEvent('k')).toEqual({ slug: 'k', going_count: 3 });
    expect(supabase.rpc).toHaveBeenCalledWith('event_get', { p_slug: 'k' });
    supabase.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await loadWall('k')).toEqual([]);
  });
  it('does not ask for a row without a real token', async () => {
    expect(await loadMine('k', 'junk')).toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
  it('sends a null token on a first RSVP and the token on an edit', async () => {
    supabase.rpc.mockResolvedValue({ data: T, error: null });
    await rsvp('k', null, { full_name: 'A B' });
    expect(supabase.rpc).toHaveBeenLastCalledWith('event_rsvp_upsert', { p_slug: 'k', p_token: null, p_payload: { full_name: 'A B' } });
    expect(await rsvp('k', T, {})).toBe(T);
    expect(supabase.rpc).toHaveBeenLastCalledWith('event_rsvp_upsert', { p_slug: 'k', p_token: T, p_payload: {} });
  });
  it('throws database errors so the sheet can show them', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'duplicate_phone' } });
    await expect(rsvp('k', null, {})).rejects.toEqual({ message: 'duplicate_phone' });
  });
  it('cancels and comments by token', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await cancel(T);
    expect(supabase.rpc).toHaveBeenLastCalledWith('event_rsvp_cancel', { p_token: T });
    await comment(T, 'hi');
    expect(supabase.rpc).toHaveBeenLastCalledWith('event_comment_post', { p_token: T, p_body: 'hi' });
  });
  it('passes the passcode to the back office', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: { rsvps: [] }, error: null });
    await adminList('pw', 'k');
    expect(supabase.rpc).toHaveBeenCalledWith('event_admin_list', { p_pass: 'pw', p_slug: 'k' });
  });
});

describe('functions', () => {
  it('asks for the confirmation by token only', async () => {
    supabase.functions.invoke.mockResolvedValueOnce({ data: {}, error: null });
    await sendConfirmation(T);
    expect(supabase.functions.invoke).toHaveBeenCalledWith('event-confirm', { body: { kind: 'confirm', token: T } });
  });
  it('never throws when the email fails', async () => {
    supabase.functions.invoke.mockRejectedValueOnce(new Error('down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(sendConfirmation(T)).resolves.toBeUndefined();
    warn.mockRestore();
  });
  it('uploads the photo as base64 with the token', async () => {
    supabase.functions.invoke.mockResolvedValueOnce({ data: { photo_url: 'https://x/y.jpg' }, error: null });
    const url = await uploadPhoto(T, new Blob(['abc'], { type: 'image/jpeg' }));
    expect(url).toBe('https://x/y.jpg');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('event-photo', { body: { token: T, image: 'YWJj' } });
  });
});
