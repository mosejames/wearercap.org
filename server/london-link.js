const SITE = 'https://wearercap.org';
const BASE = `${SITE}/2028-london/`;
const NAME = 'RCA 2028 Takes London';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esc = (value) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export default async function handler(req,res) {
  const rawSlug = String(req.query?.slug || '');
  const slug = /^[a-z0-9-]{1,60}$/.test(rawSlug) ? rawSlug : '';
  const id = String(req.query?.photo || '');
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const publicBase = (process.env.R2_PUBLIC_BASE || '').replace(/\/+$/,'');
  async function get(path, body) {
    if(!url || !key) return [];
    try { const r=await fetch(`${url}/rest/v1/${path}`,{method:body ? 'POST' : 'GET',headers:{apikey:key,Authorization:`Bearer ${key}`,...(body ? {'Content-Type':'application/json'} : {})},...(body ? {body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(3000)});return r.ok ? await r.json() : []; } catch { return []; }
  }
  const [event] = slug ? await get(`m3_events?slug=eq.${slug}&vault=eq.london-2028&hidden=eq.false&select=id,slug,title,hidden&limit=1`) : [];
  const validEvent = event && !event.hidden && event.slug === slug;
  let photo;
  if(validEvent && UUID.test(id)) {
    // Direct photo table reads are closed. Use the gallery's visibility RPC.
    const rows = await get('rpc/m3_list_photos', {p_token:'',p_vault:'london-2028',p_event:event.id,p_mode:'recent',p_limit:5000});
    const row = rows.find((entry) => entry.photo?.id === id)?.photo;
    if(row && row.id === id && row.event_id === event.id && row.vault === 'london-2028' && !row.hidden && row.storage === 'r2' && row.web_key?.startsWith('london-2028/') && !row.web_key.split('/').includes('..') && publicBase) photo=row;
  }
  const suffix = validEvent ? `e/${slug}${photo ? `/p/${photo.id}` : ''}` : '';
  const canonical = `${BASE}${suffix}`;
  const dest = `${BASE}${suffix ? `#/${suffix}` : ''}`;
  const title = photo ? `${event.title} · Class of 2028` : NAME;
  const desc = photo ? photo.caption || `A postcard from ${event.title}. Open this moment from the class adventure.` : 'Postcards from London and Paris. One class, many perspectives, a little window into their big adventure.';
  const image = photo ? `${publicBase}/${photo.web_key.split('/').map(encodeURIComponent).join('/')}` : `${SITE}/london/2028-london-og-v2.jpg`;
  const alt = photo ? `A shared moment from ${event.title}` : 'Ron Clark Academy Class of 2028 takes London. A postcard overlooking Big Ben and the River Thames.';
  res.setHeader('Content-Type','text/html; charset=utf-8');
  // Recheck visibility on each request. Removed photos must not stay in our cached cards.
  res.setHeader('Cache-Control','no-store');
  res.status(200).send(`<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${esc(title)}</title><meta name="robots" content="noindex,nofollow"/><meta name="description" content="${esc(desc)}"/><link rel="canonical" href="${esc(canonical)}"/><meta property="og:type" content="website"/><meta property="og:site_name" content="Ron Clark Academy · Class of 2028"/><meta property="og:title" content="${esc(title)}"/><meta property="og:description" content="${esc(desc)}"/><meta property="og:url" content="${esc(canonical)}"/><meta property="og:image" content="${esc(image)}"/><meta property="og:image:type" content="image/jpeg"/>${photo ? '' : '<meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/>'}<meta property="og:image:alt" content="${esc(alt)}"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${esc(title)}"/><meta name="twitter:description" content="${esc(desc)}"/><meta name="twitter:image" content="${esc(image)}"/><meta name="twitter:image:alt" content="${esc(alt)}"/><meta http-equiv="refresh" content="0; url=${esc(dest)}"/><script>window.location.replace(${JSON.stringify(dest)});</script></head><body><p>Opening the class postcards. <a href="${esc(dest)}">Open the album</a>.</p></body></html>`);
}
