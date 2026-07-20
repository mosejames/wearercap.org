import { describe, it, expect, vi } from 'vitest';
import { buildRoster, rosterMatches } from './Admin.jsx';

// Admin.jsx pulls in admin.js, which imports the real supabase client and
// throws at module load without VITE_SUPABASE_URL. Nothing here calls the
// data layer; the mock just lets the module graph load. maps.js is mocked for
// the same reason: the roster helpers are pure and never touch it.
vi.mock('../supabaseClient.js', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
vi.mock('../maps.js', () => ({ loadMaps: vi.fn(), loadMarker: vi.fn() }));

// family_directory() shape, trimmed to the fields the roster reads.
function family(userId, overrides = {}) {
  return {
    user_id: userId,
    parent_name: `Parent ${userId}`,
    child_names: `Child ${userId}`,
    area_label: '30349',
    area_lat: 33.65,
    area_lng: -84.44,
    direction: 'am',
    weekdays: ['mon'],
    ...overrides,
  };
}

// members row shape.
function member(userId, overrides = {}) {
  return {
    user_id: userId,
    email: `${userId}@example.com`,
    role: 'parent',
    approval: 'approved',
    can_organize: false,
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
  };
}

describe('buildRoster', () => {
  it('renders a family the same way it always did, with no email on the row', () => {
    const rows = buildRoster([family('u1')], [member('u1')]);
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe('u1');
    expect(rows[0].family).toMatchObject({ parent_name: 'Parent u1' });
  });

  // The gap this whole change exists to close: since 0008 the directory only
  // returns rows that HAVE a families row, so an approved account that never
  // filled in the form is in no roster and, under auto-approve, in no queue
  // either. Invisible and unremovable until it shows up here.
  it('includes an approved member who has no family row', () => {
    const rows = buildRoster([], [member('ghost')]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ userId: 'ghost', family: null, email: 'ghost@example.com' });
  });

  it('puts family-less accounts after every real family', () => {
    const rows = buildRoster(
      [family('u1'), family('u2')],
      [member('ghost'), member('u1'), member('u2')],
    );
    expect(rows.map((r) => r.userId)).toEqual(['u1', 'u2', 'ghost']);
    expect(rows[2].family).toBeNull();
  });

  it('keeps the directory order for the families half', () => {
    const rows = buildRoster([family('u2'), family('u1')], [member('u1'), member('u2')]);
    expect(rows.map((r) => r.userId)).toEqual(['u2', 'u1']);
  });

  // Pending accounts belong to the queue above, which already has its own
  // "no family details yet" card. Listing them in both places would give one
  // account two sets of buttons that disagree about what it is.
  it('leaves pending members out entirely', () => {
    const rows = buildRoster([], [member('waiting', { approval: 'pending' })]);
    expect(rows).toEqual([]);
  });

  it('does not add a second row for a family whose member row is pending', () => {
    // Should not happen (0008's directory filters on approval) but if the two
    // reads ever disagree, the family row must not be duplicated as a ghost.
    const rows = buildRoster([family('u1')], [member('u1', { approval: 'pending' })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].family).not.toBeNull();
  });

  it('orders family-less accounts oldest signup first', () => {
    const rows = buildRoster([], [
      member('newer', { created_at: '2026-07-10T00:00:00Z' }),
      member('older', { created_at: '2026-07-01T00:00:00Z' }),
    ]);
    expect(rows.map((r) => r.userId)).toEqual(['older', 'newer']);
  });

  it('falls back to email for a stable order when created_at is missing', () => {
    const rows = buildRoster([], [
      member('b', { email: 'b@example.com', created_at: null }),
      member('a', { email: 'a@example.com', created_at: null }),
    ]);
    expect(rows.map((r) => r.userId)).toEqual(['a', 'b']);
  });

  it('does not mutate the arrays it is given', () => {
    const members = [
      member('newer', { created_at: '2026-07-10T00:00:00Z' }),
      member('older', { created_at: '2026-07-01T00:00:00Z' }),
    ];
    const families = [family('u1')];
    buildRoster(families, members);
    expect(members.map((m) => m.user_id)).toEqual(['newer', 'older']);
    expect(families.map((f) => f.user_id)).toEqual(['u1']);
  });

  it('carries the email on family rows too, for the search box', () => {
    const rows = buildRoster([family('u1')], [member('u1', { email: 'pat@example.com' })]);
    expect(rows[0].email).toBe('pat@example.com');
  });

  // Degraded load: fetchAllMembers is caught to [] so a failure there cannot
  // take the whole panel down. The families half must still render.
  it('still lists families when the members read came back empty', () => {
    const rows = buildRoster([family('u1')], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBeNull();
  });

  it('returns nothing when there are no families and no members', () => {
    expect(buildRoster([], [])).toEqual([]);
  });
});

describe('rosterMatches', () => {
  const familyRow = { userId: 'u1', family: family('u1', { parent_name: 'Pat Parent', child_names: 'Kid One', area_label: '30349' }), email: 'pat@example.com' };
  const ghostRow = { userId: 'g1', family: null, email: 'mose@omgbooth.com' };

  it('matches everything on an empty query', () => {
    expect(rosterMatches(familyRow, '')).toBe(true);
    expect(rosterMatches(ghostRow, '')).toBe(true);
  });

  it('matches a family on parent, child, or area', () => {
    expect(rosterMatches(familyRow, 'pat parent')).toBe(true);
    expect(rosterMatches(familyRow, 'kid one')).toBe(true);
    expect(rosterMatches(familyRow, '30349')).toBe(true);
  });

  // Without this a family-less account is unfindable: the email is the only
  // string it has.
  it('matches a family-less account on its email', () => {
    expect(rosterMatches(ghostRow, 'omgbooth')).toBe(true);
    expect(rosterMatches(ghostRow, 'mose@omgbooth.com')).toBe(true);
  });

  it('matches a family on its email as well', () => {
    expect(rosterMatches(familyRow, 'pat@example.com')).toBe(true);
  });

  it('does not match an unrelated query', () => {
    expect(rosterMatches(familyRow, 'zzz')).toBe(false);
    expect(rosterMatches(ghostRow, 'zzz')).toBe(false);
  });

  it('does not throw on a row with neither family nor email', () => {
    expect(rosterMatches({ userId: 'x', family: null, email: null }, 'anything')).toBe(false);
  });
});
