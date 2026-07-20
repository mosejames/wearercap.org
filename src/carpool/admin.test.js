import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchPendingSignups,
  fetchAllFamilies,
  fetchAllGroups,
  fetchAutoApprove,
  fetchOrganizerFlags,
  approveMember,
  declineSignup,
  unapproveMember,
  setAutoApprove,
  setCanOrganize,
  removeFromGroup,
  deleteGroup,
} from './admin.js';
import { supabase } from './supabaseClient.js';

vi.mock('./supabaseClient.js', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));

// A thenable that records the builder calls made on it and resolves to a
// fixed { data, error } the way a supabase query does. Same shape as the
// helper in groups.test.js, plus the order/in links the admin reads use.
function chain(result) {
  const calls = [];
  const link = (name) => (...args) => { calls.push([name, ...args]); return builder; };
  const builder = {
    calls,
    select: link('select'),
    insert: link('insert'),
    update: link('update'),
    delete: link('delete'),
    eq: link('eq'),
    in: link('in'),
    order: link('order'),
    single: link('single'),
    maybeSingle: link('maybeSingle'),
    then: (onOk, onErr) => Promise.resolve(result).then(onOk, onErr),
  };
  return builder;
}

beforeEach(() => {
  supabase.rpc.mockReset();
  supabase.from.mockReset();
});

describe('fetchPendingSignups', () => {
  const pendingMembers = [
    { user_id: 'u1', email: 'a@example.com', created_at: '2026-07-01' },
    { user_id: 'u2', email: 'b@example.com', created_at: '2026-07-02' },
  ];
  const familyRow = {
    user_id: 'u1',
    parent_name: 'Pat Parent',
    child_names: 'Kid One',
    area_label: '30349',
    direction: 'am',
    weekdays: ['mon', 'wed'],
    contact_email: 'pat@example.com',
    contact_phone: '404-555-0000',
  };

  function mockQueries({ members, families }) {
    const membersQ = chain(members);
    const familiesQ = chain(families);
    supabase.from.mockImplementation((t) => (t === 'members' ? membersQ : familiesQ));
    return { membersQ, familiesQ };
  }

  it('joins each pending member to their family row by user_id', async () => {
    mockQueries({
      members: { data: pendingMembers, error: null },
      families: { data: [familyRow], error: null },
    });
    const rows = await fetchPendingSignups();
    expect(rows[0]).toMatchObject({
      userId: 'u1',
      email: 'a@example.com',
      createdAt: '2026-07-01',
    });
    expect(rows[0].family).toMatchObject({ parent_name: 'Pat Parent', area_label: '30349' });
  });

  it('keeps a pending member with no family row, with family: null', async () => {
    mockQueries({
      members: { data: pendingMembers, error: null },
      families: { data: [familyRow], error: null },
    });
    const rows = await fetchPendingSignups();
    expect(rows).toHaveLength(2);
    expect(rows[1].userId).toBe('u2');
    expect(rows[1].family).toBeNull();
  });

  it('queries only pending members, oldest first', async () => {
    const { membersQ } = mockQueries({
      members: { data: [], error: null },
      families: { data: [], error: null },
    });
    await fetchPendingSignups();
    expect(membersQ.calls).toContainEqual(['eq', 'approval', 'pending']);
    expect(membersQ.calls).toContainEqual(['order', 'created_at', { ascending: true }]);
  });

  it('scopes the families query to the pending user ids', async () => {
    const { familiesQ } = mockQueries({
      members: { data: pendingMembers, error: null },
      families: { data: [], error: null },
    });
    await fetchPendingSignups();
    expect(familiesQ.calls).toContainEqual(['in', 'user_id', ['u1', 'u2']]);
  });

  it('skips the families query entirely when no one is pending', async () => {
    mockQueries({
      members: { data: [], error: null },
      families: { data: [], error: null },
    });
    await expect(fetchPendingSignups()).resolves.toEqual([]);
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.from).toHaveBeenCalledWith('members');
  });

  // Admin SELECT on families can see the protected columns (address, lat,
  // lng). The queue deliberately never asks for them: the gut check runs on
  // the same coarse fields parents already share, plus contact for the
  // mailto link.
  it('never selects address or precise coordinates from families', async () => {
    const { familiesQ } = mockQueries({
      members: { data: pendingMembers, error: null },
      families: { data: [], error: null },
    });
    await fetchPendingSignups();
    const [, selected] = familiesQ.calls.find((c) => c[0] === 'select');
    expect(selected).not.toMatch(/address/);
    expect(selected).not.toMatch(/(^|[^_])\blat\b/);
    expect(selected).not.toMatch(/(^|[^_])\blng\b/);
  });

  // Belt and braces on the same rule: even if the database hands back extra
  // columns, the family object exposes only the whitelisted fields.
  it('strips unexpected columns from the family object', async () => {
    mockQueries({
      members: { data: [pendingMembers[0]], error: null },
      families: { data: [{ ...familyRow, address: '123 Secret St', lat: 33.65, lng: -84.44 }], error: null },
    });
    const [row] = await fetchPendingSignups();
    expect(row.family).toEqual({
      parent_name: 'Pat Parent',
      child_names: 'Kid One',
      area_label: '30349',
      direction: 'am',
      weekdays: ['mon', 'wed'],
      contact_email: 'pat@example.com',
      contact_phone: '404-555-0000',
    });
  });

  it('throws the database message when the members query fails', async () => {
    mockQueries({
      members: { data: null, error: { message: 'members nope' } },
      families: { data: [], error: null },
    });
    await expect(fetchPendingSignups()).rejects.toThrow('members nope');
  });

  it('throws the database message when the families query fails', async () => {
    mockQueries({
      members: { data: pendingMembers, error: null },
      families: { data: null, error: { message: 'families nope' } },
    });
    await expect(fetchPendingSignups()).rejects.toThrow('families nope');
  });
});

