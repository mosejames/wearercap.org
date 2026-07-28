import { describe, it, expect } from 'vitest';
import handler, { card } from '../../api/link.js';
import { binUrl, holderUrl, myUrl } from './config.js';

// The whole point of the link function is that two different pages don't come
// up looking like the same page. So test exactly that.
const render = async (query) => {
  let body = '';
  const res = {
    setHeader() {},
    status() { return res; },
    send(html) { body = html; return res; },
  };
  await handler({ query, url: '/uniform-exchange/x' }, res);
  return body;
};

const meta = (html, prop) =>
  (html.match(new RegExp(`<meta property="${prop}" content="([^"]*)"`)) || [])[1] || '';

describe('link previews', () => {
  it('sends every page somewhere different', async () => {
    const pages = ['bin', 'holder', 'my', 'admin'];
    const titles = await Promise.all(
      pages.map((p) => render({ p, v: 'AMI-1' }).then((h) => meta(h, 'og:title')))
    );
    expect(new Set(titles).size).toBe(pages.length);

    const images = await Promise.all(
      pages.map((p) => render({ p, v: 'AMI-1' }).then((h) => meta(h, 'og:image')))
    );
    expect(new Set(images).size).toBe(pages.length);
  });

  it('names the bin, since its code is printed on the label', async () => {
    const html = await render({ p: 'bin', v: 'ami-1' });
    expect(meta(html, 'og:title')).toBe('Bin AMI-1');
  });

  it('never names the holder — the link gets forwarded', async () => {
    const html = await render({ p: 'holder', v: 'sometoken' });
    expect(meta(html, 'og:title')).toBe('Your bin holder page');
    // The token has to ride in the redirect, but nothing a preview renders
    // may carry it — those strings show on lock screens and in group threads.
    const shown = [
      meta(html, 'og:title'), meta(html, 'og:description'),
      meta(html, 'og:image'), meta(html, 'og:image:alt'),
      (html.match(/<title>([^<]*)</) || [])[1] || '',
    ];
    shown.forEach((s) => expect(s).not.toContain('sometoken'));
  });

  it('keeps private pages out of search results', async () => {
    for (const p of ['holder', 'my', 'admin']) {
      const html = await render({ p, v: 'tok' });
      expect(html).toContain('content="noindex, nofollow"');
    }
    expect(await render({ p: 'bin', v: 'AMI-1' })).toContain('content="index, follow"');
  });

  it('lands a real visitor on the hash route the app already knows', async () => {
    expect(card('holder', 'abc').hash).toBe('#/holder/abc');
    expect(card('bin', 'ami-1').hash).toBe('#/bin/AMI-1');
    expect(card('my', 'abc').hash).toBe('#/my/abc');
    expect(card('admin').hash).toBe('#/admin');
  });

  it('builds the same short paths the rewrites answer', () => {
    expect(binUrl('AMI-1')).toBe('https://wearercap.org/uniform-exchange/b/AMI-1');
    expect(holderUrl('tok')).toBe('https://wearercap.org/uniform-exchange/h/tok');
    expect(myUrl('tok')).toBe('https://wearercap.org/uniform-exchange/m/tok');
  });

  it('escapes anything that came off the wire', async () => {
    const html = await render({ p: 'bin', v: '"><script>x</script>' });
    expect(html).not.toContain('<script>x</script>');
  });
});
