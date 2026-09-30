import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('./auth.js', () => ({ supabase: { rpc: vi.fn() } }));
vi.mock('./zipstream.js', () => ({ zipStream: vi.fn(() => new ReadableStream({ start(c) { c.close(); } })), saveStream: vi.fn(async () => 'blob') }));
import { supabase } from './auth.js';
import { saveStream } from './zipstream.js';
import { adminShare, recipientShare, shareEntries, shareUrl, downloadShare } from './capsuleShare.js';

beforeEach(() => { vi.clearAllMocks(); });
describe('capsule share links', () => {
  it('uses the runtime origin and a token-only path', () => {
    expect(shareUrl('a'.repeat(64))).toBe(`${window.location.origin}/share/${'a'.repeat(64)}`);
  });
  it('passes admin actions to the authorized RPC and surfaces errors', async () => {
    supabase.rpc.mockResolvedValueOnce({ data: { enabled: false } });
    await expect(adminShare('capsule', 'update', 'secret', { enabled: false })).resolves.toEqual({ enabled: false });
    expect(supabase.rpc).toHaveBeenCalledWith('capsule_share_admin', { p_event: 'capsule', p_action: 'update', p_pass: 'secret', p_patch: { enabled: false } });
    supabase.rpc.mockResolvedValueOnce({ error: new Error('Denied') });
    await expect(adminShare('capsule')).rejects.toThrow('Denied');
  });
  it('works anonymously and rejects expired or missing capabilities', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => null }));
    await expect(recipientShare('token')).rejects.toThrow('unavailable');
    const options = fetch.mock.calls[0][1];
    expect(options.cache).toBe('no-store');
    expect(options.headers.Authorization).toBe(`Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`);
    expect(JSON.parse(options.body)).toEqual({ p_token: 'token', p_action: 'info', p_quality: null, p_receipt: null });
  });
  it('uses only selected rendition keys, preserves videos and rejects invalid paths', async () => {
    globalThis.fetch = vi.fn(async () => new Response('photo'));
    const entries = shareEntries([{ key: 'rcap/2026-27/a/web.jpg', storage: 'r2' }, { key: 'amistad/a/orig.mp4', storage: 'r2' }], { r2: 'https://media.example/' });
    expect(entries.map(e => e.name)).toEqual(['00001.jpg', '00002.mp4']);
    await entries[0].open();
    expect(fetch).toHaveBeenCalledWith('https://media.example/rcap/2026-27/a/web.jpg');
    expect(() => shareEntries([{ key: 'rcap/../secret.jpg', storage: 'r2' }], { r2: 'https://media.example' })).toThrow('unavailable');
    expect(() => shareEntries([{ key: 'rcap/a/web.jpg', storage: 'r2' }], {})).toThrow('unavailable');
  });
  it('never counts a ZIP that fails to save', async () => {
    globalThis.fetch = vi.fn(async (url, opts) => url.includes('/rpc/') ? { ok: true, json: async () => ({ title: 'Capsule', files: [{ key: 'rcap/a/web.jpg', storage: 'r2' }], receipt: 'receipt' }) } : { ok: true, json: async () => ({ mode: 'r2', publicBase: 'https://media.example' }) });
    saveStream.mockRejectedValueOnce(new Error('disk full'));
    await expect(downloadShare('token', 'web', vi.fn())).rejects.toThrow('disk full');
    expect(fetch.mock.calls.filter(([, opts]) => opts?.body && JSON.parse(opts.body).p_action === 'complete')).toHaveLength(0);
  });
  it('counts once after saving and reports completion', async () => {
    globalThis.fetch = vi.fn(async (url, opts) => url.includes('/rpc/') ? { ok: true, json: async () => JSON.parse(opts.body).p_action === 'complete' ? { ok: true } : { title: 'Capsule', files: [{ key: 'rcap/a/web.jpg', storage: 'r2' }], receipt: 'receipt' } } : { ok: true, json: async () => ({ mode: 'r2', publicBase: 'https://media.example' }) });
    const progress = vi.fn();
    await downloadShare('token', 'full', progress);
    expect(fetch.mock.calls.filter(([, opts]) => opts?.body && JSON.parse(opts.body).p_action === 'complete')).toHaveLength(1);
    expect(progress).toHaveBeenLastCalledWith({ files: 1, total: 1, done: true, counted: true });
  });
});
