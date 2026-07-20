import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  rankGroups,
  scheduleOverlap,
  summarizeSchedule,
  fetchGroups,
  buildGroupRecord,
  createGroup,
  seedOwnMembership,
  fetchMyMemberships,
  requestToJoin,
  fetchMyRequests,
  fetchPendingRequesters,
  decideRequest,
  fetchRoster,
  fetchCanOrganize,
  leaveGroup,
  withdrawRequest,
} from './groups.js';
import { supabase } from './supabaseClient.js';

vi.mock('./supabaseClient.js', () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));

const CP = { lat: 33.6534, lng: -84.4494 };   // College Park
const DECATUR = { lat: 33.7748, lng: -84.2963 };

// A thenable that records the builder calls made on it and resolves to a
// fixed { data, error } the way a supabase query does.
function chain(result) {
  const calls = [];
  const link = (name) => (...args) => { calls.push([name, ...args]); return builder; };
  const builder = {
    calls,
    select: link('select'),
    insert: link('insert'),
    delete: link('delete'),
    eq: link('eq'),
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

describe('rankGroups', () => {
  const me = { area_lat: CP.lat, area_lng: CP.lng };
  const groups = [
    { id: 'far', name: 'Decatur Crew', area_lat: DECATUR.lat, area_lng: DECATUR.lng },
    { id: 'near', name: 'Near Crew', area_lat: 33.66, area_lng: -84.45 },
  ];

  it('annotates distanceMiles and sorts ascending', () => {
    const r = rankGroups(me, groups);
    expect(r.map((g) => g.id)).toEqual(['near', 'far']);
    expect(typeof r[0].distanceMiles).toBe('number');
    expect(r[0].distanceMiles).toBeLessThan(r[1].distanceMiles);
  });

  // Absolute, not relative: rankGroups must keep borrowing milesBetween from
  // directory.js. If somebody re-implements haversine here and gets it wrong,
  // every relative assertion above still passes but this one does not.
  it('measures the real distance (College Park to Decatur)', () => {
    const [, far] = rankGroups(me, groups);
    expect(far.id).toBe('far');
    expect(far.distanceMiles).toBeCloseTo(12.157, 2);
  });

  it('keeps every group, including one centred on the caller', () => {
    const mine = { id: 'mine', name: 'Mine', area_lat: CP.lat, area_lng: CP.lng };
    expect(rankGroups(me, [...groups, mine])).toHaveLength(3);
  });

  it('breaks ties on name', () => {
    const same = [
      { id: 'b', name: 'Beta', area_lat: 33.66, area_lng: -84.45 },
      { id: 'a', name: 'Alpha', area_lat: 33.66, area_lng: -84.45 },
    ];
    expect(rankGroups(me, same).map((g) => g.id)).toEqual(['a', 'b']);
  });

  it('respects limit', () => {
    expect(rankGroups(me, groups, { limit: 1 })).toHaveLength(1);
  });

  it('handles empty input', () => {
    expect(rankGroups(me, [])).toEqual([]);
  });
});

describe('scheduleOverlap', () => {
  const days = (d) => ({ direction: 'both', weekdays: d });

  it('matches identical directions', () => {
    expect(scheduleOverlap({ direction: 'am', weekdays: ['mon'] }, { direction: 'am', weekdays: ['mon'] }).directionMatches).toBe(true);
    expect(scheduleOverlap({ direction: 'pm', weekdays: ['mon'] }, { direction: 'pm', weekdays: ['mon'] }).directionMatches).toBe(true);
  });

  it('does not match am against pm', () => {
    expect(scheduleOverlap({ direction: 'am', weekdays: ['mon'] }, { direction: 'pm', weekdays: ['mon'] }).directionMatches).toBe(false);
  });

  it('matches when either side is both', () => {
    expect(scheduleOverlap({ direction: 'both', weekdays: ['mon'] }, { direction: 'pm', weekdays: ['mon'] }).directionMatches).toBe(true);
    expect(scheduleOverlap({ direction: 'am', weekdays: ['mon'] }, { direction: 'both', weekdays: ['mon'] }).directionMatches).toBe(true);
    expect(scheduleOverlap({ direction: 'both', weekdays: ['mon'] }, { direction: 'both', weekdays: ['mon'] }).directionMatches).toBe(true);
  });

  it('intersects weekdays in mon..fri order', () => {
    const r = scheduleOverlap(days(['fri', 'mon', 'wed']), days(['wed', 'fri', 'tue']));
    expect(r.sharedDays).toEqual(['wed', 'fri']);
  });

  it('returns an empty sharedDays when no day is shared', () => {
    expect(scheduleOverlap(days(['mon']), days(['tue'])).sharedDays).toEqual([]);
  });

  it('tolerates missing weekdays', () => {
    expect(scheduleOverlap({ direction: 'am' }, { direction: 'am' }).sharedDays).toEqual([]);
  });
});

describe('summarizeSchedule', () => {
  it('labels a morning schedule', () => {
    expect(summarizeSchedule({ direction: 'am', weekdays: ['mon', 'wed'] })).toBe('Morning · mon, wed');
  });
  it('labels an afternoon schedule', () => {
    expect(summarizeSchedule({ direction: 'pm', weekdays: ['tue'] })).toBe('Afternoon · tue');
  });
  it('labels a both-ways schedule', () => {
    expect(summarizeSchedule({ direction: 'both', weekdays: ['mon', 'fri'] })).toBe('Morning & afternoon · mon, fri');
  });
  it('orders days mon..fri regardless of input order', () => {
    expect(summarizeSchedule({ direction: 'am', weekdays: ['fri', 'mon', 'wed'] })).toBe('Morning · mon, wed, fri');
  });
  it('omits the day list when there are no weekdays', () => {
    expect(summarizeSchedule({ direction: 'am', weekdays: [] })).toBe('Morning');
  });
});

describe('fetchGroups', () => {
  it('selects every visible group', async () => {
    const q = chain({ data: [{ id: 'g1' }], error: null });
    supabase.from.mockReturnValue(q);
    await expect(fetchGroups()).resolves.toEqual([{ id: 'g1' }]);
    expect(supabase.from).toHaveBeenCalledWith('groups');
  });

  it('returns an empty array when data is null', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: null }));
    await expect(fetchGroups()).resolves.toEqual([]);
  });

  it('throws the database message', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: { message: 'nope' } }));
    await expect(fetchGroups()).rejects.toThrow('nope');
  });
});

