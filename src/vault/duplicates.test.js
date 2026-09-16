import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
const deps = vi.hoisted(() => ({ prepareImage: vi.fn(), insertPhotos: vi.fn(), uploadToSupabase: vi.fn(), duplicateHashes: vi.fn() }));
vi.mock('./config.js', async importOriginal => ({ ...await importOriginal(), IS_SCHOOL: true }));
vi.mock('./images.js', () => ({ prepareImage: deps.prepareImage }));
vi.mock('./data.js', () => ({ getOwner: async () => 'owner', storageConfig: async () => ({}), ...deps }));
vi.mock('./auth.js', () => ({ authHeaders: async () => ({}) }));
import { uploadBatch } from './upload.js';
import { fingerprint } from './duplicates.js';
const context = { event: { id: 'event', slug: 'bingo-night' }, profile: { display_name: 'Test' } };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('crypto', webcrypto);
  deps.duplicateHashes.mockResolvedValue(new Set());
  deps.insertPhotos.mockImplementation(async rows => rows);
  let next = 0;
  deps.prepareImage.mockImplementation(async file => ({ id: String(++next), name: file.name, orig: file, web: file, thumb: file, ext: 'jpg', contentType: 'image/jpeg' }));
  vi.stubGlobal('fetch', vi.fn(async (_url, opts) => ({ ok: true, json: async () => ({ mode: 'supabase', items: JSON.parse(opts.body).files.map(f => ({ id: f.id, keys: { orig: f.id+'/orig.jpg', web: f.id+'/web.jpg', thumb: f.id+'/thumb.jpg' } })) }) })));
});
afterEach(() => vi.unstubAllGlobals());
const photo = (bytes, name = 'photo.jpg') => new File([bytes], name, { type: 'image/jpeg' });
it('fingerprints bytes, independently of the filename', async () => {
  expect(await fingerprint(photo('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  expect(await fingerprint(photo('abc','renamed.jpg'))).toBe(await fingerprint(photo('abc')));
  expect(await fingerprint(photo('abcd'))).not.toBe(await fingerprint(photo('abc')));
});
it('skips renamed duplicates in a batch while uploading distinct files', async () => {
  const result = await uploadBatch([photo('one'), photo('one','copy.jpg'), photo('two')], context);
  expect(result.done).toHaveLength(2);
  expect(result.duplicates).toEqual(['copy.jpg']);
  expect(deps.prepareImage).toHaveBeenCalledTimes(2);
  expect(result.done[0].content_hash).toBe(await fingerprint(photo('one')));
});
it('skips an existing event photo before preparation or storage transfer', async () => {
  const file=photo('existing');
  deps.duplicateHashes.mockResolvedValue(new Set([await fingerprint(file)]));
  const result=await uploadBatch([file],context);
  expect(deps.duplicateHashes).toHaveBeenCalledWith('event',[await fingerprint(file)]);
  expect(result.duplicates).toEqual(['photo.jpg']);
  expect(result.finished).toBe(true);
  expect(deps.prepareImage).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  expect(deps.uploadToSupabase).not.toHaveBeenCalled();
});
it('reports a simultaneous upload caught by the database as a duplicate', async () => {
  deps.insertPhotos.mockRejectedValueOnce({code:'23505',message:'duplicate key value violates unique constraint "vault_photos_event_content_hash_key"'});
  const result=await uploadBatch([photo('race')],context);
  expect(result.done).toEqual([]);
  expect(result.failed).toEqual([]);
  expect(result.duplicates).toEqual(['photo.jpg']);
});
it('stops if the duplicate check is unavailable instead of uploading unchecked', async () => {
  deps.duplicateHashes.mockRejectedValueOnce(new Error('Check unavailable'));
  await expect(uploadBatch([photo('one')],context)).rejects.toThrow('Check unavailable');
  expect(fetch).not.toHaveBeenCalled();
});
