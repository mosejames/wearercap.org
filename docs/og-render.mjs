// Renders the OG card sources in docs/ into public/. Shot at 2x and resized
// down so the type stays crisp at 1200×630.
//
//   node docs/og-render.mjs             → every card
//   node docs/og-render.mjs holder      → just that one
//   node docs/og-render.mjs collective  → the Collective card
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

// card → { source html, output file under public/ }. The Uniform Exchange
// cards are five variants of one template selected by ?v=; anything else is a
// template of its own. 'main' keeps its original filename so every link
// already out in the world still resolves.
const UX = 'og-uniform-exchange.html';
const CARDS = {
  main:       { html: UX, v: 'main',   out: 'uniform-exchange-og.png' },
  bin:        { html: UX, v: 'bin',    out: 'uniform-exchange-bin-og.png' },
  holder:     { html: UX, v: 'holder', out: 'uniform-exchange-holder-og.png' },
  my:         { html: UX, v: 'my',     out: 'uniform-exchange-my-og.png' },
  admin:      { html: UX, v: 'admin',  out: 'uniform-exchange-admin-og.png' },
  collective: { html: 'og-collective.html', out: 'directory/collective-og.png' },
};

const only = process.argv[2];
if (only && !CARDS[only]) {
  console.error(`unknown card "${only}" — try: ${Object.keys(CARDS).join(', ')}`);
  process.exit(1);
}
const wanted = only ? { [only]: CARDS[only] } : CARDS;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium',
});
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
});

for (const [card, { html, v, out: file }] of Object.entries(wanted)) {
  const out = resolve(here, '..', 'public', file);
  const src = resolve(here, html);
  await page.goto(`file://${src}${v ? `?v=${v}` : ''}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: out });
  console.log('wrote', out);
}

await browser.close();
