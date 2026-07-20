import { supabase } from './supabaseClient.js';
import { milesBetween } from './directory.js';

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri'];

// The only columns a client may write on groups. Everything else on the table
// is owned elsewhere: id/created_at are database defaults, status is moved by
// the organizer's own flow, and area_lat/area_lng/area_label are overwritten by
// the groups_force_creator_area trigger from the creator's family on every
// insert and update. A whitelist rather than a blacklist, so a row that has
// picked up extra properties in the client (a ranked group carries
// distanceMiles, id and created_at) does not 400 the insert.
const WRITABLE_COLUMNS = ['name', 'direction', 'weekdays', 'meeting_point', 'created_by'];

const DIRECTION_LABELS = {
  am: 'Morning',
  pm: 'Afternoon',
  both: 'Morning & afternoon',
};

// Postgres raises plain-text exceptions from the RPCs in migration 0005
// ("That request has already been decided", "Only the group organizer can
// accept requests", ...). Supabase hands those back as a plain object, not an
// Error, so wrap them: the views render err.message and expect a real throw.
function raise(error, fallback) {
  const err = new Error(error?.message || fallback);
  if (error?.code) err.code = error.code;
  if (error?.details) err.details = error.details;
  return err;
}

// --- Pure helpers -------------------------------------------------------

