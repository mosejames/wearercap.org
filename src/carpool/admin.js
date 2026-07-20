// Admin panel data layer. Every function here presumes the caller is an
// admin; the database re-checks on every statement (RLS admin branches for
// the reads and direct deletes, is_admin() inside the 0006 RPCs for the
// moderation writes), so a non-admin caller gets a denial, not data.
import { supabase } from './supabaseClient.js';

// The queue's gut check runs on the same coarse fields parents already share
// through family_directory(), plus contact details for the reach-out mailto.
// Admin SELECT on families CAN see the protected columns (address, lat, lng);
// this whitelist is why the panel never receives them. Both the select string
// and the returned object are built from it, so the two cannot drift apart.
const QUEUE_FAMILY_COLUMNS = [
  'parent_name',
  'child_names',
  'area_label',
  'direction',
  'weekdays',
  'contact_email',
  'contact_phone',
];

// Postgres raises plain-text exceptions from the 0006 RPCs ("That family is
// approved; un-approve them first", "An admin account cannot be declined",
// ...). Those messages are parent-readable on purpose; Supabase hands them
// back as a plain object, not an Error, so wrap them the same way groups.js
// does: the views render err.message and expect a real throw.
function raise(error, fallback) {
  const err = new Error(error?.message || fallback);
  if (error?.code) err.code = error.code;
  if (error?.details) err.details = error.details;
  return err;
}

// --- Reads --------------------------------------------------------------

// Pending members joined client-side to their family rows (both queries ride
// the admin SELECT branches; there is no pending_signups RPC by design, per
// the spec). A pending member with no family row yet is still a real signup
// — they get family: null, never dropped, so the queue can show them with a
// "no family details yet" note.
export async function fetchPendingSignups() {
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('user_id, email, created_at')
    .eq('approval', 'pending')
    .order('created_at', { ascending: true });
  if (membersError) throw raise(membersError, 'Could not load the signup queue.');

  const pending = members ?? [];
  if (pending.length === 0) return [];

  const { data: families, error: familiesError } = await supabase
    .from('families')
    .select(['user_id', ...QUEUE_FAMILY_COLUMNS].join(', '))
    .in('user_id', pending.map((m) => m.user_id));
  if (familiesError) throw raise(familiesError, 'Could not load family details for the queue.');

  const familyByUser = new Map((families ?? []).map((f) => [f.user_id, f]));
  return pending.map((m) => {
    const f = familyByUser.get(m.user_id);
    return {
      userId: m.user_id,
      email: m.email,
      createdAt: m.created_at,
      // Re-pick through the whitelist: even if the row carries extra columns,
      // only the queue's fields leave this module.
      family: f ? Object.fromEntries(QUEUE_FAMILY_COLUMNS.map((k) => [k, f[k]])) : null,
    };
  });
}

// The auto-approve switch (0008). One row, id = true; the check constraint on
// that column makes a second row impossible. Any signed-in user may READ it,
// so this is a plain select rather than an RPC.
//
// The `?? true` is not a guess: auto_approve_enabled() in the database
// coalesces a missing row to true and the column default matches, so an
// unreadable or absent row really does behave as "on". Reporting anything else
// here would put a lie on the admin's screen.
export async function fetchAutoApprove() {
  const { data, error } = await supabase
    .from('settings')
    .select('auto_approve_signups')
    .eq('id', true)
    .maybeSingle();
  if (error) throw raise(error, 'Could not load the signup setting.');
  return data?.auto_approve_signups ?? true;
}

// UPDATE only, never an insert or an upsert. 0008 deliberately defines no
// INSERT and no DELETE policy on settings, so with RLS on, both are denied for
// everyone; an upsert here would fail the moment the row was somehow absent,
// which is exactly when an admin would be trying to fix things.
//
// The boolean guard is not ceremony either. A stray string would be sent
// through as-is and Postgres would coerce 'false' or reject it, so pin the
// type on this side where the message is readable.
export async function setAutoApprove(enabled) {
  if (typeof enabled !== 'boolean') throw new Error('setAutoApprove needs a boolean');
  const { error } = await supabase
    .from('settings')
    // updated_at is stamped here rather than by a trigger. Without it the
    // column would permanently read as the migration timestamp and mislead
    // whoever looks at the table trying to work out when the switch last moved.
    .update({ auto_approve_signups: enabled, updated_at: new Date().toISOString() })
    .eq('id', true);
  if (error) throw raise(error, 'Could not change the signup setting.');
}

// Every account, which is a different thing from every family. Two jobs that
// used to be one:
//
//   1. Who is allowed to START a group (0008). family_directory() does NOT
//      carry can_organize and must not be widened to carry it: every parent
//      calls that same function, and an admin-only flag has no business
//      travelling to every parent's map. So the flags are fetched separately
//      from members and the view joins the two by user_id, the same way it
//      already joins group names. role rides along because the roster has to
//      tell an admin apart from a parent: can_organize() is true for admins
//      whatever the column says, so rendering them a toggle would show a
//      switch that changes nothing.
//
//   2. Who EXISTS. Since 0008's reciprocal-disclosure rule, family_directory()
//      only returns rows that have a families row, so an account that signed
//      in and never filled in the family form appears in no roster at all, and
//      once auto-approve puts it straight to 'approved' it is in no queue
//      either. That is an account nobody can see and nobody can remove. The
//      roster unions these rows in so the panel shows every account, not every
//      family.
//
// The whole column list is legitimately readable here: 0001's
// members_select_self_or_admin is `using (user_id = auth.uid() or
// public.is_admin())`, a ROW predicate with no column restriction, so an admin
// selects any column of any members row. (The narrow grants in 0006 and 0008
// are UPDATE grants; they do not touch SELECT.)
export async function fetchAllMembers() {
  const { data, error } = await supabase
    .from('members')
    .select('user_id, email, role, approval, can_organize, created_at');
  if (error) throw raise(error, 'Could not load the member list.');
  return data ?? [];
}

