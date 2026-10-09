// Rebuild with node scripts/create-london-og.mjs from the repository root.
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
const photo = await sharp('public/london/london-morning.jpg').resize(480, 388, {fit:'cover', position:'centre'}).jpeg({quality:90}).toBuffer();
const logo = await readFile('public/london/ron-clark-academy.png');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#faf8f2"/><rect width="1200" height="8" fill="#1a2a56"/>
<path d="M60 573 Q360 620 645 538 T1150 567" fill="none" stroke="#c5a351" stroke-width="2" stroke-dasharray="7 9"/>
<image x="52" y="42" width="240" height="56" xlink:href="data:image/png;base64,${logo.toString('base64')}"/>
<path d="M319 50V92" stroke="#d7c8a4"/><text x="338" y="65" fill="#1a2a56" font-family="Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="2">CLASS OF 2028</text><text x="338" y="87" fill="#66728b" font-family="Arial,sans-serif" font-size="11" letter-spacing="2">LONDON + PARIS</text>
<text x="63" y="187" fill="#84610e" font-family="Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="2.7">THEIR ADVENTURE. OUR POSTCARDS.</text>
<text x="59" y="270" fill="#1a2a56" font-family="Georgia,serif" font-size="56">A Class of 2028</text>
<text x="58" y="350" fill="#1a2a56" font-family="Georgia,serif" font-size="72">Takes <tspan fill="#956b11">London.</tspan></text>
<text x="64" y="407" fill="#1a2a56" font-family="Arial,sans-serif" font-size="24">A little window into their big adventure.</text>
<rect x="63" y="453" width="351" height="49" rx="7" fill="#f0b323"/><text x="85" y="484" fill="#1a2a56" font-family="Arial,sans-serif" font-size="18" font-weight="700">One class. A world of stories.</text>
<text x="64" y="547" fill="#657085" font-family="Arial,sans-serif" font-size="15">wearercap.org/2028-london</text>
<g transform="rotate(4 903 315)"><rect x="654" y="71" width="492" height="493" fill="#d9d5ca" opacity=".4"/><rect x="648" y="65" width="492" height="493" fill="#fffdf8" stroke="#e2ddd0"/><image x="662" y="79" width="464" height="388" xlink:href="data:image/jpeg;base64,${photo.toString('base64')}"/><text x="678" y="508" font-family="Georgia,serif" font-size="31" fill="#1a2a56">London is calling.</text><text x="679" y="536" font-family="Arial,sans-serif" font-size="11" letter-spacing="2" fill="#657085">WITH LOVE FROM THE ROAD</text></g>
<g transform="rotate(12 1100 94)"><circle cx="1100" cy="94" r="55" fill="#faf8f2" fill-opacity=".95" stroke="#b48115" stroke-width="2"/><text x="1100" y="88" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" fill="#1a2a56" letter-spacing="1">ATL → LHR</text><text x="1100" y="111" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="#1a2a56" letter-spacing="1">CLASS OF ’28</text></g>
</svg>`;
await sharp(Buffer.from(svg)).jpeg({quality:91,mozjpeg:true}).toFile('public/london/2028-london-og.jpg');
console.log('Created public/london/2028-london-og.jpg (1200 × 630)');
