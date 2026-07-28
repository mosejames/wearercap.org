// Renders docs/og-uniform-exchange.html to public/uniform-exchange-og.png.
// Shot at 2x and resized down so the type stays crisp at 1200×630.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, 'og-uniform-exchange.html');
const out = resolve(here, '..', 'public', 'uniform-exchange-og.png');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
});
await page.goto('file://' + src);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);
await page.screenshot({ path: out });
await browser.close();
console.log('wrote', out);
