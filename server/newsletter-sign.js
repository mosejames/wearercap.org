// Photo upload signing for the RCAP newsletter builder.
//
//   POST /api/newsletter-sign  { issueId, files: [{ id }] }  (Bearer = Supabase session)
//   → { publicBase, items: [{ id, key, url }] }
//
// Reached through the existing /api/m3-sign function (vercel.json rewrite) so
// the deployment stays inside the hosting function limit. The caller must be
// an invited newsletter editor: rcap_newsletter('upload_ok') runs with their
// own token, so the database decides. Photos go to the shared R2 bucket only;
// there is no Supabase Storage fallback, matching every other vault.
import { AwsClient } from 'aws4fetch';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FILES = 12;

export function r2Config() {
  return {
    account: process.env.R2_ACCOUNT_ID,
    key: process.env.R2_ACCESS_KEY_ID,
    secret: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET,
    publicBase: (process.env.R2_PUBLIC_BASE || '').replace(/\/+$/, ''),
  };
}

export const keyFor = (issueId, id) => `newsletter/${issueId.toLowerCase()}/${id.toLowerCase()}.jpg`;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const r2 = r2Config();
  if (!Object.values(r2).every(Boolean)) return res.status(503).json({ error: 'Photo storage is unavailable right now. Paste an image link instead, or try again later.' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const files = body?.files;
  if (!UUID.test(body?.issueId || '') || !Array.isArray(files) || !files.length || files.length > MAX_FILES || files.some((f) => !UUID.test(f?.id || ''))) {
    return res.status(400).json({ error: 'Please choose your photo again.' });
  }
  const authorization = req.headers?.authorization || req.headers?.Authorization;
  if (!authorization?.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in to add photos.' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) return res.status(503).json({ error: 'The builder is unavailable right now.' });
  try {
    const r = await fetch(`${url}/rest/v1/rpc/rcap_newsletter`, {
      method: 'POST',
      headers: { apikey: anon, Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_action: 'upload_ok', p_payload: { id: body.issueId } }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok || (await r.json()) !== true) return res.status(403).json({ error: 'Only invited RCAP officers can add photos to this issue.' });
  } catch {
    return res.status(503).json({ error: 'Could not check your access. Please try again.' });
  }
  const aws = new AwsClient({ accessKeyId: r2.key, secretAccessKey: r2.secret, service: 's3', region: 'auto' });
  try {
    const items = await Promise.all(files.map(async (f) => {
      const key = keyFor(body.issueId, f.id);
      const target = new URL(`https://${r2.account}.r2.cloudflarestorage.com/${r2.bucket}/${key}`);
      target.searchParams.set('X-Amz-Expires', '900');
      const signed = await aws.sign(new Request(target, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' } }), { aws: { signQuery: true } });
      return { id: f.id, key, url: signed.url };
    }));
    return res.status(200).json({ publicBase: r2.publicBase, items });
  } catch {
    return res.status(503).json({ error: 'Could not prepare photo storage. Please try again.' });
  }
}
