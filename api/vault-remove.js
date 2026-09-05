import { AwsClient } from 'aws4fetch';
// Authorization is decided in the database before any stored objects are deleted.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!/^[0-9a-f-]{36}$/i.test(body?.id || '')) return res.status(400).json({ error: 'Invalid upload' });
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const headers = { apikey: key, Authorization: req.headers.authorization || `Bearer ${key}`, 'Content-Type': 'application/json' };
  try {
    const r = await fetch(`${url}/rest/v1/rpc/vault_remove_upload`, {
      method: 'POST', headers, body: JSON.stringify({ p_id: body.id, p_pass: String(body.pass || '') }), signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return res.status(403).json({ error: 'You cannot remove this upload. Please sign in again.' });
    const media = await r.json();
    // Never accept object keys from the browser.
    if (!Array.isArray(media.keys) || media.keys.length !== 3 || media.keys.some((k) => !k.startsWith('amistad/') || k.includes('..'))) throw new Error('Invalid stored paths');
    if (media.storage === 'r2') {
      const client = new AwsClient({ accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
      for (const path of media.keys) {
        const response = await client.fetch(`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET || 'ami-vault'}/${path}`, { method: 'DELETE' });
        if (!response.ok && response.status !== 404) throw new Error('Storage deletion failed');
      }
    } else if (media.storage === 'supabase') {
      const response = await fetch(`${url}/storage/v1/object/vault-media`, {
        method: 'DELETE', headers: { ...headers, 'x-vault-admin-pass': String(body.pass || '') }, body: JSON.stringify({ prefixes: media.keys }), signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Storage deletion failed');
    } else throw new Error('Unknown storage');
    const finished = await fetch(`${url}/rest/v1/rpc/vault_finish_removal`, {
      method: 'POST', headers, body: JSON.stringify({ p_id: body.id, p_pass: String(body.pass || '') }), signal: AbortSignal.timeout(10000),
    });
    if (!finished.ok) throw new Error('Could not confirm cleanup');
    return res.status(200).json({ removed: true });
  } catch {
    return res.status(502).json({ error: 'The upload may already be hidden. File cleanup could not finish. Please retry removal.' });
  }
}