describe('fetchAllFamilies', () => {
  it('goes through the family_directory RPC, never a table select', async () => {
    supabase.rpc.mockResolvedValue({ data: [{ user_id: 'u1', parent_name: 'Pat Parent' }], error: null });
    const rows = await fetchAllFamilies();
    expect(supabase.rpc).toHaveBeenCalledWith('family_directory');
    expect(rows).toHaveLength(1);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns an empty array when data is null', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await expect(fetchAllFamilies()).resolves.toEqual([]);
  });

  it('throws the database message', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'nope' } });
    await expect(fetchAllFamilies()).rejects.toThrow('nope');
  });
});

describe('fetchAutoApprove', () => {
  it('reads the one settings row and returns the flag', async () => {
    const q = chain({ data: { auto_approve_signups: false }, error: null });
    supabase.from.mockReturnValue(q);
    await expect(fetchAutoApprove()).resolves.toBe(false);
    expect(supabase.from).toHaveBeenCalledWith('settings');
    expect(q.calls).toContainEqual(['select', 'auto_approve_signups']);
    expect(q.calls).toContainEqual(['eq', 'id', true]);
  });

  // auto_approve_enabled() in the database coalesces a missing row to true and
  // the column default matches it, so an absent row really does behave as on.
  // Reporting false here would put a lie on the admin's screen.
  it('reports true when there is no settings row', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: null }));
    await expect(fetchAutoApprove()).resolves.toBe(true);
  });

  it('throws the database message', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: { message: 'nope' } }));
    await expect(fetchAutoApprove()).rejects.toThrow('nope');
  });
});

describe('setAutoApprove', () => {
  it('updates only the flag, scoped to the single row', async () => {
    const q = chain({ error: null });
    supabase.from.mockReturnValue(q);
    await setAutoApprove(false);
    expect(supabase.from).toHaveBeenCalledWith('settings');
    expect(q.calls).toContainEqual(['update', { auto_approve_signups: false }]);
    expect(q.calls).toContainEqual(['eq', 'id', true]);
  });

  // 0008 defines no INSERT and no DELETE policy on settings on purpose, so
  // with RLS on both are denied for everyone. An insert or upsert here would
  // fail exactly when an admin was trying to fix a missing row.
  it('never inserts or deletes', async () => {
    const q = chain({ error: null });
    supabase.from.mockReturnValue(q);
    await setAutoApprove(true);
    expect(q.calls.map((c) => c[0])).not.toContain('insert');
    expect(q.calls.map((c) => c[0])).not.toContain('delete');
  });

  it('refuses a non-boolean before any network call', async () => {
    await expect(setAutoApprove('true')).rejects.toThrow();
    await expect(setAutoApprove()).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('treats false as a real value, not a missing argument', async () => {
    const q = chain({ error: null });
    supabase.from.mockReturnValue(q);
    await expect(setAutoApprove(false)).resolves.toBeUndefined();
    expect(q.calls).toContainEqual(['update', { auto_approve_signups: false }]);
  });

  it('throws the database message', async () => {
    supabase.from.mockReturnValue(chain({ error: { message: 'nope' } }));
    await expect(setAutoApprove(true)).rejects.toThrow('nope');
  });
});

describe('fetchOrganizerFlags', () => {
  it('reads the flag and the role from members', async () => {
    const q = chain({ data: [{ user_id: 'u1', role: 'parent', can_organize: true }], error: null });
    supabase.from.mockReturnValue(q);
    const rows = await fetchOrganizerFlags();
    expect(supabase.from).toHaveBeenCalledWith('members');
    expect(q.calls).toContainEqual(['select', 'user_id, role, can_organize']);
    expect(rows).toHaveLength(1);
  });

  // family_directory() is called by every parent, so the admin-only flag must
  // never be added to it. This read is what keeps the two apart.
  it('never goes through the family_directory RPC', async () => {
    supabase.from.mockReturnValue(chain({ data: [], error: null }));
    await fetchOrganizerFlags();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('returns an empty array when data is null', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: null }));
    await expect(fetchOrganizerFlags()).resolves.toEqual([]);
  });

  it('throws the database message', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: { message: 'nope' } }));
    await expect(fetchOrganizerFlags()).rejects.toThrow('nope');
  });
});

