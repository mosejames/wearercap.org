// ---------------------------------------------------------------------------
// Share cards for the Amistad Vault.
//
// The vault is a hash router, and a fragment never reaches the server. Text
// somebody `/ami-vault/#/e/welcome-party` and the scraper that builds the
// preview only ever sees the one static page: same picture, same headline,
// no clue which event it is. That is the same problem the Uniform Exchange
// has, and this is the same answer — see api/link.js.
//
//   /ami-vault/e/<slug>   an invitation to add photos to one event
//
// This answers with tags written for that event, then bounces a real visitor
// into the app. The old hash links still work exactly as they did.
//
// The picture: once an event has photos, the newest one IS the card, which is
// the whole pitch in one image. Before that it falls back to the house card.
// Deliberately no og:image:width/height on a real photo — declaring 1200x630
// for an image that is not 1200x630 makes scrapers crop it badly.
// ---------------------------------------------------------------------------

const SITE = 'https://wearercap.org';
const BASE = `${SITE}/ami-vault/`;
const HOUSE = 'Amistad';

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const SUPA = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Dates render in school time, not the reader's timezone.
const when = (startsOn, endsOn) => {
  if (!startsOn) return '';
  const fmt = (d) =>
    new Date(`${d}T12:00:00`).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York',
    });
  if (!endsOn || endsOn === startsOn) return fmt(startsOn);
  return `${fmt(startsOn)} to ${fmt(endsOn)}`;
};

async function describeEvent(slug) {
  if (!SUPA || !KEY || !slug) return null;
  const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  const get = (path) =>
    fetch(`${SUPA}/rest/v1/${path}`, { headers, signal: AbortSignal.timeout(2500) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

  const rows = await get(
    `vault_events?slug=eq.${encodeURIComponent(slug)}&house=eq.amistad` +
    `&select=id,slug,title,blurb,kind,starts_on,ends_on,open,hidden&limit=1`
  );
  const ev = rows && rows[0];
  if (!ev || ev.hidden) return null;

  const shots = await get(
    `vault_photos?event_id=eq.${ev.id}&hidden=is.false` +
    `&select=storage,web_key,owner&order=created_at.desc&limit=60`
  );
  const list = Array.isArray(shots) ? shots : [];
  return {
    ...ev,
    count: list.length,
    families: new Set(list.map((s) => s.owner)).size,
    cover: list[0] || null,
  };
}

// Where a stored object actually lives. Rows remember their own store, so a
// photo uploaded before the R2 cut-over still resolves.
function coverUrl(cover) {
  if (!cover || !cover.web_key) return null;
  if (cover.storage === 'r2') {
    const base = (process.env.R2_PUBLIC_BASE || '').replace(/\/+$/, '');
    return base ? `${base}/${cover.web_key}` : null;
  }
  return SUPA ? `${SUPA}/storage/v1/object/public/vault-media/${cover.web_key}` : null;
}

export default async function handler(req, res) {
  const slug = String((req.query && req.query.slug) || '').trim();
  const ev = await describeEvent(slug);

  // Unknown slug still resolves to the vault rather than a dead end.
  const dest = ev ? `${BASE}#/e/${encodeURIComponent(ev.slug)}` : BASE;
  const canonical = `${SITE}${String(req.url || '').split('?')[0]}`;

  let title = `The ${HOUSE} Vault`;
  let og = `The ${HOUSE} Vault`;
  let desc =
    'One house, one school year, every photo. Add yours from your phone in under a minute.';
  let img = `${SITE}/ami-vault-og.png`;
  let sized = true;
  let alt = `The ${HOUSE} Vault. One house, one school year, every photo.`;

  if (ev) {
    const date = when(ev.starts_on, ev.ends_on);
    og = `${ev.title}: add your photos`;
    title = `${ev.title} · The ${HOUSE} Vault`;
    alt = `${ev.title}, ${HOUSE} Vault`;

    const so_far =
      ev.count === 0
        ? 'No photos yet. Be the first.'
        : `${ev.count} photo${ev.count === 1 ? '' : 's'} so far from ` +
          `${ev.families} famil${ev.families === 1 ? 'y' : 'ies'}.`;

    desc = [
      date ? `${date}.` : null,
      ev.blurb ? ev.blurb.trim() : null,
      so_far,
      ev.open ? 'Add yours, no sign-in needed.' : 'This one is closed to new photos.',
    ].filter(Boolean).join(' ');

    const c = coverUrl(ev.cover);
    if (c) { img = c; sized = false; }
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Short cache: the count moves as people add, and a stale preview that says
  // "no photos yet" is the opposite of what an invitation is for.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#db0032" />
    <title>${esc(title)}</title>
    <meta name="robots" content="noindex, nofollow" />
    <meta name="description" content="${esc(desc)}" />
    <link rel="canonical" href="${esc(canonical)}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="The ${esc(HOUSE)} Vault" />
    <meta property="og:title" content="${esc(og)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:image" content="${esc(img)}" />${sized ? `
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />` : ''}
    <meta property="og:image:alt" content="${esc(alt)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(og)}" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <meta name="twitter:image" content="${esc(img)}" />

    <meta http-equiv="refresh" content="0; url=${esc(dest)}" />
    <script>window.location.replace(${JSON.stringify(dest)});</script>
    <style>
      body{margin:0;display:grid;place-items:center;min-height:100vh;background:#db0032;
        color:#fff;font:600 16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}
      a{color:#fff}
    </style>
  </head>
  <body>
    <p>Opening the ${esc(HOUSE)} Vault… <a href="${esc(dest)}">tap here</a> if nothing happens.</p>
  </body>
</html>`);
}