// Groups are ranked against the caller's own coarse area centroid, the same
// way rankNearby() ranks families. Nothing is excluded: a group the caller
// already belongs to is filtered out by the view, which knows the memberships.
export function rankGroups(me, groups, { limit = 20 } = {}) {
  return groups
    .map((g) => ({ ...g, distanceMiles: milesBetween(me.area_lat, me.area_lng, g.area_lat, g.area_lng) }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles || a.name.localeCompare(b.name))
    .slice(0, limit);
}

// Do two schedules line up? 'both' covers am and pm, so it matches anything.
//
// NOT DEAD CODE, despite having no caller in Phase 3A. This is the scoring
// primitive Phase 3B's suggestion engine is built on ("groups near you that
// actually run on your days"), and it is fully tested. Kept deliberately.
// If Phase 3B is ever cut, delete this and its tests together.
export function scheduleOverlap(a, b) {
  const directionMatches =
    a.direction === 'both' || b.direction === 'both' || a.direction === b.direction;
  const bDays = new Set(b.weekdays ?? []);
  const aDays = new Set(a.weekdays ?? []);
  const sharedDays = DAY_ORDER.filter((d) => aDays.has(d) && bDays.has(d));
  return { directionMatches, sharedDays };
}

// One shared phrasing for a schedule, used by the group list, the roster, and
// the join-request cards so the copy never drifts between them.
export function summarizeSchedule({ direction, weekdays } = {}) {
  const label = DIRECTION_LABELS[direction] ?? 'Schedule not set';
  const days = DAY_ORDER.filter((d) => (weekdays ?? []).includes(d));
  return days.length ? `${label} · ${days.join(', ')}` : label;
}

// Validate before the round trip, the same way buildFamilyRecord does, so a
// parent reads "weekdays must be within mon..fri" instead of the raw
// 'violates check constraint "groups_weekdays_check"'. The rules here mirror
// the CHECK constraints on public.groups in migration 0005 exactly.
export function buildGroupRecord(input) {
  const { userId, name, direction, weekdays, meetingPoint } = input;

  const trimmedName = typeof name === 'string' ? name.trim() : name;
  const required = { userId, name: trimmedName };
  for (const [k, v] of Object.entries(required)) {
    if (v === undefined || v === null || v === '') throw new Error(`Missing required field: ${k}`);
  }
  if (trimmedName.length > 80) throw new Error('name must be 80 characters or fewer');
  if (!['am', 'pm', 'both'].includes(direction)) throw new Error(`Invalid direction: ${direction}`);
  if (!Array.isArray(weekdays) || weekdays.length === 0) throw new Error('weekdays must be a non-empty array');
  if (!weekdays.every((d) => DAY_ORDER.includes(d))) throw new Error('weekdays must be within mon..fri');

  return {
    name: trimmedName,
    direction,
    weekdays,
    meeting_point: meetingPoint ? meetingPoint : null,
    created_by: userId,
  };
}

// --- Reads --------------------------------------------------------------

// Every group an approved member may browse. No PII lives on this table.
export async function fetchGroups() {
  const { data, error } = await supabase
    .from('groups')
    .select('id, name, area_label, area_lat, area_lng, direction, weekdays, meeting_point, created_by, status, created_at');
  if (error) throw raise(error, 'Could not load groups.');
  return data ?? [];
}

// RLS also returns your group-mates' membership rows, so filter to the caller.
export async function fetchMyMemberships(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('memberships')
    .select('group_id, user_id, joined_at')
    .eq('user_id', userId);
  if (error) throw raise(error, 'Could not load your groups.');
  return data ?? [];
}

// Likewise: an organizer also sees requests filed against their own groups.
export async function fetchMyRequests(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('join_requests')
    .select('id, group_id, user_id, status, created_at, decided_at')
    .eq('user_id', userId);
  if (error) throw raise(error, 'Could not load your join requests.');
  return data ?? [];
}

// May the caller start a group? Mirrors 0008's public.can_organize() exactly:
// an admin always may, anyone else needs to be an approved member carrying the
// can_organize flag. Read from the caller's OWN members row, which 0001's
// members_select_self_or_admin has always allowed (user_id = auth.uid()).
//
// This is a UX read, not a guard. The groups INSERT policy is the only thing
// that actually decides, and it re-checks on every insert. It exists so a
// parent meets a sentence explaining the rule instead of a raw RLS violation
// after filling in the whole form. Callers treat a failure as "show the form"
// and let the database answer, so a missing column before 0008 is applied
// cannot lock out a parent who is perfectly entitled to organize.
export async function fetchCanOrganize(userId) {
  if (!userId) return false;
  const { data, error } = await supabase
    .from('members')
    .select('role, approval, can_organize')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw raise(error, 'Could not check whether you can start a group.');
  if (!data) return false;
  return data.role === 'admin' || (data.approval === 'approved' && data.can_organize === true);
}

// Organizer's view of who is asking. Deliberately carries NO contact columns:
// contact details unlock only once a family is actually in the group.
export async function fetchPendingRequesters(groupId) {
  const { data, error } = await supabase.rpc('pending_requesters', { gid: groupId });
  if (error) throw raise(error, 'Could not load join requests.');
  return data ?? [];
}

// The ONE sanctioned path to another family's contact details. The database
// gates it on shared membership; never reconstruct this from a table select.
export async function fetchRoster(groupId) {
  const { data, error } = await supabase.rpc('group_roster', { gid: groupId });
  if (error) throw raise(error, 'Could not load the group roster.');
  return data ?? [];
}

// --- Writes -------------------------------------------------------------

// The creator's own membership row is the one direct membership insert the
// policy allows (organizer self-seed); everyone else joins via
// accept_join_request(). Exported separately from createGroup because it is
// also the recovery path when createGroup's own seed fails: the group already
// exists at that point, so the fix is to retry this against the existing id.
export async function seedOwnMembership(groupId, userId) {
  if (!groupId || !userId) throw new Error('seedOwnMembership needs both a groupId and a userId');
  const { error } = await supabase
    .from('memberships')
    .insert({ group_id: groupId, user_id: userId });
  if (error) throw raise(error, 'Could not add you to the group.');
}

// Takes a record from buildGroupRecord. The insert is re-picked through
// WRITABLE_COLUMNS anyway, so a group-shaped object that has collected extra
// client-side properties cannot 400 the request.
//
// The two writes are NOT atomic. If the group lands and the self-seed does not,
// the group is real but memberless: browsable by every approved member, and
// invisible even to its creator, because group_roster gates on
// is_group_member. We deliberately do NOT delete it to clean up
// (groups_delete_organizer_or_admin would permit that, but a second failure
// would then destroy a group the parent believes they made). Instead we throw
// an error that names the retry and carries err.groupId, so the caller can
// re-run seedOwnMembership(err.groupId, userId) rather than create a second
// orphan.
export async function createGroup(record) {
  const row = Object.fromEntries(
    WRITABLE_COLUMNS.filter((k) => record[k] !== undefined).map((k) => [k, record[k]]),
  );
  if (!row.created_by) throw new Error('Missing required field: created_by');

  const { data, error } = await supabase
    .from('groups')
    .insert(row)
    .select()
    .single();
  if (error) throw raise(error, 'Could not create the group.');

  try {
    await seedOwnMembership(data.id, row.created_by);
  } catch (cause) {
    const label = data.name ? `"${data.name}"` : 'The group';
    const err = new Error(
      `${label} was created, but you were not added to it. Retry joining that group. Do not create it again. (${cause.message})`,
    );
    err.groupId = data.id;
    err.cause = cause;
    if (cause.code) err.code = cause.code;
    throw err;
  }

  return data;
}

// Always the RPC, never an insert into join_requests: the function also clears
// any earlier decided row, so a declined or departed family can ask again
// without tripping unique(group_id, user_id).
export async function requestToJoin(groupId) {
  if (!groupId) throw new Error('Missing required field: groupId');
  const { data, error } = await supabase.rpc('request_to_join', { gid: groupId });
  if (error) throw raise(error, 'Could not send your request.');
  return data;
}

// Accept and decline are single SECURITY DEFINER calls that do the membership
// insert and the status update atomically. Never PATCH join_requests.status.
export async function decideRequest({ requestId, accept }) {
  if (!requestId) throw new Error('Missing required field: requestId');
  const fn = accept ? 'accept_join_request' : 'decline_join_request';
  const { error } = await supabase.rpc(fn, { request_id: requestId });
  if (error) throw raise(error, accept ? 'Could not accept that request.' : 'Could not decline that request.');
}

// Removes ONE membership row. This is both "I am leaving" (userId = you) and
// the organizer's remove-a-member primitive (userId = the member being
// removed), because memberships_delete_self_or_organizer lets an organizer
// delete any row in their own group.
//
// That breadth is exactly why userId is a mandatory argument and not a
// convenience: for an organizer, a group_id-only delete is a legal statement
// that would silently empty the entire group. Do not "simplify" this signature
// down to a groupId.
export async function leaveGroup(groupId, userId) {
  if (!groupId || !userId) throw new Error('leaveGroup needs both a groupId and a userId');
  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw raise(error, 'Could not leave the group.');
}

// Take back a request the organizer has not answered yet, via the
// join_requests_delete_self policy. This is the only way to revoke one: until
// it is decided, a pending request is a live consent token that the organizer
// may accept at any moment, months later, pulling this family's contact
// details into the group. Without a withdraw the family cannot say "never
// mind" once they have asked.
//
// userId is mandatory for the same reason it is on leaveGroup, though the
// blast radius differs. join_requests_delete_self already scopes DELETE to
// user_id = auth.uid(), so the database will not let this touch another
// family's request no matter what is passed. The eq is here so the statement
// is narrow on its face rather than relying on the policy to be the only
// thing standing between a stray call and a wider delete, and so the two
// delete helpers in this file read the same way. Do not drop it to a
// requestId-only signature.
export async function withdrawRequest(requestId, userId) {
  if (!requestId || !userId) throw new Error('withdrawRequest needs both a requestId and a userId');
  const { error } = await supabase
    .from('join_requests')
    .delete()
    .eq('id', requestId)
    .eq('user_id', userId);
  if (error) throw raise(error, 'Could not withdraw your request.');
}
