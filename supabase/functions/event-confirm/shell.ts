// The email shell. Same clothes as committee-confirm/shell.ts, repeated here
// because the deploy bundler cannot reach outside a function folder. Adds one
// block type, ![alt](url), so the flyer can ride along.

export const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PAPER = '#faf4ea';
const SURFACE = '#fffaf0';
const NAVY = '#1a2a56';
const INK = '#1a1613';
const SOFT = '#5a4f47';
const LINE = '#e4d6c0';
const GOLD = '#f0b323';
const FONT = "'Archivo',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function button(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0">` +
    `<tr><td bgcolor="${GOLD}" style="border-radius:999px;background-color:${GOLD}">` +
    `<a href="${esc(href)}" style="display:inline-block;padding:15px 30px;font-family:${FONT};` +
    `font-size:16px;font-weight:800;color:${NAVY};text-decoration:none">${esc(label)}</a></td></tr></table>`;
}

const LINK_ONLY = /^\[([^\]]{1,60})\]\((https?:\/\/[^\s)]+)\)$/;
const SMALL_LINK = /^\+\[([^\]]{1,60})\]\((https?:\/\/[^\s)]+)\)$/;
const IMAGE = /^!\[([^\]]{0,80})\]\((https?:\/\/[^\s)]+)\)$/;
const blocks = (body: string) => body.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);

export function asHtml(subject: string, body: string, kicker = 'RCAP PARENT SOCIAL') {
  const parts = blocks(body).map((b, i) => {
    const img = b.match(IMAGE);
    if (img) return `<img src="${esc(img[2])}" alt="${esc(img[1])}" width="506" style="display:block;width:100%;max-width:506px;height:auto;border-radius:12px;margin:22px 0 6px">`;
    const link = b.match(LINK_ONLY);
    if (link) return button(link[1], link[2]);
    const small = b.match(SMALL_LINK);
    if (small) return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px"><a href="${esc(small[2])}" style="color:${NAVY};font-weight:700">${esc(small[1])}</a></p>`;
    if (b.startsWith('## ')) {
      return `<p style="margin:0 0 12px;font-family:${FONT};font-size:26px;line-height:1.15;font-weight:900;color:${NAVY}">${esc(b.slice(3))}</p>`;
    }
    if (b.startsWith('> ')) {
      return `<p style="margin:0 0 16px;font-family:${FONT};font-size:13px;line-height:1.6;color:${SOFT}">${esc(b.slice(2)).replace(/\n/g, '<br>')}</p>`;
    }
    const size = i === 1 ? '17px' : '15.5px';
    return `<p style="margin:0 0 16px;font-family:${FONT};font-size:${size};line-height:1.6;color:${INK}">` +
      `${esc(b).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')}</p>`;
  });

  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;700;800;900&display=swap" rel="stylesheet">
<title>${esc(subject || 'RCAP')}</title></head>
<body style="margin:0;padding:0;background:${PAPER}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(blocks(body).find((b) => !b.startsWith('#')) || '').slice(0, 120)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER}" style="background:${PAPER}">
<tr><td align="center" style="padding:26px 12px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
    style="width:100%;max-width:560px;border-collapse:collapse;border:1px solid ${LINE};border-radius:16px;overflow:hidden">
    <tr><td bgcolor="${NAVY}" style="background:${NAVY};padding:24px 26px 20px">
      <div style="font-family:${FONT};font-size:24px;font-weight:900;letter-spacing:-.02em;color:#ffffff;line-height:1">
        WE ARE RCA<span style="color:${GOLD}">P</span>.
      </div>
      <div style="font-family:${FONT};font-size:9.5px;font-weight:800;letter-spacing:.2em;color:${GOLD};margin-top:8px">${esc(kicker)}</div>
    </td></tr>
    <tr><td height="5" bgcolor="${GOLD}" style="height:5px;line-height:5px;font-size:0">&nbsp;</td></tr>
    <tr><td bgcolor="${SURFACE}" style="background:${SURFACE};padding:28px 26px 24px">${parts.join('')}</td></tr>
    <tr><td bgcolor="${NAVY}" style="background:${NAVY};padding:20px 26px">
      <p style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:1.6;color:#c9cfe0">
        Questions any time: <a href="mailto:hello@wearercap.org" style="color:${GOLD};text-decoration:none">hello@wearercap.org</a>
      </p>
      <p style="margin:0;font-family:${FONT};font-size:11.5px;color:#9aa3bd">
        Organized by parent volunteers. Not sponsored by or affiliated with Ron Clark Academy.
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

export function asText(body: string) {
  return blocks(body)
    .map((b) => {
      if (IMAGE.test(b)) return '';
      const link = b.match(LINK_ONLY) || b.match(SMALL_LINK);
      if (link) return `${link[1]}:\n${link[2]}`;
      if (b.startsWith('## ')) return b.slice(3).toUpperCase();
      if (b.startsWith('> ')) return b.slice(2);
      return b.replace(/\*\*(.+?)\*\*/g, '$1');
    })
    .filter(Boolean)
    .join('\n\n');
}