describe('buildGroupRecord', () => {
  const base = {
    userId: 'u1',
    name: 'Rock Springs Run',
    direction: 'both',
    weekdays: ['mon', 'tue'],
    meetingPoint: 'Library lot',
  };

  it('maps camelCase input onto the group columns', () => {
    expect(buildGroupRecord(base)).toEqual({
      name: 'Rock Springs Run',
      direction: 'both',
      weekdays: ['mon', 'tue'],
      meeting_point: 'Library lot',
      created_by: 'u1',
    });
  });

  it('emits only writable columns, dropping trigger- and database-owned ones', () => {
    const r = buildGroupRecord({
      ...base,
      id: 'g9',
      created_at: '2026-01-01',
      distanceMiles: 3.2,
      area_lat: 1,
      area_lng: 2,
      area_label: 'spoofed',
      status: 'full',
    });
    for (const k of ['id', 'created_at', 'distanceMiles', 'area_lat', 'area_lng', 'area_label', 'status']) {
      expect(r).not.toHaveProperty(k);
    }
  });

  it('trims the name', () => {
    expect(buildGroupRecord({ ...base, name: '  Rock Springs Run  ' }).name).toBe('Rock Springs Run');
  });

  it('nulls an empty meeting point', () => {
    expect(buildGroupRecord({ ...base, meetingPoint: '' }).meeting_point).toBeNull();
    expect(buildGroupRecord({ ...base, meetingPoint: undefined }).meeting_point).toBeNull();
  });

  it('requires a user id', () => {
    expect(() => buildGroupRecord({ ...base, userId: '' })).toThrow('Missing required field: userId');
  });

  it('requires a name', () => {
    expect(() => buildGroupRecord({ ...base, name: '   ' })).toThrow('Missing required field: name');
  });

  it('rejects a name longer than 80 characters', () => {
    expect(() => buildGroupRecord({ ...base, name: 'x'.repeat(81) })).toThrow('name must be 80 characters or fewer');
  });

  it('rejects an invalid direction', () => {
    expect(() => buildGroupRecord({ ...base, direction: 'evening' })).toThrow('Invalid direction: evening');
  });

  it('rejects empty weekdays', () => {
    expect(() => buildGroupRecord({ ...base, weekdays: [] })).toThrow('weekdays must be a non-empty array');
  });

  it('rejects weekend days', () => {
    expect(() => buildGroupRecord({ ...base, weekdays: ['sun'] })).toThrow('weekdays must be within mon..fri');
  });
});

