import { describe, it, expect } from 'vitest';
import { asHtml, asText } from './email.ts';

const BODY = [
  'Welcome to the RCAP Uniform Exchange, Shekita!',
  'Thank you for holding a bin.',
  'This is your own page.',
  '[Open my bin holder page](https://wearercap.org/uniform-exchange/h/tok123)',
  '## Three things to do when you open it',
  '1. Count what you already have.',
  '2. Say when you’re around.',
  '3. Then just watch for texts.',
  '> This link is yours alone.',
  '— RCAP',
].join('\n\n');

describe('the email shell', () => {
  const html = asHtml('Your bin holder page', BODY);

  it('wears the site: night header, the flame, paper body', () => {
    expect(html).toContain('RCA<span style="color:#f26a1b">P</span>');
    expect(html).toContain('THE UNIFORM EXCHANGE');
    expect(html).toContain('#0e0c0b');   // night
    expect(html).toContain('#faf4ea');   // paper
    expect(html).toContain('#e0218a');   // the far end of the flame
  });

  it('turns the marked link into one button, label and all', () => {
    expect(html).toContain('Open my bin holder page');
    expect(html).toContain('https://wearercap.org/uniform-exchange/h/tok123');
    // exactly one call to action
    expect(html.match(/border-radius:999px/g)?.length).toBe(1);
  });

  it('keeps the numbered steps numbered', () => {
    ['1', '2', '3'].forEach((n) =>
      expect(html).toContain(`padding-right:10px">${n}</td>`));
  });

  it('renders a heading as a kicker, not a paragraph', () => {
    expect(html).toContain('text-transform:uppercase');
    expect(html).toContain('Three things to do when you open it');
    expect(html).not.toContain('## ');
  });

  it('survives Outlook: tables and inline styles only, no flexbox or media queries', () => {
    expect(html).not.toContain('display:flex');
    expect(html).not.toContain('@media');
    expect(html).not.toMatch(/<style[\s>]/);
    expect(html).toContain('role="presentation"');
  });

  it('escapes anything a name or a note dragged in', () => {
    const nasty = asHtml('x', 'Hi <script>alert(1)</script> & co');
    expect(nasty).not.toContain('<script>');
    expect(nasty).toContain('&lt;script&gt;');
    expect(nasty).toContain('&amp;');
  });

  it('still sends a clean plain-text version', () => {
    const text = asText(BODY);
    expect(text).not.toContain('## ');
    expect(text).not.toContain('](');
    expect(text).toContain('THREE THINGS TO DO WHEN YOU OPEN IT');
    expect(text).toContain('Open my bin holder page:\nhttps://wearercap.org/uniform-exchange/h/tok123');
    expect(text).toContain('This link is yours alone.');
  });

  it('handles a bare URL from before the markers existed', () => {
    const old = asHtml('x', 'Here is your page.\n\nhttps://wearercap.org/uniform-exchange/h/abc');
    expect(old).toContain('Open my page');
    expect(old).toContain('/h/abc');
  });
});
