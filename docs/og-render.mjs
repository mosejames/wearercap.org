// Renders docs/og-uniform-exchange.html into the Uniform Exchange OG cards.
// Shot at 2x and resized down so the type stays crisp at 1200×630.
//
//   node docs/og-render.mjs            → every variant
//   node docs/og-render.mjs holder     → just that one
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, 'og-uniform-exchange.html');

// variant → file in public/. 'main' keeps its original name so every link
// already out in the world still resolves.
const CARDS = {
  main: 'uniform-exchange-og.png',
  bin: 'uniform-exchange-bin-og.png',
  holder: 'uniform-exchange-holder-og.png',
  my: 'uniform-exchange-my-og.png',
  admin: 'uniform-exchange-admin-og.png',
};

const only = process.argv[2];
if (only && !CARDS[only]) {
  console.error(`unknown variant "${only}" — try: ${Object.keys(CARDS).join(', ')}`);
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

for (const [variant, file] of Object.entries(wanted)) {
  const out = resolve(here, '..', 'public', file);
  await page.goto(`file://${src}?v=${variant}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
  await page.screenshot({ path: out });
  console.log('wrote', out);
}

await browser.close();