describe('seedOwnMembership', () => {
  it('inserts the caller own membership row', async () => {
    const q = chain({ error: null });
    supabase.from.mockReturnValue(q);
    await seedOwnMembership('g1', 'u1');
    expect(supabase.from).toHaveBeenCalledWith('memberships');
    expect(q.calls).toContainEqual(['insert', { group_id: 'g1', user_id: 'u1' }]);
  });

  it('refuses to run without both ids', async () => {
    await expect(seedOwnMembership('g1')).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('throws the database message', async () => {
    supabase.from.mockReturnValue(chain({ error: { message: 'duplicate key' } }));
    await expect(seedOwnMembership('g1', 'u1')).rejects.toThrow('duplicate key');
  });
});

describe('createGroup', () => {
  const record = {
    name: 'Rock Springs Run',
    direction: 'both',
    weekdays: ['mon', 'tue'],
    meeting_point: 'Library lot',
    created_by: 'u1',
  };

  it('inserts the group then seeds the creator membership', async () => {
    const groupsQ = chain({ data: { id: 'g1', ...record }, error: null });
    const membersQ = chain({ data: null, error: null });
    supabase.from.mockImplementation((t) => (t === 'groups' ? groupsQ : membersQ));

    const created = await createGroup(record);
    expect(created.id).toBe('g1');
    expect(supabase.from).toHaveBeenCalledWith('groups');
    expect(supabase.from).toHaveBeenCalledWith('memberships');
    expect(membersQ.calls).toContainEqual(['insert', { group_id: 'g1', user_id: 'u1' }]);
  });

  it('never sends area_lat/area_lng/area_label (the DB trigger owns them)', async () => {
    const groupsQ = chain({ data: { id: 'g1' }, error: null });
    supabase.from.mockImplementation((t) => (t === 'groups' ? groupsQ : chain({ error: null })));
    await createGroup({ ...record, area_lat: 1, area_lng: 2, area_label: 'spoofed' });
    const sent = groupsQ.calls.find((c) => c[0] === 'insert')[1];
    expect(sent).not.toHaveProperty('area_lat');
    expect(sent).not.toHaveProperty('area_lng');
    expect(sent).not.toHaveProperty('area_label');
  });

  it('rejects a record with no creator', async () => {
    await expect(createGroup({ ...record, created_by: '' })).rejects.toThrow();
  });

  it('throws when the group insert fails', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: { message: 'Add your family before creating a group' } }));
    await expect(createGroup(record)).rejects.toThrow('Add your family before creating a group');
  });

  it('drops unknown properties, so a ranked group object round-trips', async () => {
    const groupsQ = chain({ data: { id: 'g1' }, error: null });
    supabase.from.mockImplementation((t) => (t === 'groups' ? groupsQ : chain({ error: null })));
    await createGroup({ ...record, id: 'g9', created_at: '2026-01-01', distanceMiles: 3.2, status: 'full' });
    const sent = groupsQ.calls.find((c) => c[0] === 'insert')[1];
    expect(sent).toEqual({
      name: 'Rock Springs Run',
      direction: 'both',
      weekdays: ['mon', 'tue'],
      meeting_point: 'Library lot',
      created_by: 'u1',
    });
  });

  it('throws when the membership seed fails', async () => {
    const groupsQ = chain({ data: { id: 'g1' }, error: null });
    supabase.from.mockImplementation((t) => (t === 'groups' ? groupsQ : chain({ error: { message: 'seed failed' } })));
    await expect(createGroup(record)).rejects.toThrow('seed failed');
  });

  // The group survives a failed seed, so the recovery is seedOwnMembership on
  // that id, never a second createGroup. The error has to say so and has to
  // carry the id machine-readably.
  it('carries the orphaned group id and points at the retry, not a re-create', async () => {
    const groupsQ = chain({ data: { id: 'g1', name: 'Rock Springs Run' }, error: null });
    supabase.from.mockImplementation((t) => (t === 'groups' ? groupsQ : chain({ error: { message: 'seed failed' } })));
    const err = await createGroup(record).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.groupId).toBe('g1');
    expect(err.message).toMatch(/was created/i);
    expect(err.message).toMatch(/again/i);
  });

  it('never deletes the group after a failed seed', async () => {
    const groupsQ = chain({ data: { id: 'g1' }, error: null });
    supabase.from.mockImplementation((t) => (t === 'groups' ? groupsQ : chain({ error: { message: 'seed failed' } })));
    await createGroup(record).catch(() => {});
    expect(groupsQ.calls.map((c) => c[0])).not.toContain('delete');
  });
});

