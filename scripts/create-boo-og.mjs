import sharp from "sharp";
const lights =
  Array.from(
    { length: 25 },
    (_, i) =>
      `<circle cx="${70 + i * 44}" cy="65" r="7" fill="#ffe29a"/><circle cx="${70 + i * 44}" cy="565" r="7" fill="#ffe29a"/>`,
  ).join("") +
  Array.from(
    { length: 10 },
    (_, i) =>
      `<circle cx="70" cy="90" r="0"/><circle cx="70" cy="${105 + i * 44}" r="7" fill="#ffe29a"/><circle cx="1126" cy="${105 + i * 44}" r="7" fill="#ffe29a"/>`,
  ).join("");
const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="bg"><stop stop-color="#1b426c"/><stop offset="1" stop-color="#050f25"/></radialGradient></defs><rect width="1200" height="630" fill="url(#bg)"/><rect x="48" y="43" width="1100" height="544" rx="45" fill="none" stroke="#bd9649" stroke-width="3"/>${lights}<rect x="91" y="85" width="1010" height="460" rx="32" fill="#081932" stroke="#edc86b" stroke-width="3"/><g text-anchor="middle" font-family="DejaVu Sans,sans-serif"><text x="600" y="155" fill="#dcc389" font-size="20" letter-spacing="9">RCAP PRESENTS</text><text x="600" y="275" fill="#fff7df" font-size="86" font-weight="bold">WHO’S THAT</text><text x="600" y="385" fill="#ffdc76" font-size="105" font-weight="bold">LITTLE BOO?</text><text x="600" y="445" fill="#c2cee0" font-size="22" letter-spacing="3">A WE ARE RCAP GUESS WHO GAME</text><text x="600" y="501" fill="#ecd394" font-size="17">TINY COSTUMES. FAMILIAR FACES. BIG GAME SHOW ENERGY.</text></g></svg>`;
await sharp(Buffer.from(svg))
  .jpeg({ quality: 94 })
  .toFile("public/boo/little-boo-og.jpg");
