// ---------------------------------------------------------------------------
// The upload pipeline: prepare → sign → put ×3 → insert row. One photo at a
// time through prepare (it is the memory-hungry step on a phone), a few in
// flight through the network.
// ---------------------------------------------------------------------------
import { authHeaders } from './auth.js';
import { isVideo, prepareVideo } from './videos.js';
import { prepareImage } from './images.js';
import { getOwner, insertPhotos, uploadToSupabase, storageConfig, duplicateHashes } from './data.js';
import { fingerprint, isDuplicateError } from './duplicates.js';
import { IS_SCHOOL, HOUSE, MAX_FILE_MB, UPLOAD_PARALLEL } from './config.js';

const SIGN_CHUNK = 40;

function putWithProgress(url, blob, contentType, onBytes, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', contentType);
    let last = 0;
    xhr.upload.onprogress = (e) => { if (onBytes) { onBytes(e.loaded - last); last = e.loaded; } };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload cancelled'));
    if (signal) signal.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(blob);
  });
}

async function sign(eventSlug, items) {
  const r = await fetch('/api/vault-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ house: HOUSE.id, eventSlug, files: items.map((p) => ({ id: p.id, ext: p.ext, contentType: p.contentType })) }),
  });
  if (!r.ok) {
    let msg = `Could not get upload permission (${r.status})`;
    try { msg = (await r.json()).error || msg; } catch { /* keep */ }
    throw new Error(msg);
  }
  return r.json();
}

async function putAll(prepared, signed, mode, onBytes, signal) {
  const { keys, urls } = signed;
  const parts = [
    ['orig', prepared.orig, prepared.contentType],
    ['web', prepared.web, 'image/jpeg'],
    ['thumb', prepared.thumb, 'image/jpeg'],
  ];
  for (const [which, blob, ct] of parts) {
    if (mode === 'r2') await putWithProgress(urls[which], blob, ct, onBytes, signal);
    else { await uploadToSupabase(keys[which], blob, ct); if (onBytes) onBytes(blob.size); }
  }
}

/**
 * @param {File[]} files
 * @param {{event: {id:string, slug:string}, profile: {display_name:string}, onProgress?: Function, signal?: AbortSignal}} ctx
 */
export async function uploadBatch(files, { event, profile, onProgress, signal }) {
  await storageConfig();
  const owner = await getOwner();
  const state = {
    total: files.length, prepared: 0, uploaded: 0, failed: [], done: [], duplicates: [], checking: IS_SCHOOL, checked: 0,
    bytesTotal: files.reduce((n, f) => n + f.size, 0), bytesSent: 0, current: '',
  };
  const tick = () => onProgress && onProgress({ ...state });

  // 1. Prepare every file (sequentially — canvas work on a phone is the
  //    bottleneck and running it in parallel just trades speed for crashes).
  const ready = [];
  const candidates = [];
  const seen = new Set();
  for (const f of files) {
    if (signal?.aborted) break;
    try {
      if (f.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`Over ${MAX_FILE_MB}MB`);
      const hash = IS_SCHOOL ? await fingerprint(f) : null;
      if (hash && seen.has(hash)) { state.duplicates.push(f.name); state.prepared++; }
      else { candidates.push({ file: f, hash }); if (hash) seen.add(hash); }
    } catch (e) { state.failed.push({ name: f.name, error: e.message }); state.prepared++; }
    state.checked++;
    tick();
  }
  const existing = IS_SCHOOL && candidates.length
    ? await duplicateHashes(event.id, candidates.map(c => c.hash)) : new Set();
  state.checking = false;
  tick();
  for (const { file: f, hash } of candidates) {
    if (signal?.aborted) break;
    state.current = f.name;
    tick();
    if (hash && existing.has(hash)) {
      state.duplicates.push(f.name);
      state.prepared++; tick();
      continue;
    }
    try {
      ready.push({ ...await (isVideo(f) ? prepareVideo(f) : prepareImage(f, { optimize: IS_SCHOOL })), contentHash: hash });
    } catch (e) {
      state.failed.push({ name: f.name, error: e.message || 'Could not read' });
    }
    state.prepared++;
    tick();
  }
  // Sizes changed after prepare (thumb + web are extra bytes; HEIC may shrink).
  state.bytesTotal = ready.reduce((n, p) => n + p.orig.size + p.web.size + p.thumb.size, 0);
  state.bytesSent = 0;
  tick();

  // 2. Sign in chunks, 3. upload a few at a time, 4. insert rows per photo.
  for (let i = 0; i < ready.length; i += SIGN_CHUNK) {
    if (signal?.aborted) break;
    const chunk = ready.slice(i, i + SIGN_CHUNK);
    const { mode, items } = await sign(event.slug, chunk);
    const byId = new Map(items.map((it) => [it.id, it]));

    let cursor = 0;
    const worker = async () => {
      while (cursor < chunk.length && !signal?.aborted) {
        const p = chunk[cursor++];
        const s = byId.get(p.id);
        state.current = p.name;
        try {
          await putAll(p, s, mode, (n) => { state.bytesSent += n; tick(); }, signal);
          const [row] = await insertPhotos([{
            ...(p.contentHash ? { content_hash: p.contentHash } : {}),
            id: p.id,
            event_id: event.id,
            house: HOUSE.id,
            owner,
            uploader_name: profile?.display_name || '',
            storage: mode,
            key: s.keys.orig, web_key: s.keys.web, thumb_key: s.keys.thumb,
            width: p.width, height: p.height, bytes: p.orig.size,
            content_type: p.contentType,
            taken_at: p.takenAt ? p.takenAt.toISOString() : null,
          }]);
          state.done.push(row);
        } catch (e) {
          if (isDuplicateError(e)) state.duplicates.push(p.name);
          else state.failed.push({ name: p.name, error: e.message || 'Upload failed' });
        }
        state.uploaded++;
        tick();
      }
    };
    await Promise.all(Array.from({ length: Math.min(UPLOAD_PARALLEL, chunk.length) }, worker));
  }
  state.current = '';
  state.finished = true;
  tick();
  return state;
}