describe('setCanOrganize', () => {
  it('updates can_organize, scoped to the target', async () => {
    const q = chain({ error: null });
    supabase.from.mockReturnValue(q);
    await setCanOrganize('u1', true);
    expect(supabase.from).toHaveBeenCalledWith('members');
    expect(q.calls).toContainEqual(['update', { can_organize: true }]);
    expect(q.calls).toContainEqual(['eq', 'user_id', 'u1']);
  });

  // 0008 widened authenticated's column grant to (approval, can_organize), so
  // an approval key in this payload would be ACCEPTED by the database: one
  // click meant only to hand out group creating would quietly re-approve a
  // family an admin had just removed. Pin the payload to the one key, exactly
  // as approveMember's payload is pinned.
  it('never writes approval or role', async () => {
    const q = chain({ error: null });
    supabase.from.mockReturnValue(q);
    await setCanOrganize('u1', false);
    const [, payload] = q.calls.find((c) => c[0] === 'update');
    expect(Object.keys(payload)).toEqual(['can_organize']);
  });

  it('refuses to run without a user id, before any network call', async () => {
    await expect(setCanOrganize(undefined, true)).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  // An undefined would be sent as null and violate the column's NOT NULL, and
  // a missing argument must never be read as "turn it off".
  it('refuses a non-boolean before any network call', async () => {
    await expect(setCanOrganize('u1')).rejects.toThrow();
    await expect(setCanOrganize('u1', 'yes')).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('treats false as a real value, not a missing argument', async () => {
    const q = chain({ error: null });
    supabase.from.mockReturnValue(q);
    await expect(setCanOrganize('u1', false)).resolves.toBeUndefined();
    expect(q.calls).toContainEqual(['update', { can_organize: false }]);
  });

  it('throws the database message', async () => {
    supabase.from.mockReturnValue(chain({ error: { message: 'nope' } }));
    await expect(setCanOrganize('u1', true)).rejects.toThrow('nope');
  });
});

describe('fetchAllGroups', () => {
  const groups = [
    { id: 'g1', name: 'Alpha' },
    { id: 'g2', name: 'Beta' },
  ];
  const memberships = [
    { group_id: 'g1', user_id: 'u1', joined_at: '2026-07-01' },
    { group_id: 'g1', user_id: 'u2', joined_at: '2026-07-02' },
  ];

  function mockQueries({ groups, memberships }) {
    const groupsQ = chain(groups);
    const membershipsQ = chain(memberships);
    supabase.from.mockImplementation((t) => (t === 'groups' ? groupsQ : membershipsQ));
    return { groupsQ, membershipsQ };
  }

  it('attaches each group its membership rows', async () => {
    mockQueries({
      groups: { data: groups, error: null },
      memberships: { data: memberships, error: null },
    });
    const rows = await fetchAllGroups();
    expect(rows[0].id).toBe('g1');
    expect(rows[0].members).toEqual([
      { user_id: 'u1', joined_at: '2026-07-01' },
      { user_id: 'u2', joined_at: '2026-07-02' },
    ]);
  });

  it('gives a memberless group an empty members array, not undefined', async () => {
    mockQueries({
      groups: { data: groups, error: null },
      memberships: { data: memberships, error: null },
    });
    const rows = await fetchAllGroups();
    expect(rows[1].id).toBe('g2');
    expect(rows[1].members).toEqual([]);
  });

  it('returns an empty array when there are no groups', async () => {
    mockQueries({
      groups: { data: [], error: null },
      memberships: { data: [], error: null },
    });
    await expect(fetchAllGroups()).resolves.toEqual([]);
  });

  it('throws the database message when the groups query fails', async () => {
    mockQueries({
      groups: { data: null, error: { message: 'groups nope' } },
      memberships: { data: [], error: null },
    });
    await expect(fetchAllGroups()).rejects.toThrow('groups nope');
  });

  it('throws the database message when the memberships query fails', async () => {
    mockQueries({
      groups: { data: groups, error: null },
      memberships: { data: null, error: { message: 'memberships nope' } },
    });
    await expect(fetchAllGroups()).rejects.toThrow('memberships nope');
  });
});

describe('approveMember', () => {
  it('updates ONLY the approval column, scoped to the target', async () => {
    const q = chain({ error: null });
    supabase.from.mockReturnValue(q);
    await approveMember('u1');
    expect(supabase.from).toHaveBeenCalledWith('members');
    expect(q.calls).toContainEqual(['update', { approval: 'approved' }]);
    expect(q.calls).toContainEqual(['eq', 'user_id', 'u1']);
  });

  // 0006's column grant allows authenticated to UPDATE only members.approval.
  // A payload carrying role or email would 42501 in production; this pins the
  // exact payload so it can never grow.
  it('never writes role or email', async () => {
    const q = chain({ error: null });
    supabase.from.mockReturnValue(q);
    await approveMember('u1');
    const [, payload] = q.calls.find((c) => c[0] === 'update');
    expect(Object.keys(payload)).toEqual(['approval']);
  });

  it('refuses to run without a user id', async () => {
    await expect(approveMember()).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('throws the database message', async () => {
    supabase.from.mockReturnValue(chain({ error: { message: 'nope' } }));
    await expect(approveMember('u1')).rejects.toThrow('nope');
  });
});

describe('declineSignup', () => {
  it('goes through the decline_signup RPC with the target uuid', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await declineSignup('u1');
    expect(supabase.rpc).toHaveBeenCalledWith('decline_signup', { target: 'u1' });
  });

  // The schema defines no DELETE policy on members or families: the RPC is
  // the ONLY sanctioned delete path, and its body holds every guard
  // (admin-target refusal, approved-family refusal). A direct .from() delete
  // would be silently denied by RLS today and become a guard bypass if a
  // policy ever appeared, so this test forbids the table route outright.
  it('never touches members or families tables directly', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await declineSignup('u1');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('refuses to run without a user id, before any network call', async () => {
    await expect(declineSignup()).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('surfaces the approved-family guard as a readable Error', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'That family is approved; un-approve them first' },
    });
    await expect(declineSignup('u1'))
      .rejects.toThrow('That family is approved; un-approve them first');
  });

  it('surfaces the admin-target guard as a readable Error', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'An admin account cannot be declined' },
    });
    await expect(declineSignup('u1')).rejects.toThrow('An admin account cannot be declined');
  });
});

