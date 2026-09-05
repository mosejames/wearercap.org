import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';
import { readFile, writeFile } from 'node:fs/promises';

// Regenerate with: node scripts/generate-vault-placeholder.mjs
// One static Satori thumbnail serves every empty album without runtime work.
const root = new URL('../', import.meta.url);
const wordmark = await readFile(new URL('public/ami-vault/brand/amistad-wordmark-white.png', root));
const card = new ImageResponse(h('div', {
  style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26, width: '100%', height: '100%', background: '#bd0032', color: '#fff', padding: 60 },
},
  h('div', { style: { position: 'absolute', inset: 24, border: '1px solid rgba(255,255,255,.25)', borderRadius: 18 } }),
  h('img', { src: `data:image/png;base64,${wordmark.toString('base64')}`, width: 410, height: 89 }),
  h('div', { style: { display: 'flex', fontSize: 28, letterSpacing: 7 } }, 'AMI VAULT'),
  h('div', { style: { display: 'flex', width: 64, height: 2, background: 'rgba(255,255,255,.5)' } }),
  h('div', { style: { display: 'flex', fontSize: 22 } }, 'Memories belong here')
), { width: 640, height: 640 });
await writeFile(new URL('public/ami-vault/brand/empty-gallery.png', root), Buffer.from(await card.arrayBuffer()));
console.log('Generated empty-gallery.png');
