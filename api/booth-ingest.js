// ---------------------------------------------------------------------------
// Booth ingest: Snappic session webhook → RCAP Capsule album.
//
// Snappic POSTs one session webhook per capture. This verifies the HMAC,
// downloads the capture, builds the same three renditions the browser client
// makes (original, 1800px web JPEG, 560px thumb JPEG), stores them through
// the existing /api/vault-sign flow as the booth contributor, and inserts the
// photo row into tonight's open RCAP event. Photos land in the album live.
//
//   POST /api/booth-ingest   (Snappic webhook target)
//
// Env: SNAPPIC_WEBHOOK_SECRET, SUPABASE_BOOTH_REFRESH_TOKEN,
//      VITE_SUPABASE_URL / SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
//
// The booth is a real vault contributor (phone-verified Supabase user whose
// refresh token lives in env). Acting as a user keeps every existing gate:
// vault_reserve_uploads, the 200/hour limit, the open-album check, and the
// house stamping trigger. Turn OFF refresh-token rotation in the Supabase
// dashboard so the stored refresh token stays valid.
//
// Idempotency: the photo id is a deterministic UUID v5 of the Snappic
// session id, so a Snappic retry (it retries on non-2xx) can never double
// post. The row is checked before any work happens.
// ---------------------------------------------------------------------------

import crypto from 'node:crypto';
import sharp from 'sharp';

export const config = { api: { bodyParser: false } };

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const WEBHOOK_SECRET = process.env.SNAPPIC_WEBHOOK_SECRET || '';
const BOOTH_REFRESH_TOKEN = process.env.SUPABASE_BOOTH_REFRESH_TOKEN || '';

const HOUSE = 'rcap';
const WEB_MAX = 1800;   // long edge, px — matches src/vault/config.js
const THUMB_MAX = 560;  // long edge, px — matches src/vault/config.js
const MAX_BYTES = 50 * 1024 * 1024;

/** Deterministic photo id from the Snappic session id. UUID v5. */
export function photoIdFor(sessionId) {
  const ns = Buffer.from('6ba7b8109dad11d180b400c04fd430c', 'hex');
  const digest = crypto.createHash('sha1').update(ns).update(`snappic-session:${sessionId}`).digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const h = digest.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** X-Signature is HMAC-SHA256 of the raw body. Accept hex or base64. */
export function verifySignature(rawBody, header, secret = WEBHOOK_SECRET) {
  if (!secret || !header) return false;
  const mac = crypto.createHmac('sha256', secret).update(rawBody).digest();
  for (const enc of ['hex', 'base64']) {
    let candidate;
    try { candidate = Buffer.from(String(header).trim(), enc); } catch { continue; }
    if (candidate.length === mac.length && crypto.timingSafeEqual(candidate, mac)) return true;
  }
  return false;
}

/** Pull the fields we need out of the Snappic payload, tolerating shape drift. */
export function parseSession(body) {
  const s = body?.session && typeof body.session === 'object' ? body.session : body || {};
  const directUrl = s.direct_url || s.directUrl || body?.direct_url;
  const id = s.id || s.session_id || body?.session_id;
  const type = String(s.type || s.session_type || body?.session_type || 'photo').toLowerCase();
  return { directUrl, id, type };
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Booth session, refreshed from the stored refresh token and cached in memory
// for the life of the serverless container.
let boothSession = null;
async function boothToken() {
  if (boothSession && boothSession.expiresAt > Date.now() + 60_000) return boothSession.accessToken;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: BOOTH_REFRESH_TOKEN }),
  });
  if (!r.ok) throw new Error(`booth session refresh failed (${r.status})`);
  const j = await r.json();
  boothSession = { accessToken: j.access_token, expiresAt: Date.now() + (j.expires_in || 3600) * 1000 };
  return boothSession.accessToken;
}

function rest(path, token, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function findTonightsEvent() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const r = await rest(
    `vault_events?house=eq.${HOUSE}&open=eq.true&hidden=eq.false&starts_on=eq.${today}&select=id,slug,title`,
  );
  if (!r.ok) throw new Error(`event lookup failed (${r.status})`);
  const events = await r.json();
  return events.length === 1 ? events[0] : null;
}

async function download(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal });
    if (!r.ok) {
      const source = new URL(url);
      console.error('booth-ingest: media download failed', r.status, source.origin + source.pathname);
      throw new Error(`download failed (${r.status})`);
    }
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error('file over 50MB');
    return { buf, contentType: (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() };
  } finally {
    clearTimeout(t);
  }
}

