// ---------------------------------------------------------------------------
// Upload signing for the M³ Vault.
//
//   GET  /api/m3-sign   → { mode, publicBase }
//   POST /api/m3-sign   → { mode, publicBase, items: [{ id, keys, urls? }] }
//        { eventId, eventSlug, owner, files: [{ id, ext, contentType }] }
//
// No sign-in in this vault, so the gate is the album, not the person: the
// event must accept uploads (m3_can_upload, checked in the database) and the
// keys must fit the shape the storage policy allows. In supabase mode the
// browser uploads with the anon key under that policy; in r2 mode this hands
// back presigned PUT URLs good for fifteen minutes and one exact key each.
//
// Storage mode: r2 when M3_R2_* (or the shared R2_*) vars exist, else
// supabase. M3_STORAGE forces one. Flipping to R2 is env vars and a redeploy;
// rows remember which store they went to, so nothing is orphaned.
// ---------------------------------------------------------------------------

import { AwsClient } from 'aws4fetch';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const R2 = {
  account: process.env.M3_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID,
  key: process.env.M3_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID,
  secret: process.env.M3_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.M3_R2_BUCKET || 'm3-vault',
  publicBase: (process.env.M3_R2_PUBLIC_BASE || '').replace(/\/+$/, ''),
};

const VAULT = 'm3-2028';
const MAX_FILES = 40;
const URL_TTL = 15 * 60;
const EXT_OK = /^(jpg|jpeg|png|heic|heif|webp|gif|mp4|mov|webm)$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER = /^[0-9a-f]{64}$/;

export function mode() {
  const forced = (process.env.M3_STORAGE || '').toLowerCase();
  if (forced === 'r2' || forced === 'supabase') return forced;
  return R2.account && R2.key && R2.secret && R2.publicBase ? 'r2' : 'supabase';
}

function publicBase(m) {
  if (m === 'r2') return R2.publicBase;
  return SUPABASE_URL ? `${SUPABASE_URL}/storage/v1/object/public/m3-media` : null;
}

// One folder per upload so the three renditions travel together. The first
// eight hex of the owner hash groups a chaperone's files without naming them.
export function keysFor(eventSlug, id, ext, owner) {
  const slug = String(eventSlug || 'misc').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 60) || 'misc';
  const base = `${VAULT}/${owner.slice(0, 8)}/${slug}/${id}`;
  return { orig: `${base}/orig.${ext}`, web: `${base}/web.jpg`, thumb: `${base}/thumb.jpg` };
}

function r2client() {
  return new AwsClient({ accessKeyId: R2.key, secretAccessKey: R2.secret, service: 's3', region: 'auto' });
}

async function presignPut(client, key, contentType) {
  const url = new URL(`https://${R2.account}.r2.cloudflarestorage.com/${R2.bucket}/${key}`);
  url.searchParams.set('X-Amz-Expires', String(URL_TTL));
  const signed = await client.sign(new Request(url, { method: 'PUT', headers: { 'Content-Type': contentType } }), { aws: { signQuery: true } });
  return signed.url;
}

async function albumAccepts(eventId) {
  if (!SUPABASE_URL || !ANON || !UUID.test(String(eventId || ''))) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/m3_can_upload`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_event: eventId }),
      signal: AbortSignal.timeout(5000),
    });
    return r.ok && (await r.json()) === true;
  } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const m = mode();

  if (req.method === 'GET') return res.status(200).json({ mode: m, publicBase: publicBase(m) });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const files = Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [];
  if (!files.length) return res.status(400).json({ error: 'No files' });
  const owner = String(body?.owner || '');
  if (!OWNER.test(owner)) return res.status(400).json({ error: 'Add your name first.' });
  if (!(await albumAccepts(body?.eventId))) {
    return res.status(403).json({ error: 'This album opens on the day of the marathon. Around the Mall is open now.' });
  }

  const client = m === 'r2' ? r2client() : null;
  const items = [];
  for (const f of files) {
    const id = String(f.id || '');
    const ext = String(f.ext || 'jpg').toLowerCase().replace(/^\./, '');
    const ct = String(f.contentType || 'image/jpeg');
    if (!UUID.test(id) || !EXT_OK.test(ext)) return res.status(400).json({ error: `Bad file entry: ${id || '?'}.${ext}` });
    const keys = keysFor(body.eventSlug, id, ext, owner);
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
