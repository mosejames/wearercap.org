// The email shell — see the comment below. Kept in its own module so it can
// be unit-tested and previewed outside Deno.
export const esc = (t: string) =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------------------
// The email shell.
//
// A plain-text email from a site that looks like the Uniform Exchange reads as
// if it came from somewhere else, and a volunteer who has never seen the site
// has no reason to trust it. So every email leaves here in the same clothes the
// site wears: night header, the flame under it, paper body, one clear button.
//
// Table-based and inline-styled on purpose — Outlook has no flexbox, Gmail
// strips <style> blocks, and half the world reads mail in dark mode. Anything
// clever gets thrown away; this doesn't.
//
// The bodies stay plain text in the database (they double as the text/plain
// part, and the SMS bodies live in the same column), with four markers:
//
//   ## Heading            a section kicker
//   [Label](https://…)    the primary button
//   1. Step text          a numbered step with a big flame numeral
//   > Aside               quiet fine print
// ---------------------------------------------------------------------------
const PAPER = '#faf4ea';
const SURFACE = '#fffaf0';
const NIGHT = '#0e0c0b';
const INK = '#1a1613';
const SOFT = '#5a4f47';
const LINE = '#e4d6c0';
const FONT = "'Archivo',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// The flame, as eight solid cells. A CSS gradient would be dropped by half the
// clients that matter; a row of table cells is drawn by all of them.
const FLAME = ['#ea9a17', '#ee8419', '#f16f1b', '#eb5520', '#e13a27', '#d8202f', '#db2054', '#de2178'];

const flameBar = () =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
  `style="border-collapse:collapse"><tr>` +
  FLAME.map((c) => `<td width="12.5%" height="5" bgcolor="${c}" style="height:5px;line-height:5px;font-size:0">&nbsp;</td>`).join('') +
  `</tr></table>`;

function button(label: string, href: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0">` +
    `<tr><td bgcolor="#d8202d" style="border-radius:999px;` +
    `background-color:#d8202d;background-image:linear-gradient(96deg,#e8a516 0%,#f26a1b 34%,#d8202d 68%,#e0218a 100%)">` +
    `<a href="${esc(href)}" style="display:inline-block;padding:15px 30px;font-family:${FONT};` +
    `font-size:16px;font-weight:800;letter-spacing:-.01em;color:#ffffff;text-decoration:none">` +
    `${esc(label)}</a></td></tr></table>`;
}

function step(n: string, text: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
    `style="margin:0 0 16px"><tr>` +
    `<td width="36" valign="top" style="font-family:${FONT};font-size:22px;font-weight:900;` +
    `color:#f26a1b;line-height:1.25;padding-right:10px">${esc(n)}</td>` +
    `<td valign="top" style="font-family:${FONT};font-size:15.5px;line-height:1.6;color:${INK}">` +
    `${esc(text).replace(/\n/g, '<br>')}</td></tr></table>`;
}

const LINK_ONLY = /^\[([^\]]{1,60})\]\((https?:\/\/[^\s)]+)\)$/;

function blocks(body: string) {
  return body.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
}

// What lands in an inbox.
export function asHtml(subject: string, body: string) {
  const parts = blocks(body).map((b, i) => {
    const link = b.match(LINK_ONLY);
    if (link) return button(link[1], link[2]);

    // A bare URL on its own line, from before the markers existed.
    if (/^https?:\/\/\S+$/.test(b)) return button('Open my page', b);

    if (b.startsWith('## ')) {
      return `<p style="margin:30px 0 10px;font-family:${FONT};font-size:11.5px;` +
        `letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:${SOFT}">` +
        `${esc(b.slice(3))}</p>`;
    }
    if (b.startsWith('> ')) {
      return `<p style="margin:0 0 16px;font-family:${FONT};font-size:13px;line-height:1.6;` +
        `color:${SOFT}">${esc(b.slice(2)).replace(/\n/g, '<br>')}</p>`;
    }
    const numbered = b.match(/^(\d+)\.\s+([\s\S]+)$/);
    if (numbered) return step(numbered[1], numbered[2]);

    // The opening line carries the greeting, so give it a little more air.
    const size = i === 0 ? '17.5px' : '15.5px';
    return `<p style="margin:0 0 16px;font-family:${FONT};font-size:${size};line-height:1.65;` +
      `color:${INK}">${esc(b).replace(/\n/g, '<br>')}</p>`;
  });

  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<!-- Apple Mail and iOS honour this and the header matches the site exactly;
     everywhere else falls back to the system stack, which is fine. -->
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;700;800;900&display=swap" rel="stylesheet">
<title>${esc(subject || 'RCAP Uniform Exchange')}</title></head>
<body style="margin:0;padding:0;background:${PAPER}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(blocks(body)[0] || '').slice(0, 120)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAPER}" style="background:${PAPER}">
<tr><td align="center" style="padding:26px 12px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
    style="width:100%;max-width:560px;border-collapse:collapse;border:1px solid ${LINE};border-radius:16px;overflow:hidden">

    <tr><td bgcolor="${NIGHT}" style="background:${NIGHT};padding:26px 26px 22px">
      <div style="font-family:${FONT};font-size:24px;font-weight:900;letter-spacing:-.02em;color:#ffffff;line-height:1">
        RCA<span style="color:#f26a1b">P</span>
      </div>
      <div style="font-family:${FONT};font-size:9.5px;font-weight:800;letter-spacing:.2em;color:#8c8480;margin-top:8px">
        THE UNIFORM EXCHANGE
      </div>
    </td></tr>

    <tr><td style="padding:0;font-size:0;line-height:0">${flameBar()}</td></tr>

    <tr><td bgcolor="${SURFACE}" style="background:${SURFACE};padding:30px 26px 26px">
      ${parts.join('')}
    </td></tr>

    <tr><td bgcolor="${NIGHT}" style="background:${NIGHT};padding:22px 26px">
      <p style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:1.6;color:#b8b0ac">
        Questions any time:
        <a href="mailto:hello@wearercap.org" style="color:#e8a516;text-decoration:none">hello@wearercap.org</a>
      </p>
      <p style="margin:0;font-family:${FONT};font-size:11.5px;color:#8c8480">
        RCAP \u00b7 a parent-run organization \u00b7 wearercap.org
      </p>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
}

// The same body with the markers taken back out, for text/plain and for any
// client that refuses HTML.
export function asText(body: string) {
  return blocks(body)
    .map((b) => {
      const link = b.match(LINK_ONLY);
      if (link) return `${link[1]}:\n${link[2]}`;
      if (b.startsWith('## ')) return b.slice(3).toUpperCase();
      if (b.startsWith('> ')) return b.slice(2);
      return b;
    })
    .join('\n\n');
}

