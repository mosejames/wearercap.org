// ---------------------------------------------------------------------------
// Share cards for the M³ Vault. Same trick as api/vault-link.js: the app is a
// hash router, iMessage does not run JavaScript, so /m3-vault/e/<slug> is
// answered here with Open Graph tags for that one album, then the visitor is
// bounced into the hash route. The card image is the album's newest photo
// when it has one, and the vault image before that.
// ---------------------------------------------------------------------------

const SITE = 'https://wearercap.org';
const BASE = `${SITE}/m3-vault/`;
const VAULT = 'm3-2028';
const NAME = 'M³ Vault';
const CHROME = '#14213d';

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const SUPA = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const R2_BASE = (process.env.M3_R2_PUBLIC_BASE || '').replace(/\/+$/, '');

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

async function describe(slug) {
  if (!SUPA || !KEY || !slug) return null;
  const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  const get = (path) =>
    fetch(`${SUPA}/rest/v1/${path}`, { headers, signal: AbortSignal.timeout(2500) })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);

  const rows = await get(`m3_events?slug=eq.${encodeURIComponent(slug)}&vault=eq.${VAULT}&select=id,slug,title,blurb,kind,starts_on,starts_at,ongoing,hidden&limit=1`);
  const ev = rows && rows[0];
  if (!ev || ev.hidden) return null;
  const [stats, newest] = await Promise.all([
    get(`m3_event_stats?event_id=eq.${ev.id}&select=photo_count,contributor_count&limit=1`),
    get(`m3_photos?event_id=eq.${ev.id}&kind=eq.photo&select=storage,web_key&order=created_at.desc&limit=1`),
  ]);
  const s = (stats && stats[0]) || {};
  const p = newest && newest[0];
  let image = null;
  if (p) image = p.storage === 'r2' && R2_BASE ? `${R2_BASE}/${p.web_key}` : `${SUPA}/storage/v1/object/public/m3-media/${p.web_key}`;
  return { ...ev, photos: Number(s.photo_count || 0), people: Number(s.contributor_count || 0), image };
}

export default async function handler(req, res) {
  const slug = String((req.query && req.query.slug) || '').trim();
  const ev = await describe(slug);
  const dest = ev ? `${BASE}#/e/${encodeURIComponent(ev.slug)}` : BASE;
  const canonical = `${SITE}${String(req.url || '').split('?')[0]}`;

  let title = NAME;
  let og = 'Mall Math Marathon: every photo, one place';
  let desc = 'Class of 2028 at Lenox Mall. Add what you shoot as the day happens.';
  let img = `${SITE}/m3-vault-og.png?v=1`;
  let alt = 'M³ Vault. One class, one day, every photo.';

  if (ev) {
    title = `${ev.title} · ${NAME}`;
    og = `${ev.title}: add your photos`;
    alt = `${ev.title}, M³ Vault`;
    const count = ev.photos
      ? `${plural(ev.photos, 'photo')} in so far from ${plural(ev.people, 'chaperone')}.`
      : 'No photos yet. Be the first.';
    desc = [ev.blurb, count].filter(Boolean).join(' ');
    if (ev.image) img = ev.image;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=120, stale-while-revalidate=600');
  res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="${CHROME}" />
    <title>${esc(title)}</title>
    <meta name="robots" content="noindex, nofollow" />
    <meta name="description" content="${esc(desc)}" />
    <link rel="canonical" href="${esc(canonical)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(NAME)}" />
    <meta property="og:title" content="${esc(og)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:image" content="${esc(img)}" />
    <meta property="og:image:alt" content="${esc(alt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(og)}" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <meta name="twitter:image" content="${esc(img)}" />
    <meta http-equiv="refresh" content="0; url=${esc(dest)}" />
    <script>window.location.replace(${JSON.stringify(dest)});</script>
    <style>
      body{margin:0;display:grid;place-items:center;min-height:100vh;background:${CHROME};
        color:#fff;font:600 16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}
      a{color:#fff}
    </style>
  </head>
  <body>
    <p>Opening the M³ Vault. <a href="${esc(dest)}">Tap here</a> if nothing happens.</p>
  </body>
</html>`);
}
