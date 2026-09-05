// ---------------------------------------------------------------------------
// Upload signing for the Amistad Vault.
//
// The browser never holds a storage credential. It asks here for permission to
// put three objects (original, web, thumb) for each photo, and this answers
// with where they go and, for R2, a presigned PUT URL for each.
//
//   GET  /api/vault-sign             → { mode, publicBase }   (no auth; app config)
//   POST /api/vault-sign             → { mode, publicBase, items: [...] }
//        { eventSlug, files: [{ id, ext, contentType }] }
//
// A verified, unbanned contributor is required for every signing request.
// Presigned URLs live fifteen minutes and only allow PUT to one exact key.
//
// Two storage modes, chosen by env:
//
//   r2        Cloudflare R2. Needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
//             R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE. Bytes are
//             stored for ~$0.015/GB/month with free egress, which is what
//             makes "thousands of originals" affordable.
//   supabase  Supabase Storage bucket `vault-media`. Zero setup; the client
//             uploads with its own session and Storage RLS. Free tier is 1GB,
//             so this is the on-ramp, not the destination.
//
// VAULT_STORAGE forces a mode. Unset, it is r2 when the R2 vars exist and
// supabase otherwise, so flipping to R2 is: add five env vars, redeploy.
// ---------------------------------------------------------------------------

import { AwsClient } from 'aws4fetch';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;

const R2 = {
  account: process.env.R2_ACCOUNT_ID,
  key: process.env.R2_ACCESS_KEY_ID,
  secret: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET || 'ami-vault',
  publicBase: (process.env.R2_PUBLIC_BASE || '').replace(/\/+$/, ''),
};

const HOUSE = 'amistad';
const YEAR = '2026-27';
const MAX_FILES = 40;               // per request; the client batches
const URL_TTL = 15 * 60;            // presigned PUT lifetime, seconds
const EXT_OK = /^(jpg|jpeg|png|heic|heif|webp|gif|mp4|mov|webm)$/i;

export function mode() {
  const forced = (process.env.VAULT_STORAGE || '').toLowerCase();
  if (forced === 'r2' || forced === 'supabase') return forced;
  return R2.account && R2.key && R2.secret && R2.publicBase ? 'r2' : 'supabase';
}

// In supabase mode the client already knows its own storage base, so a missing
// SUPABASE_URL here is not fatal — it only matters for R2.
function publicBase(m) {
  if (m === 'r2') return R2.publicBase;
  return SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/vault-media` : null;
}

// Object keys. One folder per photo so the three renditions travel together.
export function keysFor(eventSlug, id, ext, userId) {
  const slug = String(eventSlug || 'misc').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 60);
  const base = `${HOUSE}/${YEAR}/${userId}/${slug}/${id}`;
  return {
    orig: `${base}/orig.${ext}`,
    web: `${base}/web.jpg`,
    thumb: `${base}/thumb.jpg`,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function r2client() {
  return new AwsClient({
    accessKeyId: R2.key,
    secretAccessKey: R2.secret,
    service: 's3',
    region: 'auto',
  });
}

async function presignPut(client, key, contentType) {
  const url = new URL(`https://${R2.account}.r2.cloudflarestorage.com/${R2.bucket}/${key}`);
  url.searchParams.set('X-Amz-Expires', String(URL_TTL));
  const signed = await client.sign(new Request(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
  }), { aws: { signQuery: true } });
  return signed.url;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const m = mode();

  if (req.method === 'GET') {
    return res.status(200).json({ mode: m, publicBase: publicBase(m) });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const files = Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [];
  if (!files.length) return res.status(400).json({ error: 'No files' });

  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const authorization = req.headers?.authorization;
  if (!authorization?.startsWith('Bearer ')) return res.status(401).json({ error: 'Verify your mobile number before uploading.' });
  let userId;
  try {
    const headers = { apikey: key, Authorization: authorization, 'Content-Type': 'application/json' };
    const actor = await fetch(`${SUPABASE_URL}/rest/v1/rpc/vault_actor`, { method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(5000) });
    if (!actor.ok || !await actor.json()) return res.status(403).json({ error: 'This account cannot upload.' });
    const user = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers, signal: AbortSignal.timeout(5000) });
    if (!user.ok) return res.status(401).json({ error: 'Please sign in again.' });
    userId = (await user.json()).id;
    const reservation = await fetch(`${SUPABASE_URL}/rest/v1/rpc/vault_reserve_uploads`, {
      method: 'POST', headers, body: JSON.stringify({ p_slug: body.eventSlug, p_ids: files.map((f) => f.id) }), signal: AbortSignal.timeout(5000),
    });
    if (!reservation.ok) return res.status(403).json({ error: 'This album is closed, the upload limit was reached, or these files were already submitted. Please retry with a new selection.' });
    if (!UUID.test(userId)) return res.status(403).json({ error: 'Invalid account.' });
  } catch { return res.status(503).json({ error: 'Could not verify upload permission. Please retry.' }); }

  const client = m === 'r2' ? r2client() : null;
  const items = [];
  for (const f of files) {
    const id = String(f.id || '');
    const ext = String(f.ext || 'jpg').toLowerCase().replace(/^\./, '');
    const ct = String(f.contentType || 'image/jpeg');
    if (!UUID.test(id) || !EXT_OK.test(ext)) {
      return res.status(400).json({ error: `Bad file entry: ${id || '?'}.${ext}` });
    }
    const keys = keysFor(body.eventSlug, id, ext, userId);
    const item = { id, keys };
    if (client) {
      item.urls = {
        orig: await presignPut(client, keys.orig, ct),
        web: await presignPut(client, keys.web, 'image/jpeg'),
        thumb: await presignPut(client, keys.thumb, 'image/jpeg'),
      };
    }
    items.push(item);
  }

  return res.status(200).json({ mode: m, publicBase: publicBase(m), items });
}
