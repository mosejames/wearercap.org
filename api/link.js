// ---------------------------------------------------------------------------
// Link previews for the Uniform Exchange.
//
// The app is a hash router, and a fragment never reaches the server — so when
// you text someone `/uniform-exchange/#/holder/<token>`, the scraper that
// builds the preview only ever sees the one static page. Every link in the
// system looked identical in a message thread: same picture, same headline,
// no clue whether it was the front door or somebody's private page.
//
// So the links people actually send now come from real paths, which land here:
//
//   /uniform-exchange/h/<token>   a bin holder's page
//   /uniform-exchange/b/<CODE>    one bin
//   /uniform-exchange/m/<token>   a family's requests
//   /uniform-exchange/storage     the Storage Room
//
// This answers with a small page carrying tags written for that destination,
// then bounces a real visitor into the app. Old hash links still work exactly
// as they did — printed QR labels included.
//
// Privacy: a holder link gets forwarded, lands on lock screens, sits in group
// threads. So the card says what KIND of page it is and nothing about who
// holds it. The bin card is the one exception — its code is printed on the
// label in the school car park, so there's nothing to protect.
// ---------------------------------------------------------------------------

const SITE = 'https://wearercap.org';
const BASE = `${SITE}/uniform-exchange/`;

const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const HOUSE = {
  altruismo: 'Altruismo', amistad: 'Amistad', isibindi: 'Isibindi', reveur: 'Rêveur',
};

// ---------------------------------------------------------------------------
// One place per page type. `hash` is where a person ends up.
// ---------------------------------------------------------------------------
export function card(page, value) {
  const v = value || '';
  switch (page) {
    case 'holder':
      return {
        hash: `#/holder/${encodeURIComponent(v)}`,
        title: 'Your bin holder page · RCAP Uniform Exchange',
        og: 'Your bin holder page',
        desc:
          'Everything queued to you, what is in your bins, your carline mornings ' +
          'and your QR labels — all in one place. No password; this link is the key.',
        img: 'uniform-exchange-holder-og.png',
        alt: 'RCAP Uniform Exchange — the bin lives in your trunk. A bin holder’s page.',
        robots: 'noindex, nofollow',
      };
    case 'my':
      return {
        hash: `#/my/${encodeURIComponent(v)}`,
        title: 'Your requests · RCAP Uniform Exchange',
        og: 'Your requests',
        desc:
          'What you asked for, where each one stands, and the handoff you picked. ' +
          'Private to your family — no password, this link is the key.',
        img: 'uniform-exchange-my-og.png',
        alt: 'RCAP Uniform Exchange — what you asked for. A family’s request list.',
        robots: 'noindex, nofollow',
      };
    case 'admin':
      return {
        hash: '#/admin',
        title: 'The Storage Room · RCAP Uniform Exchange',
        og: 'The Storage Room',
        desc: 'Bins, holders and everything in flight. RCAP volunteers only.',
        img: 'uniform-exchange-admin-og.png',
        alt: 'RCAP Uniform Exchange — the Storage Room.',
        robots: 'noindex, nofollow',
      };
    default:
      return {
        hash: `#/bin/${encodeURIComponent(String(v).toUpperCase())}`,
        title: `Bin ${String(v).toUpperCase()} · RCAP Uniform Exchange`,
        og: `Bin ${String(v).toUpperCase()}`,
        desc: 'See what is in this bin, request a size, or offer what your student has outgrown.',
        img: 'uniform-exchange-bin-og.png',
        alt: 'RCAP Uniform Exchange — what’s in this bin.',
        robots: 'index, follow',
      };
  }
}

// A bin's code is on a printed label, so its card can name the bin, its house
// and roughly how full it is. Best effort — if Supabase is slow or unset, the
// generic bin card still goes out.
async function describeBin(code) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !code) return null;

  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const get = (path) =>
    fetch(`${url}/rest/v1/${path}`, { headers, signal: AbortSignal.timeout(2500) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);

  const bins = await get(
    `ue_bins?code=eq.${encodeURIComponent(code)}&select=id,code,name,holder_name,holder_house,focus&limit=1`
  );
  const bin = bins && bins[0];
  if (!bin) return null;

  const inv = await get(`ue_inventory?bin_id=eq.${bin.id}&select=qty`);
  const total = Array.isArray(inv)
    ? inv.reduce((n, r) => n + Math.max(0, Number(r.qty) || 0), 0)
    : null;

  return { ...bin, total };
}

export default async function handler(req, res) {
  const { p = 'bin', v = '' } = req.query || {};
  const c = card(p, v);

  if (p === 'bin') {
    const bin = await describeBin(String(v).toUpperCase());
    if (bin) {
      const house = HOUSE[bin.holder_house] || '';
      const who = String(bin.holder_name || '').trim().split(' ')[0];
      c.og = `${bin.code} · ${bin.name}`;
      c.title = `${bin.code} · ${bin.name} — RCAP Uniform Exchange`;
      // Altruismo, Amistad and Isibindi take "an"; Rêveur takes "a".
      const article = /^[aeiou]/i.test(house) ? 'An' : 'A';
      c.desc = [
        house ? `${article} ${house} bin` : 'A uniform bin',
        who ? `carried by ${who}` : null,
        bin.total ? `· about ${bin.total} item${bin.total === 1 ? '' : 's'} on hand` : null,
      ].filter(Boolean).join(' ') +
        '. See what fits, request a size, or offer what your student has outgrown.';
    }
  }

  const dest = BASE + c.hash;
  const canonical = `${SITE}${req.url.split('?')[0]}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Short cache: a bin's contents move, and a wrong preview shouldn't stick.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0E0C0B" />
    <title>${esc(c.title)}</title>
    <meta name="robots" content="${esc(c.robots)}" />
    <meta name="description" content="${esc(c.desc)}" />
    <link rel="canonical" href="${esc(canonical)}" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="RCAP" />
    <meta property="og:title" content="${esc(c.og)}" />
    <meta property="og:description" content="${esc(c.desc)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <meta property="og:image" content="${SITE}/${c.img}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(c.alt)}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(c.og)}" />
    <meta name="twitter:description" content="${esc(c.desc)}" />
    <meta name="twitter:image" content="${SITE}/${c.img}" />

    <meta http-equiv="refresh" content="0; url=${esc(dest)}" />
    <script>window.location.replace(${JSON.stringify(dest)});</script>
    <style>
      body{margin:0;display:grid;place-items:center;min-height:100vh;background:#0E0C0B;
        color:#fff;font:600 16px/1.5 system-ui,sans-serif}
      a{color:#E8A516}
    </style>
  </head>
  <body>
    <p>Opening the RCAP Uniform Exchange… <a href="${esc(dest)}">tap here</a> if nothing happens.</p>
  </body>
</html>`);
}
