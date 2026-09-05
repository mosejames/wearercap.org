import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';

// No remote images or font downloads: rendering is deterministic and cacheable.
// The invite page supplies the event title it has already looked up.
export function eventCard(title, date, closed = false) {
  return new ImageResponse(h('div', {
    style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%', padding: '54px 64px', background: '#bd0032', color: '#ffffff', fontFamily: 'sans-serif' },
  },
  h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e780a0', paddingBottom: 24 } },
    h('div', { style: { fontSize: 40, fontWeight: 700 } }, 'AMI VAULT'),
    h('div', { style: { fontSize: 22 } }, 'House of Friendship')),
  h('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    h('div', { style: { fontSize: title.length > 100 ? 42 : title.length > 55 ? 52 : 68, lineHeight: 1.08, fontWeight: 700, wordBreak: 'break-word' } }, title),
    h('div', { style: { fontSize: 24, color: '#ffffff' } }, date)),
  h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
    h('div', { style: { background: '#ffffff', color: '#bd0032', borderRadius: 36, padding: '16px 28px', fontSize: 27, fontWeight: 700 } }, closed ? 'See the memories' : 'Add yours. Share the joy.'),
    h('div', { style: { fontSize: 22 } }, 'One house. Every memory.'))),
  { width: 1200, height: 630 });
}

export default async function handler(req, res) {
  const title = String(req.query?.title || 'Our year. All together.').slice(0, 180);
  const date = String(req.query?.date || '').slice(0, 100);
  const result = eventCard(title, date, req.query?.closed === '1');
  const png = Buffer.from(await result.arrayBuffer());
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=31536000, immutable');
  res.status(200).send(png);
}