// The roster and master map show exactly what approved parents already see:
// family_directory()'s safe columns (centroid, no address, no contact info).
// Admin privacy = parent privacy; do not replace this with a families select.
export async function fetchAllFamilies() {
  const { data, error } = await supabase.rpc('family_directory');
  if (error) throw raise(error, 'Could not load the family directory.');
  return data ?? [];
}

// Every group plus its membership rows (the admin branches of
// groups_select and memberships_select return all rows), joined client-side
// into [{ ...group, members: [{ user_id, joined_at }] }].
export async function fetchAllGroups() {
  const { data: groups, error: groupsError } = await supabase
    .from('groups')
    .select('id, name, area_label, area_lat, area_lng, direction, weekdays, meeting_point, created_by, status, created_at');
  if (groupsError) throw raise(groupsError, 'Could not load groups.');

  const { data: memberships, error: membershipsError } = await supabase
    .from('memberships')
    .select('group_id, user_id, joined_at');
  if (membershipsError) throw raise(membershipsError, 'Could not load group members.');

  const membersByGroup = new Map();
  for (const m of memberships ?? []) {
    if (!membersByGroup.has(m.group_id)) membersByGroup.set(m.group_id, []);
    membersByGroup.get(m.group_id).push({ user_id: m.user_id, joined_at: m.joined_at });
  }
  return (groups ?? []).map((g) => ({ ...g, members: membersByGroup.get(g.id) ?? [] }));
}

// --- Writes -------------------------------------------------------------

// The one direct members write the panel makes, and the one column 0006's
// grant allows authenticated to update: approval. Keep the payload to that
// single key — adding role or email would 42501 against the column grant,
// and role changes are manual SQL only (members_role_immutable trigger).
export async function approveMember(userId) {
  if (!userId) throw new Error('approveMember needs a userId');
  const { error } = await supabase
    .from('members')
    .update({ approval: 'approved' })
    .eq('user_id', userId);
  if (error) throw raise(error, 'Could not approve that member.');
}

// The second column 0008's grant opens to authenticated: can_organize. Keep
// the payload to that single key. approval belongs to approveMember and
// unapprove_member(), and putting it in here would let one click that was only
// meant to hand out group creating quietly re-approve a family an admin had
// just removed. role is unwritable through the API at all.
//
// enabled is required and must be a real boolean: an undefined would become a
// null and violate the column's NOT NULL, and a missing argument must never be
// read as "turn it off".
export async function setCanOrganize(userId, enabled) {
  if (!userId) throw new Error('setCanOrganize needs a userId');
  if (typeof enabled !== 'boolean') throw new Error('setCanOrganize needs a boolean');
  const { error } = await supabase
    .from('members')
    .update({ can_organize: enabled })
    .eq('user_id', userId);
  if (error) throw raise(error, 'Could not change who can start groups.');
}

// Always the RPC, NEVER a direct members/families delete. The schema defines
// no DELETE policy on either table; decline_signup() is the only delete path
// and every guard (admin caller, non-admin target, pending-only) lives inside
// its body, along with the five-table sweep that stops a re-signup from
// resurrecting old memberships and groups.
export async function declineSignup(userId) {
  if (!userId) throw new Error('declineSignup needs a userId');
  const { error } = await supabase.rpc('decline_signup', { target: userId });
  if (error) throw raise(error, 'Could not decline that signup.');
}

// Always the RPC, NEVER a direct approval update or memberships sweep. The
// function flips approval to pending AND clears the target's memberships in
// one atomic call; doing either half from the client would strand the other
// (un-approved but still seated in groups, or the reverse).
export async function unapproveMember(userId) {
  if (!userId) throw new Error('unapproveMember needs a userId');
  const { error } = await supabase.rpc('unapprove_member', { target: userId });
  if (error) throw raise(error, 'Could not un-approve that member.');
}

// Removes ONE membership row. userId is mandatory and not a convenience: the
// admin branch of memberships_delete_self_or_organizer has no row scoping, so
// a group_id-only delete is a legal statement that would silently empty the
// entire group — same reasoning as leaveGroup in groups.js. Do not "simplify"
// this signature down to a groupId.
export async function removeFromGroup(groupId, userId) {
  if (!groupId || !userId) throw new Error('removeFromGroup needs both a groupId and a userId');
  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw raise(error, 'Could not remove that member from the group.');
}

// Direct delete via groups_delete_organizer_or_admin's admin branch. The
// memberships rows go with it (FK cascade); join_requests against the group
// likewise.
export async function deleteGroup(groupId) {
  if (!groupId) throw new Error('deleteGroup needs a groupId');
  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId);
  if (error) throw raise(error, 'Could not delete that group.');
}
