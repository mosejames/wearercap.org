// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { shareNames, raffleShareHtml, raffleShareImage } from './raffle-share.js';
describe('raffle invitations', () => {
 it('limits names and rejects non-string query values', () => {
  expect(shareNames({scholar:['unsafe'], family:' A\n Family '})).toEqual({scholar:'',family:'A Family'});
  expect(shareNames({scholar:'x'.repeat(100)}).scholar).toHaveLength(60);
 });
 it('escapes names and preserves attribution in share metadata', () => {
  const html=raffleShareHtml({scholar:'Alex <script>',family:'Smith & Jones'});
  expect(html).not.toContain('Alex <script>');
  expect(html).toContain('Alex &lt;script&gt;');
  expect(html).toContain('twitter:card');
  expect(html).toContain('summary_large_image');
  expect(html).toContain('scholar=Alex');
  expect(html).toContain('does not automatically fill in checkout');
  expect(html).toContain('name="house"');
  expect(html).toContain('/raffle/2026/information/');
  expect(html).not.toContain('href="/events/2026/fall-raffle/"');
 });
 it('renders a real 1200 by 630 personalized share image',async()=>{
 const fonts=[{name:'Figtree',data:readFileSync(new URL('../api/fonts/Figtree-Medium.ttf',import.meta.url)),weight:500},{name:'Figtree',data:readFileSync(new URL('../api/fonts/Figtree-Black.ttf',import.meta.url)),weight:900}];
 const image=Buffer.from(await raffleShareImage(fonts,{scholar:'Alex Johnson',family:'Johnson'}).arrayBuffer());
 expect(image.readUInt32BE(16)).toBe(1200);expect(image.readUInt32BE(20)).toBe(630);
 });
});
