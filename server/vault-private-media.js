const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Public media paths for locked albums are blocked at Cloudflare. Only a named,
// signed-in administrator can obtain short-lived S3 reads of existing objects.
export async function privateMediaRead(req, res, body, config) {
  res.setHeader('Cache-Control', 'no-store');
  const authorization = req.headers?.authorization;
  if (!authorization?.startsWith('Bearer ')) return res.status(401).json({ error: 'Administrator sign-in required.' });
  if (!Array.isArray(body.ids)) return res.status(400).json({ error: 'Invalid selection.' });
  const ids = [...new Set(body.ids)];
  if (!ids.length || ids.length > 80 || !ids.every(id => UUID.test(id))) return res.status(400).json({ error: 'Invalid selection.' });
  const headers = { apikey: config.apiKey, Authorization: authorization, 'Content-Type': 'application/json' };
  const get = async path => {
    const response = await fetch(`${config.supabase}/rest/v1/${path}`, { headers, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Access check failed');
    return response.json();
  };
  try {
    const roleResponse = await fetch(`${config.supabase}/rest/v1/rpc/vault_staff_role`, {
      method: 'POST', headers, body: '{}', signal: AbortSignal.timeout(5000),
    });
    if (!roleResponse.ok || !['owner', 'admin'].includes(await roleResponse.json())) return res.status(403).json({ error: 'Administrator access required.' });
    const photos = await get(`vault_photos?id=in.(${ids.join(',')})&hidden=eq.false&removed_at=is.null&select=id,event_id,house,storage,key,web_key,thumb_key`);
    const events = await get('vault_events?admin_only=eq.true&select=id,house');
    const locked = new Map(events.map(e => [e.id, e.house]));
    if (photos.length !== ids.length || photos.some(p => !locked.has(p.event_id) || locked.get(p.event_id) !== p.house || p.house !== 'amistad' || p.storage !== 'r2')) return res.status(403).json({ error: 'This selection is unavailable.' });
    const client = config.client();
    const items = await Promise.all(photos.map(async p => {
      const urls = {};
      for (const [rendition, key] of Object.entries({ orig: p.key, web: p.web_key, thumb: p.thumb_key })) {
        if (!key || !key.startsWith('amistad/2026-27/') || key.includes('..')) throw new Error('Invalid media key');
        const path = key.split('/').map(encodeURIComponent).join('/');
        const url = new URL(`https://${config.r2.account}.r2.cloudflarestorage.com/${config.r2.bucket}/${path}`);
        url.searchParams.set('X-Amz-Expires', '300');
        url.searchParams.set('response-cache-control', 'private, no-store');
        urls[rendition] = (await client.sign(new Request(url), { aws: { signQuery: true } })).url;
      }
      return { id: p.id, key: p.key, urls };
    }));
    return res.status(200).json({ items });
  } catch {
    return res.status(503).json({ error: 'Could not verify private gallery access. Please try again.' });
  }
}
