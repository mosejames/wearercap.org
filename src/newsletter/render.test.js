import { describe, expect, it } from 'vitest';
import { renderEmail, renderDocument, plainText, inline, safeUrl, styleCheck, fixDashes, template, newBlock, suggestSlug, slugify, gmailComposeUrl, DEFAULT_BCC } from './render.js';

describe('newsletter text', () => {
  it('escapes markup and keeps only safe links', () => {
    expect(inline('<script>alert(1)</script>')).not.toContain('<script>');
    expect(inline('[RSVP](wearercap.org/karaoke)')).toContain('href="https://wearercap.org/karaoke"');
    expect(inline('[bad](javascript:void)')).toBe('bad');
    expect(inline('[bad](javascript:alert(1))')).not.toContain('href');
    expect(inline('**Five to seven**')).toBe('<strong>Five to seven</strong>');
  });
  it('normalizes links people type', () => {
    expect(safeUrl('/newsletter')).toBe('https://wearercap.org/newsletter');
    expect(safeUrl('signupgenius.com/go/abc')).toBe('https://signupgenius.com/go/abc');
    expect(safeUrl('mailto:rcaparents@ronclarkacademy.com')).toBe('mailto:rcaparents@ronclarkacademy.com');
    expect(safeUrl('data:text/html,hi')).toBe('');
  });
});

describe('email rendering', () => {
  const issue = () => ({
    ...template('full', '2026-10-25'),
    subject: 'This week', headline: 'This is how\nwe do it.', body: 'First.\n\nSecond with [a link](https://example.com).',
    blocks: [
      { ...newBlock('story'), heading: 'Before we sing, we serve.', body: 'EXP is back.', button: { label: 'Sign up', url: 'signupgenius.com/x' } },
      { ...newBlock('quote'), quote: 'We have feet, not roots.', by: 'A 7th grader' },
      { ...newBlock('dates'), items: [{ id: '1', when: 'Nov 5', what: 'RCA EXP', detail: 'Volunteers needed', url: '' }] },
      newBlock('photo'),
    ],
  });
  it('builds the email from tables with inline styles only', () => {
    const html = renderEmail(issue());
    expect(html).toContain('<table role="presentation"');
    expect(html).not.toMatch(/<style|class=|<script/);
    expect(html).toContain('we-are-rcap-header.png');
    expect(html).toContain('This is how<br>we do it.');
    expect(html).toContain('https://signupgenius.com/x');
    expect(html).toContain('We have feet, not roots.');
    expect(html).toContain('RCA EXP');
  });
  it('skips empty sections instead of leaving gaps', () => {
    const html = renderEmail({ ...template('quick', '2026-10-25'), blocks: [newBlock('dates'), newBlock('photo'), newBlock('quote')] });
    expect(html).not.toContain('Coming up.');
    expect(html).not.toContain('<img src=""');
  });
  it('tags parts for tap-to-edit only in the builder preview', () => {
    const c = issue();
    expect(renderEmail(c)).not.toContain('data-nb');
    const marked = renderEmail(c, { mark: true });
    expect(marked).toContain('data-nb="opening"');
    expect(marked).toContain('data-nb="closing"');
    for (const b of c.blocks.slice(0, 3)) expect(marked).toContain(`data-nb="block:${b.id}"`);
    expect(marked).not.toContain(`data-nb="block:${c.blocks[3].id}"`);
  });

  it('adds a web link only when one exists', () => {
    expect(renderEmail(issue())).not.toContain('VIEW ON THE WEB');
    expect(renderEmail(issue(), { webUrl: 'https://wearercap.org/newsletter/oct-25' })).toContain('VIEW ON THE WEB');
  });
  it('produces a full document and a readable plain-text twin', () => {
    expect(renderDocument(issue())).toMatch(/^<!doctype html>/);
    const text = plainText(issue());
    expect(text).toContain('Sign up: https://signupgenius.com/x');
    expect(text).toContain('Nov 5: RCA EXP');
    expect(text).not.toContain('<');
  });
  it('writes no em dashes into either template', () => {
    for (const f of ['quick', 'full']) expect(JSON.stringify(template(f, '2026-10-25'))).not.toMatch(/—/);
  });
});

describe('house style check', () => {
  it('flags dashes, exclamation points, missing alt text and unnamed quotes', () => {
    const c = { ...template('full', '2026-10-25'), subject: 'Hi!', headline: 'Big news — really', body: 'Come out!',
      blocks: [{ ...newBlock('photo'), image: { url: 'https://x.com/a.jpg', alt: '' } }, { ...newBlock('quote'), quote: 'We are blessed.' }] };
    const kinds = styleCheck(c).map((n) => n.kind);
    expect(kinds).toEqual(expect.arrayContaining(['dash', 'bang', 'alt', 'quote']));
    expect(styleCheck(c).filter((n) => n.kind === 'bang').map((n) => n.field)).not.toContain('Subject');
  });
  it('fixes dashes without touching links', () => {
    const c = fixDashes({ headline: 'One night — one room', body: '5–7 p.m.', button: { url: 'https://a.com/x--y' } });
    expect(c.headline).toBe('One night, one room');
    expect(c.body).toBe('5 to 7 p.m.');
    expect(c.button.url).toBe('https://a.com/x--y');
  });
});

describe('web addresses', () => {
  it('opens Gmail compose in the RCAP account with subject and hidden recipients', () => {
    const url = new URL(gmailComposeUrl({ subject: 'Ready, set, treat.' }));
    expect(url.hostname).toBe('mail.google.com');
    expect(url.searchParams.get('authuser')).toBe('rcaparents@ronclarkacademy.com');
    expect(url.searchParams.get('su')).toBe('Ready, set, treat.');
    expect(url.searchParams.get('bcc')).toBe(DEFAULT_BCC.replace(/\s+/g, ''));
    expect(url.searchParams.get('bcc')).toContain('rcap2031@ronclarkacademy.com');
    expect(new URL(gmailComposeUrl({ subject: 'x', bcc: 'a@b.com, c@d.com' })).searchParams.get('bcc')).toBe('a@b.com,c@d.com');
  });
  it('suggests a readable slug', () => {
    expect(suggestSlug({ headline: 'This is how we do it.' }, '2026-10-25')).toBe('october-25-this-is-how-we-do');
    expect(slugify('R&B Karaoke Night!')).toBe('r-and-b-karaoke-night');
  });
});
