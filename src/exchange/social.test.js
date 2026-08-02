import { describe, it, expect, beforeEach } from 'vitest';
import { setItemTypes } from './config.js';
import { roughly, recentActivity, whatsWaiting, socialProof, suggestedPost } from './social.js';

const NOW = new Date('2026-08-14T15:00:00Z');   // a Friday afternoon
const ago = (ms) => new Date(NOW - ms).toISOString();
const DAY = 86400000;

const BINS = [
  { id: 'ami', holder_house: 'amistad' },
  { id: 'alt', holder_house: 'altruismo' },
];

beforeEach(() => {
  setItemTypes([
    { id: 'polo', label: 'House Polo · Co-Ed', gender: 'coed', housed: true, hidden: false, size_set: 'tops' },
    { id: 'pants-boys', label: 'Khaki Pants', gender: 'boys', housed: false, hidden: false, size_set: 'boys-bottoms' },
  ]);
});

describe('roughly', () => {
  it('is vague on purpose — nobody needs the minute', () => {
    expect(roughly(ago(60000), NOW)).toBe('just now');
    expect(roughly(ago(30 * 3600000), NOW)).toBe('yesterday');
    expect(roughly(ago(4 * DAY), NOW)).toBe('on Monday');
    expect(roughly(ago(10 * DAY), NOW)).toBe('last week');
  });

  it('goes quiet rather than saying something stale', () => {
    expect(roughly(ago(60 * DAY), NOW)).toBe('');
  });
});

describe('recentActivity', () => {
  const moves = [
    { id: 'm1', bin_id: 'ami', item_type: 'polo', size: 'M', house: 'amistad',
      qty_delta: 6, kind: 'add', created_at: ago(3600000) },
    { id: 'm2', bin_id: 'alt', item_type: 'pants-boys', size: '12', house: '',
      qty_delta: -1, kind: 'fulfill', created_at: ago(2 * DAY) },
    { id: 'm3', bin_id: 'ami', item_type: 'polo', size: 'M', house: 'amistad',
      qty_delta: -2, kind: 'adjust', created_at: ago(3600000) },
    { id: 'm4', bin_id: 'ami', item_type: 'polo', size: 'L', house: 'amistad',
      qty_delta: 3, kind: 'add', created_at: ago(90 * DAY) },
  ];

  it('says what came in and what went home', () => {
    const out = recentActivity(moves, BINS, NOW);
    expect(out.map((x) => x.text)).toEqual([
      'Someone dropped off 6 house polos just now.',
      'A family took khaki pants home on Wednesday.',
    ]);
  });

  it('ignores corrections — a recount is not news', () => {
    expect(recentActivity(moves, BINS, NOW).some((x) => x.key === 'a-m3')).toBe(false);
  });

  it('drops anything old enough to be misleading', () => {
    expect(recentActivity(moves, BINS, NOW).some((x) => x.key === 'a-m4')).toBe(false);
  });

  it('never names a person or a bin', () => {
    const all = recentActivity(moves, BINS, NOW).map((x) => x.text).join(' ');
    expect(all).not.toMatch(/AMI-|ALT-/);
    expect(all).not.toMatch(/Shekita|Yelena/);
  });

  it('holds up with nothing to say', () => {
    expect(recentActivity([], [], NOW)).toEqual([]);
    expect(recentActivity(null, null, NOW)).toEqual([]);
  });
});

describe('whatsWaiting', () => {
  const inv = [
    { bin_id: 'ami', item_type: 'polo', size: 'M', house: 'amistad', qty: 22 },
    { bin_id: 'ami', item_type: 'polo', size: 'L', house: 'amistad', qty: 18 },
    { bin_id: 'alt', item_type: 'pants-boys', size: '12', house: '', qty: 5 },
    { bin_id: 'alt', item_type: 'pants-boys', size: '14', house: '', qty: 1 },
  ];

  it('adds sizes together — the headline is the pile, not the size run', () => {
    const out = whatsWaiting(inv, BINS);
    expect(out[0].text).toBe('Amistad is sitting on 40 house polos, waiting for a new home.');
  });

  it('speaks generally for house-neutral kit', () => {
    const out = whatsWaiting(inv, BINS);
    expect(out[1].text).toBe('There are 6 khaki pants in the bins right now, waiting for a new home.');
  });

  it('stays quiet about a single item', () => {
    const out = whatsWaiting([{ bin_id: 'ami', item_type: 'polo', size: 'M', house: 'amistad', qty: 1 }], BINS);
    expect(out).toEqual([]);
  });

  it('ignores a bin that drifted negative', () => {
    const out = whatsWaiting([
      { bin_id: 'ami', item_type: 'polo', size: 'M', house: 'amistad', qty: 4 },
      { bin_id: 'alt', item_type: 'polo', size: 'M', house: 'amistad', qty: -9 },
    ], BINS);
    expect(out[0].text).toContain('4 house polos');
  });
});

describe('socialProof', () => {
  it('alternates something that happened with something that is waiting', () => {
    const moves = [{ id: 'm1', bin_id: 'ami', item_type: 'polo', size: 'M', house: 'amistad',
      qty_delta: 6, kind: 'add', created_at: ago(3600000) }];
    const inv = [{ bin_id: 'ami', item_type: 'polo', size: 'M', house: 'amistad', qty: 22 }];
    const out = socialProof(moves, inv, BINS, NOW);
    expect(out[0].key).toMatch(/^a-/);
    expect(out[1].key).toMatch(/^w-/);
  });

  it('says nothing at all rather than something hollow', () => {
    expect(socialProof([], [], [], NOW)).toEqual([]);
  });
});

describe('suggestedPost', () => {
  const holder = { name: 'Shekita James', house: 'amistad' };
  const inv = [
    { item_type: 'polo', size: 'M', house: 'amistad', qty: 12 },
    { item_type: 'polo', size: 'L', house: 'amistad', qty: 6 },
    { item_type: 'pants-boys', size: '12', house: '', qty: 4 },
  ];

  it('writes a post out of what is actually in the trunk', () => {
    const post = suggestedPost(holder, inv);
    expect(post).toContain('Amistad families');
    expect(post).toContain('Shekita here');
    expect(post).toContain('18 house polos (M, L)');
    expect(post).toContain('4 khaki pants (12)');
    expect(post).toContain('wearercap.org/uniform-exchange');
  });

  it('asks for donations too — the bin works both ways', () => {
    expect(suggestedPost(holder, inv)).toContain('outgrown');
  });

  it('says nothing when the bin is empty, rather than advertising nothing', () => {
    expect(suggestedPost(holder, [])).toBe('');
    expect(suggestedPost(holder, [{ item_type: 'polo', size: 'M', house: 'amistad', qty: 0 }])).toBe('');
  });
});
