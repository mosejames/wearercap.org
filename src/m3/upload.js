// ---------------------------------------------------------------------------
// The upload pipeline: prepare → sign → put ×3 → insert row. One file at a
// time through prepare (the memory-hungry step on a phone), a few in flight
// through the network. Image and video preparation are the same modules the
// Amistad Vault uses; only the signing and the row differ.
// ---------------------------------------------------------------------------
import { isVideo, prepareVideo } from '../vault/videos.js';
import { prepareImage } from '../vault/images.js';
import { getOwner, insertPhotos, uploadToSupabase, storageConfig } from './data.js';
import { VAULT, MAX_FILE_MB, UPLOAD_PARALLEL } from './config.js';

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

async function sign(event, owner, items) {
  const r = await fetch('/api/m3-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventId: event.id, eventSlug: event.slug, owner,
      files: items.map((p) => ({ id: p.id, ext: p.ext, contentType: p.contentType })),
    }),
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
 * @param {{event, profile, caption?: string, onProgress?: Function, signal?: AbortSignal}} ctx
 */
export async function uploadBatch(files, { event, profile, caption = '', onProgress, signal }) {
  await storageConfig();
  const owner = await getOwner();
  const state = {
    total: files.length, prepared: 0, uploaded: 0, failed: [], done: [],
    bytesTotal: files.reduce((n, f) => n + f.size, 0), bytesSent: 0, current: '',
  };
  const tick = () => onProgress && onProgress({ ...state });

  const ready = [];
  for (const f of files) {
    if (signal?.aborted) break;
    state.current = f.name;
    tick();
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      state.failed.push({ name: f.name, error: `Over ${MAX_FILE_MB}MB` });
      state.prepared++; tick();
      continue;
    }
    try {
      const video = isVideo(f);
      const p = await (video ? prepareVideo(f) : prepareImage(f));
      ready.push({ ...p, video });
    } catch (e) {
      state.failed.push({ name: f.name, error: e.message || 'Could not read' });
    }
    state.prepared++;
    tick();
  }
  state.bytesTotal = ready.reduce((n, p) => n + p.orig.size + p.web.size + p.thumb.size, 0);
  state.bytesSent = 0;
  tick();

  for (let i = 0; i < ready.length; i += SIGN_CHUNK) {
    if (signal?.aborted) break;
    const chunk = ready.slice(i, i + SIGN_CHUNK);
    const { mode, items } = await sign(event, owner, chunk);
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
            id: p.id,
            event_id: event.id,
            vault: VAULT.id,
            owner,
            uploader_name: profile?.displayName || '',
            kind: p.video ? 'video' : 'photo',
            storage: mode,
            key: s.keys.orig, web_key: s.keys.web, thumb_key: s.keys.thumb,
            width: p.width, height: p.height, bytes: p.orig.size,
            content_type: p.contentType,
            taken_at: p.takenAt ? p.takenAt.toISOString() : null,
            caption: caption.slice(0, 280),
          }]);
          state.done.push(row);
        } catch (e) {
          state.failed.push({ name: p.name, error: e.message || 'Upload failed' });
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