describe('fetchMyMemberships', () => {
  it('filters memberships to the caller', async () => {
    const q = chain({ data: [{ group_id: 'g1', user_id: 'u1' }], error: null });
    supabase.from.mockReturnValue(q);
    await expect(fetchMyMemberships('u1')).resolves.toHaveLength(1);
    expect(supabase.from).toHaveBeenCalledWith('memberships');
    expect(q.calls).toContainEqual(['eq', 'user_id', 'u1']);
  });

  it('returns an empty array without a user id', async () => {
    await expect(fetchMyMemberships()).resolves.toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe('fetchMyRequests', () => {
  it('filters join requests to the caller', async () => {
    const q = chain({ data: [{ id: 'r1', group_id: 'g1', status: 'pending' }], error: null });
    supabase.from.mockReturnValue(q);
    await expect(fetchMyRequests('u1')).resolves.toHaveLength(1);
    expect(supabase.from).toHaveBeenCalledWith('join_requests');
    expect(q.calls).toContainEqual(['eq', 'user_id', 'u1']);
  });

  it('returns an empty array without a user id', async () => {
    await expect(fetchMyRequests()).resolves.toEqual([]);
  });
});

describe('requestToJoin', () => {
  it('goes through the request_to_join RPC, never a direct insert', async () => {
    supabase.rpc.mockResolvedValue({ data: 'r1', error: null });
    await expect(requestToJoin('g1')).resolves.toBe('r1');
    expect(supabase.rpc).toHaveBeenCalledWith('request_to_join', { gid: 'g1' });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('surfaces the database message as an Error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'You are already in this group' } });
    await expect(requestToJoin('g1')).rejects.toThrow('You are already in this group');
  });
});

describe('fetchPendingRequesters', () => {
  it('calls the pending_requesters RPC', async () => {
    supabase.rpc.mockResolvedValue({ data: [{ request_id: 'r1', parent_name: 'Pat Parent' }], error: null });
    const rows = await fetchPendingRequesters('g1');
    expect(supabase.rpc).toHaveBeenCalledWith('pending_requesters', { gid: 'g1' });
    expect(rows[0].request_id).toBe('r1');
  });

  it('never claims contact columns the RPC does not return', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ request_id: 'r1', user_id: 'u2', parent_name: 'Pat Parent', child_names: 'Kid', area_label: '30349', direction: 'am', weekdays: ['mon'] }],
      error: null,
    });
    const [row] = await fetchPendingRequesters('g1');
    expect(row).not.toHaveProperty('contact_email');
    expect(row).not.toHaveProperty('contact_phone');
  });

  it('returns an empty array when data is null', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await expect(fetchPendingRequesters('g1')).resolves.toEqual([]);
  });
});

