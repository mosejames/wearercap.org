# Carpool Admin Panel — Implementation Plan

Spec: `docs/superpowers/specs/2026-07-19-carpool-admin-panel-design.md` (approved).
Loop: implementer subagent → opus security review → fix → re-review, per task.
Branch: `carpool-admin`.

## Task 1 — Migration `supabase/migrations/0006_admin.sql`

Two SECURITY DEFINER RPCs, 0005 conventions (pinned `search_path = public,
pg_temp`, `revoke all ... from public`, `revoke execute ... from anon`,
`grant execute ... to authenticated`, caller checks INSIDE the function):

- `decline_signup(target uuid)` — caller `is_admin()`; refuse (raise) if the
  target is an admin OR has `approval = 'approved'`; delete `families` row
  (if any) then `members` row. Row lock on the member row (`for update`) so
  a concurrent approve/decline resolves cleanly.
- `unapprove_member(target uuid)` — caller `is_admin()`; refuse if target is
  an admin; set `approval = 'pending'`, delete target's `memberships` rows,
  atomically. Row lock likewise.

Guards are the review focus: admin-on-admin must be structurally impossible;
`decline_signup` must never delete an approved family.

## Task 2 — `src/carpool/admin.js` (TDD, house style of `groups.js`)

`fetchPendingSignups()` (members pending + their families rows, admin SELECT,
client-side join keyed by user_id), `fetchAllFamilies()` (family_directory),
`fetchAllGroups()` (groups + memberships, admin sees all),
`approveMember(userId)` (existing UPDATE path, as AdminApprovals does today),
`declineSignup(userId)` / `unapproveMember(userId)` (RPCs),
`removeFromGroup(groupId, userId)`, `deleteGroup(groupId)` (direct deletes,
policies exist). Error-wrapping via the same `raise()` pattern. Negative
tests: no direct `members`/`families` deletes anywhere.

## Task 3 — `src/carpool/views/Admin.jsx`

Replaces `AdminApprovals.jsx` (delete it; update `Ready.jsx` link text to
"Admin"). Sections per spec: Queue (approve primary / email secondary /
decline danger+confirm), Families (centroid map + searchable roster,
un-approve danger+confirm), Groups (member counts, remove member, delete
group, both danger+confirm). `run()` helper pattern from `Groups.jsx`
(busyRef, loadSeq, refetch in finally, mapped errors). Newsletter design
system; no addresses or contact info rendered anywhere except the queue's
mailto link.

## Task 4 — Deploy

0006 in SQL editor via Chrome BEFORE merge (deploy-order rule). Merge
`carpool-admin` → main, push, verify bundle hash. Live acceptance: Dana
Rivers declined + re-signed; Mose Testing un-approved (groups drop) +
re-approved.
