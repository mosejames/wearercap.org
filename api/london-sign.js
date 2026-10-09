import { AwsClient } from 'aws4fetch';
const VAULT = 'london-2028';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OWNER = /^[0-9a-f]{64}$/;
const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };
export function r2Config() {
  return { account: process.env.R2_ACCOUNT_ID, key: process.env.R2_ACCESS_KEY_ID, secret: process.env.R2_SECRET_ACCESS_KEY, bucket: process.env.R2_BUCKET, publicBase: (process.env.R2_PUBLIC_BASE || '').replace(/\/+$/, '') };
}
export function keysFor(slug, id, ext, owner) {
  const base = `${VAULT}/${owner.slice(0, 8)}/${slug}/${id}`;
  return { orig: `${base}/orig.${ext}`, web: `${base}/web.jpg`, thumb: `${base}/thumb.jpg` };
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const r2 = r2Config();
  if (!Object.values(r2).every(Boolean)) return res.status(503).json({ error: 'Photo storage is temporarily unavailable. Please try again later.' });
  if (req.method === 'GET') return res.status(200).json({ mode: 'r2', publicBase: r2.publicBase });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!OWNER.test(body?.owner || '') || !UUID.test(body?.eventId || '') || !Array.isArray(body?.files) || !body.files.length || body.files.length > 40) return res.status(400).json({ error: 'Please choose your photos again.' });
  for (const f of body.files) {
    if (!UUID.test(f.id || '') || !Object.hasOwn(TYPES, f.ext) || TYPES[f.ext] !== f.contentType) return res.status(400).json({ error: 'This file type is not supported.' });
  }
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return res.status(503).json({ error: 'The vault is temporarily unavailable.' });
  let event;
  try {
    const response = await fetch(`${url}/rest/v1/m3_events?id=eq.${body.eventId}&vault=eq.${VAULT}&hidden=eq.false&select=slug,ongoing,starts_on`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Album lookup failed');
    [event] = await response.json();
  } catch { return res.status(503).json({ error: 'Could not check this album. Please try again.' }); }
  if (!event || event.slug !== body.eventSlug || !/^[a-z0-9-]{1,60}$/.test(event.slug)) return res.status(403).json({ error: 'Please choose an open London trip album.' });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (!event.ongoing && event.starts_on > today) return res.status(403).json({ error: 'This album is not open yet.' });
  const aws = new AwsClient({ accessKeyId: r2.key, secretAccessKey: r2.secret, service: 's3', region: 'auto' });
  async function sign(key, contentType) {
    const target = new URL(`https://${r2.account}.r2.cloudflarestorage.com/${r2.bucket}/${key}`);
    target.searchParams.set('X-Amz-Expires', '900');
    const signed = await aws.sign(new Request(target, { method: 'PUT', headers: { 'Content-Type': contentType } }), { aws: { signQuery: true } });
    return signed.url;
  }
  try {
    const items = await Promise.all(body.files.map(async (f) => {
      const keys = keysFor(event.slug, f.id, f.ext, body.owner);
      return { id: f.id, keys, urls: { orig: await sign(keys.orig, f.contentType), web: await sign(keys.web, 'image/jpeg'), thumb: await sign(keys.thumb, 'image/jpeg') } };
    }));
    return res.status(200).json({ mode: 'r2', publicBase: r2.publicBase, items });
  } catch { return res.status(503).json({ error: 'Could not prepare photo storage. Please try again.' }); }
}