describe('decideRequest', () => {
  it('accepts through accept_join_request', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await decideRequest({ requestId: 'r1', accept: true });
    expect(supabase.rpc).toHaveBeenCalledWith('accept_join_request', { request_id: 'r1' });
  });

  it('declines through decline_join_request', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await decideRequest({ requestId: 'r1', accept: false });
    expect(supabase.rpc).toHaveBeenCalledWith('decline_join_request', { request_id: 'r1' });
  });

  it('never updates join_requests directly', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await decideRequest({ requestId: 'r1', accept: true });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('surfaces an already-decided request as an Error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'That request has already been decided' } });
    await expect(decideRequest({ requestId: 'r1', accept: true }))
      .rejects.toThrow('That request has already been decided');
  });

  it('surfaces an un-approved requester as an Error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'That family is no longer an approved member' } });
    await expect(decideRequest({ requestId: 'r1', accept: true }))
      .rejects.toThrow('That family is no longer an approved member');
  });

  it('rejects a missing request id without calling the database', async () => {
    await expect(decideRequest({ accept: true })).rejects.toThrow();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe('fetchRoster', () => {
  it('is the only path to contact details', async () => {
    supabase.rpc.mockResolvedValue({
      data: [{ user_id: 'u2', parent_name: 'Pat Parent', contact_email: 'pat@example.com', contact_phone: null }],
      error: null,
    });
    const roster = await fetchRoster('g1');
    expect(supabase.rpc).toHaveBeenCalledWith('group_roster', { gid: 'g1' });
    expect(roster[0].contact_email).toBe('pat@example.com');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns an empty array when data is null', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    await expect(fetchRoster('g1')).resolves.toEqual([]);
  });

  it('surfaces a denial as an Error', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    await expect(fetchRoster('g1')).rejects.toThrow('permission denied');
  });
});

describe('leaveGroup', () => {
  it('deletes only the caller own membership row', async () => {
    const q = chain({ error: null });
    supabase.from.mockReturnValue(q);
    await leaveGroup('g1', 'u1');
    expect(supabase.from).toHaveBeenCalledWith('memberships');
    expect(q.calls).toContainEqual(['delete']);
    expect(q.calls).toContainEqual(['eq', 'group_id', 'g1']);
    expect(q.calls).toContainEqual(['eq', 'user_id', 'u1']);
  });

  it('refuses to run without both ids', async () => {
    await expect(leaveGroup('g1')).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('throws the database message', async () => {
    supabase.from.mockReturnValue(chain({ error: { message: 'nope' } }));
    await expect(leaveGroup('g1', 'u1')).rejects.toThrow('nope');
  });
});

describe('withdrawRequest', () => {
  it('deletes the caller own join request row', async () => {
    const q = chain({ error: null });
    supabase.from.mockReturnValue(q);
    await withdrawRequest('r1', 'u1');
    expect(supabase.from).toHaveBeenCalledWith('join_requests');
    expect(q.calls).toContainEqual(['delete']);
    expect(q.calls).toContainEqual(['eq', 'id', 'r1']);
  });

  // The userId eq is the point of the two-argument signature. If somebody
  // "simplifies" this to a requestId-only delete, only the RLS policy is left
  // scoping the statement, and this test is what notices.
  it('scopes the delete to the caller', async () => {
    const q = chain({ error: null });
    supabase.from.mockReturnValue(q);
    await withdrawRequest('r1', 'u1');
    expect(q.calls).toContainEqual(['eq', 'user_id', 'u1']);
  });

  it('refuses to run without both ids', async () => {
    await expect(withdrawRequest('r1')).rejects.toThrow();
    await expect(withdrawRequest(undefined, 'u1')).rejects.toThrow();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  // Withdraw is a plain table delete, not an RPC: there is no
  // withdraw_join_request() function, and inventing one would mean a fourth
  // SECURITY DEFINER surface for something the policy already covers exactly.
  it('never goes through an RPC', async () => {
    supabase.from.mockReturnValue(chain({ error: null }));
    await withdrawRequest('r1', 'u1');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('throws the database message', async () => {
    supabase.from.mockReturnValue(chain({ error: { message: 'nope' } }));
    await expect(withdrawRequest('r1', 'u1')).rejects.toThrow('nope');
  });
});

describe('fetchCanOrganize', () => {
  function mockMember(row) {
    const q = chain({ data: row, error: null });
    supabase.from.mockReturnValue(q);
    return q;
  }

  it('reads the caller own members row', async () => {
    const q = mockMember({ role: 'parent', approval: 'approved', can_organize: true });
    await expect(fetchCanOrganize('u1')).resolves.toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('members');
    expect(q.calls).toContainEqual(['eq', 'user_id', 'u1']);
  });

  // Mirrors can_organize() in 0008: an admin may organize whatever the column
  // says, so the panel never has to set the flag on itself.
  it('says yes for an admin whose flag is off', async () => {
    mockMember({ role: 'admin', approval: 'approved', can_organize: false });
    await expect(fetchCanOrganize('u1')).resolves.toBe(true);
  });

  it('says no for an approved parent without the flag', async () => {
    mockMember({ role: 'parent', approval: 'approved', can_organize: false });
    await expect(fetchCanOrganize('u1')).resolves.toBe(false);
  });

  // The database branch requires approval = 'approved' as well as the flag.
  it('says no for a pending parent even with the flag set', async () => {
    mockMember({ role: 'parent', approval: 'pending', can_organize: true });
    await expect(fetchCanOrganize('u1')).resolves.toBe(false);
  });

  it('says no when there is no members row', async () => {
    mockMember(null);
    await expect(fetchCanOrganize('u1')).resolves.toBe(false);
  });

  it('says no without a user id, before any network call', async () => {
    await expect(fetchCanOrganize()).resolves.toBe(false);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  // The caller in Groups.jsx catches this and shows the form anyway, so the
  // throw has to be a real Error carrying the database message.
  it('throws the database message', async () => {
    supabase.from.mockReturnValue(chain({ data: null, error: { message: 'nope' } }));
    await expect(fetchCanOrganize('u1')).rejects.toThrow('nope');
  });
});