describe('unapproveMember', () => {
  it('goes through the unapprove_member RPC with the target uuid', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await unapproveMember('u1');
    expect(supabase.rpc).toHaveBeenCalledWith('unapprove_member', { target: 'u1' });
  });

  // The RPC pairs the approval flip with the membership sweep atomically. A
  // direct members update (legal under the approval column grant) would
  // leave the target un-approved but still seated in groups — exactly the
  // half-removed state 0006 exists to prevent. Table route forbidden.
  it('never updates members or sweeps memberships directly', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await unapproveMember('u1');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('refuses to run without a user id, before any network call', async () => {
    await expect(unapproveMember()).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('surfaces the admin-target guard as a readable Error', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'An admin account cannot be un-approved' },
    });
    await expect(unapproveMember('u1')).rejects.toThrow('An admin account cannot be un-approved');
  });
});

describe('removeFromGroup', () => {
  it('deletes exactly one membership row, keyed by both ids', async () => {
    const q = chain({ error: null });
    supabase.from.mockReturnValue(q);
    await removeFromGroup('g1', 'u1');
    expect(supabase.from).toHaveBeenCalledWith('memberships');
    expect(q.calls).toContainEqual(['delete']);
    expect(q.calls).toContainEqual(['eq', 'group_id', 'g1']);
    expect(q.calls).toContainEqual(['eq', 'user_id', 'u1']);
  });

  // For an admin, a group_id-only delete is a LEGAL statement that would
  // empty the whole group (memberships_delete_self_or_organizer's admin
  // branch has no row scoping). The missing-userId throw has to fire before
  // any network call — same reasoning as leaveGroup in groups.js.
  it('throws on a missing userId before any network call', async () => {
    await expect(removeFromGroup('g1')).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('throws on a missing groupId before any network call', async () => {
    await expect(removeFromGroup(undefined, 'u1')).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('throws the database message', async () => {
    supabase.from.mockReturnValue(chain({ error: { message: 'nope' } }));
    await expect(removeFromGroup('g1', 'u1')).rejects.toThrow('nope');
  });
});

describe('deleteGroup', () => {
  it('deletes the one group by id', async () => {
    const q = chain({ error: null });
    supabase.from.mockReturnValue(q);
    await deleteGroup('g1');
    expect(supabase.from).toHaveBeenCalledWith('groups');
    expect(q.calls).toContainEqual(['delete']);
    expect(q.calls).toContainEqual(['eq', 'id', 'g1']);
  });

  it('refuses to run without a group id', async () => {
    await expect(deleteGroup()).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('throws the database message', async () => {
    supabase.from.mockReturnValue(chain({ error: { message: 'nope' } }));
    await expect(deleteGroup('g1')).rejects.toThrow('nope');
  });
});
