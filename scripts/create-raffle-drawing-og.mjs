import sharp from 'sharp';
import { readFileSync } from 'node:fs';
// Homepage and raffle share card for the rescheduled December 4 live drawing.
const logo = readFileSync('public/brand/rcap-reversed.svg');
const t = (x, y, size, fill, text, extra = '') => `<text x="${x}" y="${y}" font-family="Arial" font-size="${size}" fill="${fill}" ${extra}>${text}</text>`;
const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#1b2c56"/><path d="M70 155H1130" stroke="#faf4ea" stroke-opacity=".25"/>`
  + t(70, 215, 18, '#f7a81c', 'FALL RAFFLE · LIVE DRAWING', 'font-weight="700" letter-spacing="4"')
  + t(65, 318, 76, '#faf4ea', 'Friday, December 4.', 'font-weight="700" letter-spacing="-3"')
  + t(65, 402, 76, '#faf4ea', 'Winners at halftime.', 'font-weight="700" letter-spacing="-3"')
  + t(70, 482, 27, '#faf4ea', 'First home basketball game vs. Chattahoochee Hills')
  + `<path d="M70 550H1130" stroke="#f7a81c" stroke-width="5"/>`
  + t(70, 595, 17, '#faf4ea', 'GIRLS 5:30 PM · BOYS 6:45 PM', 'letter-spacing="2"')
  + t(1130, 595, 17, '#faf4ea', 'wearercap.org', 'text-anchor="end"')
  + `</svg>`;
await sharp(Buffer.from(card)).composite([{ input: await sharp(logo).resize({ width: 230 }).png().toBuffer(), left: 70, top: 44 }]).png().toFile('public/images/events/fall-raffle-drawing-dec4-og.png');