function extFor(contentType) {
  if (contentType === 'image/gif') return 'gif';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

async function renditions(buf, isGif) {
  // GIF: keep the animation as the original, stills for web/thumb.
  const web = await sharp(buf, { animated: false })
    .resize({ width: WEB_MAX, height: WEB_MAX, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 }).toBuffer();
  const thumb = await sharp(buf, { animated: false })
    .resize({ width: THUMB_MAX, height: THUMB_MAX, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 }).toBuffer();
  return { web, thumb };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!SUPABASE_URL || !ANON_KEY || !WEBHOOK_SECRET || !BOOTH_REFRESH_TOKEN) {
    console.error('booth-ingest: missing env (SNAPPIC_WEBHOOK_SECRET / SUPABASE_BOOTH_REFRESH_TOKEN / Supabase pair)');
    return res.status(500).json({ error: 'Ingest not configured' });
  }

  let raw;
  try {
    raw = await readRawBody(req);
  } catch {
    return res.status(400).json({ error: 'Could not read body' });
  }
  if (!verifySignature(raw, req.headers['x-signature'])) {
    return res.status(401).json({ error: 'Bad signature' });
  }

  let body;
  try { body = JSON.parse(raw.toString('utf8')); }
  catch { return res.status(200).json({ ok: false, skipped: 'not-json' }); }

  const { directUrl, id: sessionId, type } = parseSession(body);
  if (!directUrl || !sessionId) {
    console.warn('booth-ingest: unrecognized payload shape', Object.keys(body || {}));
    return res.status(200).json({ ok: false, skipped: 'unknown-shape' });
  }
  if (/video|boomerang/.test(type)) {
    return res.status(200).json({ ok: true, skipped: 'video' });
  }

  const photoId = photoIdFor(String(sessionId));

  try {
    // 1. Idempotency: a Snappic retry must never double post.
    const dup = await rest(`vault_photos?id=eq.${photoId}&select=id`);
    if (dup.ok && (await dup.json()).length) {
      return res.status(200).json({ ok: true, duplicate: true, photoId });
    }

    // 2. Tonight's album. Nothing open means nothing to do; 200 stops retries.
    const event = await findTonightsEvent();
    if (!event) {
      console.warn('booth-ingest: no single open rcap event today');
      return res.status(200).json({ ok: false, skipped: 'no-open-event' });
    }

    // 3. The capture.
    const { buf, contentType } = await download(directUrl);
    if (!contentType.startsWith('image/')) {
      return res.status(200).json({ ok: false, skipped: `not-image:${contentType}` });
    }
    const isGif = contentType === 'image/gif';
    const ext = extFor(contentType);
    const meta = await sharp(buf, { animated: false }).metadata();
    const { web, thumb } = await renditions(buf, isGif);

    // 4. Booth identity, then sign through the same gate the browser uses.
    const token = await boothToken();
    const actorRes = await rest('rpc/vault_actor', token, { method: 'POST', body: '{}' });
    if (!actorRes.ok) throw new Error('booth account cannot upload');
    const owner = await actorRes.json();
    if (!owner) throw new Error('booth account cannot upload');

    const base = `https://${req.headers.host}`;
    const signRes = await fetch(`${base}/api/vault-sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        house: HOUSE,
        eventSlug: event.slug,
        files: [{ id: photoId, ext, contentType: isGif ? 'image/gif' : contentType }],
      }),
    });
    if (!signRes.ok) {
      const errBody = await signRes.text().catch(() => '');
      console.error('booth-ingest: sign failed', signRes.status, errBody.slice(0, 200));
      return res.status(200).json({ ok: false, skipped: `sign:${signRes.status}` });
    }
    const { mode, items } = await signRes.json();
    const item = (items || [])[0];
    if (mode !== 'r2' || !item?.urls) throw new Error(`unexpected storage mode: ${mode}`);

    // 5. Store the three renditions.
    const puts = [
      [item.urls.orig, buf, isGif ? 'image/gif' : contentType],
      [item.urls.web, web, 'image/jpeg'],
      [item.urls.thumb, thumb, 'image/jpeg'],
    ];
    await Promise.all(puts.map(async ([url, data, ct]) => {
      const p = await fetch(url, { method: 'PUT', headers: { 'Content-Type': ct }, body: data });
      if (!p.ok) throw new Error(`put failed (${p.status})`);
    }));

    // 6. The photo row. The trigger stamps house, rca_house, uploader_name.
    const ins = await rest('vault_photos', token, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        id: photoId,
        event_id: event.id,
        house: HOUSE,
        owner,
        uploader_name: 'OMG Booth',
        storage: mode,
        key: item.keys.orig,
        web_key: item.keys.web,
        thumb_key: item.keys.thumb,
        width: meta.width || null,
        height: meta.height || null,
        bytes: buf.length,
        content_type: isGif ? 'image/gif' : contentType,
        taken_at: new Date().toISOString(),
      }),
    });
    if (!ins.ok) {
      const errBody = await ins.text().catch(() => '');
      throw new Error(`insert failed (${ins.status}): ${errBody.slice(0, 200)}`);
    }

    console.log(`booth-ingest: photo ${photoId} → ${event.slug}`);
    return res.status(200).json({ ok: true, photoId, event: event.slug });
  } catch (e) {
    // 500 makes Snappic retry. Retries are idempotent (step 1), so a retry
    // storm cannot double post; it just replays the failed capture.
    console.error('booth-ingest: failed', e?.message || e);
    return res.status(500).json({ ok: false, error: 'ingest failed' });
  }
}
