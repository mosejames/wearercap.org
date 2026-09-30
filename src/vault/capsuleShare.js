import { zipStream, saveStream } from './zipstream.js';

export function shareUrl(token) {
  return new URL(`/share/${token}`, window.location.origin).href;
}
export async function adminShare(eventId, action = 'get', pass = '', patch = {}) {
  const { supabase } = await import('./auth.js');
  const { data, error } = await supabase.rpc('capsule_share_admin', {
    p_event: eventId, p_action: action, p_pass: pass, p_patch: patch,
  });
  if (error) throw error;
  return data;
}
// A separate anonymous REST call deliberately ignores any existing sign-in.
export async function recipientShare(token, action = 'info', quality = null, receipt = null) {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/capsule_share`, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token, p_action: action, p_quality: quality, p_receipt: receipt }),
  });
  const data = await response.json();
  if (!response.ok || !data) throw new Error('This link or download option is unavailable. It may have expired or been disabled.');
  return data;
}
export function shareEntries(files, bases) {
  return files.map((file, index) => {
    const base = bases[file.storage];
    if (!base || !file.key || file.key.includes('..') || !/^(rcap|amistad)\//.test(file.key)) {
      throw new Error('A saved file is unavailable. Please contact the capsule admin.');
    }
    const ext = file.key.split('.').pop().replace(/[^a-z0-9]/gi, '') || 'jpg';
    return {
      name: `${String(index + 1).padStart(5, '0')}.${ext}`, date: file.date,
      open: async () => {
        const response = await fetch(`${base.replace(/\/$/, '')}/${file.key}`);
        if (!response.ok) throw new Error(`Could not download file ${index + 1}. Please try again.`);
        return response;
      },
    };
  });
}
export async function downloadShare(token, quality, onProgress, destination) {
  const manifest = await recipientShare(token, 'start', quality);
  const response = await fetch('/api/vault-sign', { cache: 'no-store' });
  if (!response.ok) throw new Error('File storage is unavailable. Please try again.');
  const config = await response.json();
  const entries = shareEntries(manifest.files, {
    r2: config.mode === 'r2' ? config.publicBase : null,
    supabase: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/vault-media`,
  });
  const filename = `${manifest.title.replace(/[^a-z0-9]+/gi, '-').slice(0, 100)}-${quality}-quality.zip`;
  // Progress from the writer means all bytes were generated, not yet saved.
  const stream = zipStream(entries, { onProgress: p => onProgress({ ...p, done: false, total: entries.length }) });
  if (destination) await stream.pipeTo(destination);
  else if (await saveStream(stream, filename) === 'cancelled') return;
  // Failed or cancelled downloads never reach this completion receipt.
  let counted = true;
  try { await recipientShare(token, 'complete', null, manifest.receipt); } catch { counted = false; }
  onProgress({ files: entries.length, total: entries.length, done: true, counted });
}
