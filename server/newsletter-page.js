import {signedNewsletterLinks} from './newsletter-links.js';
// Public pages for published RCAP newsletter issues.
//
//   /newsletter          → every published issue, newest first
//   /newsletter/<slug>   → one issue, rendered from the same code the builder
//                          uses for email, with its own share card
//
// Reached through api/link.js (vercel.json rewrites). Drafts never appear:
// rcap_newsletter_archive only returns published rows.
import { renderEmail, esc, safeUrl, longDate, SITE } from '../src/newsletter/render.js';

const OG = `${SITE}/newsletter-og.png`;
const SLUG = /^[a-z0-9][a-z0-9-]{1,70}$/;

async function archive(slug) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('unconfigured');
  const r = await fetch(`${url}/rest/v1/rpc/rcap_newsletter_archive`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_slug: slug || null }),
    signal: AbortSignal.timeout(4000),
  });
  if (!r.ok) throw new Error('lookup failed');
  return r.json();
}

export function firstImage(content) {
  for (const b of content?.blocks || []) {
    const u = safeUrl(b?.image?.url);
    if (u && /^https:/.test(u)) return { url: u, alt: b.image.alt || '' };
  }
  return null;
}

const strip = (s) => String(s || '').replace(/\*\*|\[|\]\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

function shell({ title, desc, canonical, image, imageAlt, robots = 'index, follow', body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#1a2a56">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="RCAP">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(image)}">
${image === OG ? '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n<meta property="og:image:type" content="image/png">' : ''}
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta name="twitter:image:alt" content="${esc(imageAlt)}">
<link rel="icon" href="/brand/rcap.svg">
<style>
body{margin:0;background:#dfe3ea;font:16px/1.5 Arial,Helvetica,sans-serif;color:#1a2a56}
.nl-bar{max-width:640px;margin:0 auto;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:11px;letter-spacing:2px;font-weight:800;text-transform:uppercase}
.nl-bar a{color:#1a2a56;text-decoration:none}
.nl-bar a:focus-visible,.nl-card:focus-visible{outline:3px solid #f7a81c;outline-offset:3px}
.nl-issue{max-width:640px;margin:0 auto 40px;box-shadow:0 24px 60px rgba(26,42,86,.18)}
.nl-list{max-width:640px;margin:0 auto 48px;padding:0 16px;display:grid;gap:12px}
.nl-hero{max-width:640px;margin:0 auto 18px;padding:34px 26px;background:#1a2a56;color:#faf4ea}
.nl-hero h1{margin:14px 0 8px;font-size:40px;line-height:1.02;letter-spacing:-1.5px}
.nl-hero p{margin:0;color:#d3dae8;font-size:16px;line-height:1.6;max-width:44ch}
.nl-card{display:block;background:#faf4ea;border-radius:16px;padding:22px;color:#1a2a56;text-decoration:none;border:1px solid #e4d6c0}
.nl-card .k{font-size:11px;letter-spacing:2px;font-weight:800;text-transform:uppercase;color:#8f5e04}
.nl-card h2{margin:8px 0 6px;font-size:24px;line-height:1.15;letter-spacing:-.5px}
.nl-card span{font-size:14px;font-weight:700;text-decoration:underline}
.nl-empty{background:#faf4ea;border-radius:16px;padding:26px;text-align:center}
@media (max-width:480px){.nl-hero{padding:28px 20px}.nl-hero h1{font-size:32px}}
@media (max-width:620px){.nb-missed{display:block!important;width:100%!important;min-width:0!important;max-width:100%!important}}
</style>
</head>
<body>
${body}
<script type="module" src="/campaign-activity.js"></script>
</body>
</html>`;
}

export default async function newsletterPage(req, res) {
  const slug = String(req.query?.v || '').toLowerCase().replace(/\/+$/, '');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=120, stale-while-revalidate=600');

  if (!slug) {
    let issues = [];
    try { issues = (await archive(null)) || []; } catch { res.setHeader('Cache-Control', 'no-store'); }
    const cards = issues.map((i) => `<a class="nl-card" href="/newsletter/${esc(i.slug)}"><div class="k">${esc(longDate(i.issue_date))} · ${i.format === 'quick' ? 'Quick Hello' : 'Full Issue'}</div><h2>${esc(strip(i.headline || i.title) || 'RCAP newsletter')}</h2><span>Read it</span></a>`).join('');
    return res.status(200).send(shell({
      title: 'The RCAP Newsletter',
      desc: 'Every note from your RCAP family, in one place. Catch up on what you missed.',
      canonical: `${SITE}/newsletter`,
      image: OG, imageAlt: 'The RCAP Newsletter. Every note from your RCAP family.',
      body: `<div class="nl-bar"><a href="/">wearercap.org</a><a href="/newsletter">All issues</a></div><header class="nl-hero"><div style="font-size:11px;letter-spacing:2px;font-weight:800;text-transform:uppercase;color:#f7a81c">Ron Clark Academy Parents</div><h1>The RCAP Newsletter.</h1><p>Every note from your RCAP family, in one place. Missed one? It is all here.</p></header><main class="nl-list">${cards || '<div class="nl-empty">The first issue is on its way.</div>'}</main>`,
    }));
  }

  if (!SLUG.test(slug)) return res.status(404).send(shell({ title: 'Issue not found | RCAP', desc: 'This newsletter is not available.', canonical: `${SITE}/newsletter`, image: OG, imageAlt: 'The RCAP Newsletter', robots: 'noindex', body: '<main class="nl-list"><div class="nl-empty">This issue is not available. <a href="/newsletter">See every issue</a>.</div></main>' }));
  let issue = null;
  try { issue = await archive(slug); } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(503).send(shell({ title: 'RCAP Newsletter', desc: 'Please try again in a moment.', canonical: `${SITE}/newsletter/${slug}`, image: OG, imageAlt: 'The RCAP Newsletter', robots: 'noindex', body: '<main class="nl-list"><div class="nl-empty">We could not load this issue. Please try again in a moment.</div></main>' }));
  }
  if (!issue) {
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30');
    return res.status(404).send(shell({ title: 'Issue not found | RCAP', desc: 'This newsletter is not available.', canonical: `${SITE}/newsletter`, image: OG, imageAlt: 'The RCAP Newsletter', robots: 'noindex', body: '<main class="nl-list"><div class="nl-empty">This issue is not available. <a href="/newsletter">See every issue</a>.</div></main>' }));
  }
  const c = issue.content || {};
  const img = firstImage(c);
  const title = strip(c.subject || c.headline || issue.title) || 'RCAP newsletter';
  const desc = strip(c.preheader || c.body).slice(0, 180) || 'A note from your RCAP family.';
  return res.status(200).send(shell({
    title, desc, canonical: `${SITE}/newsletter/${issue.slug}`,
    image: img?.url || OG, imageAlt: img?.alt || 'The RCAP Newsletter',
    body: `<div class="nl-bar"><a href="/">wearercap.org</a><a href="/newsletter">All issues</a></div><main class="nl-issue">${renderEmail(c,{analytics:true,trackingLinks:signedNewsletterLinks(c,issue.slug),webUrl:`${SITE}/newsletter/${issue.slug}`})}</main>`,
  }));
}
