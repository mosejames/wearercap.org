# Carpool Admin Panel — Design

Date: 2026-07-19
Status: Approved by Mose (chat), pending spec review

## Purpose

Give the committee admins (Mose plus two or three parent admins, on phones) one
place to run the carpool. The database already permits every admin action this
panel exposes; today only approvals have buttons. Decided in brainstorming:

- **Primary job: approving new families.** The queue dominates the page.
- **Approval is a gut check.** Name, children, email, area, schedule on the
  card. No roster cross-verification.
- **The norm for odd signups is reach out first.** Email is one tap; decline
  exists but is secondary and confirmed.
- **In scope now:** queue, master map + searchable roster, moderation tools.
- **Out of scope now:** counts/CSV export, admin management (promote/demote
  stays manual SQL), year rollover.
- **Admin privacy = parent privacy.** Map and roster show area centroids and
  the same safe columns `family_directory()` already returns. No addresses, no
  contact info anywhere except the queue's email link. A compromised admin
  account leaks nothing parents have not already shared with approved members.

## Layout

One view, `Admin.jsx`, replacing `AdminApprovals.jsx`, reached from the
existing admin link in `Ready.jsx` (relabel to "Admin"). Newsletter design
system throughout. Three stacked sections:

1. **Queue** — one card per pending member joined to their family row.
   Actions: **Approve** (primary gradient), **Email** (secondary, `mailto:`
   pre-addressed), **Decline** (danger, `window.confirm`, deletes signup).
   Pending members with no family row yet render with a "no family details
   yet" note and Approve/Email only (nothing to gut-check yet, nothing to
   delete but the member row — decline still allowed).
2. **Families** — master map (area-centroid pins, reuse `maps.js` loader and
   MapView's pin approach) over a searchable roster. Text search filters on
   parent name, child names, area label. Each row: family details plus the
   groups they belong to. Action: **Un-approve** (danger, confirmed), which
   also removes all their group memberships in the same operation.
3. **Groups** — every group with member count, expandable to members. Actions:
   **Remove from group** per member (danger, confirmed), **Delete group**
   (danger, confirmed).

All writes go through one `run()`-style helper (Groups.jsx pattern): busy
state per action, errors surfaced with the DB's own message, full refetch
after every action, no stranded buttons.

## Database — migration 0006

The schema deliberately has no DELETE on `members` or `families`, so decline
needs a guarded path. Two SECURITY DEFINER RPCs, same conventions as 0005
(pinned search_path, anon revoked, caller checks inside):

- `decline_signup(target uuid)` — caller must be admin; **refuses if target
  is an admin or is approved** (only pending signups are declinable); deletes
  the family row and member row. Deleting an approved member is deliberately
  impossible; un-approve first.
- `unapprove_member(target uuid)` — caller must be admin; **refuses if target
  is an admin**; sets `approval = 'pending'` and deletes the target's
  memberships atomically. (0005's `group_roster` already stops un-approved
  members' details flowing to rosters; this removes the stale membership rows
  too.)

Structural rule threaded through both: **an admin can never decline,
un-approve, or remove another admin.** Remove-from-group and delete-group use
existing policies (`memberships_delete_self_or_organizer` admin branch,
`groups_delete_organizer_or_admin`); the client must never gain a bulk delete.

Reads: `family_directory()` (exists), `groups`/`memberships` selects (admin
branches exist). The queue needs pending members joined to families — admin
SELECT on both tables exists; join client-side or add a small
`pending_signups()` RPC if the two-query join is awkward. No new columns.

## Client

- `src/carpool/admin.js` — data layer, TDD: `fetchPendingSignups()`,
  `fetchAllFamilies()` (wraps directory), `fetchAllGroups()`,
  `approveMember(userId)`, `declineSignup(userId)` (RPC),
  `unapproveMember(userId)` (RPC), `removeFromGroup(groupId, userId)`,
  `deleteGroup(groupId)`. Same error-wrapping conventions as `groups.js`.
- `src/carpool/views/Admin.jsx` — the view. `AdminApprovals.jsx` deleted.
- Notify pipeline unchanged: approve still fires the existing approved email;
  decline sends nothing (the reach-out norm means contact already happened).

## Also in this release: two live form fixes (shipped first, separately)

1. **Address privacy line moves above the field and gets Mose's framing**: the
   address is being added so the system can group nearby families; it is
   never shared; other families see only an approximate area. Today's note
   sits below the widget where it reads as fine print.
2. **Autocomplete dropdown takeover**: on a phone the Google suggestion list
   covers the entire screen. Constrain the widget's dropdown (custom
   properties / host styling, verified live on a dev server with the real
   key) so suggestions read as a list under the field, not a takeover.

## Testing

- `admin.js` unit tests (vitest), including negative tests that forbidden
  paths are never taken (no direct `members`/`families` deletes).
- Migration 0006 gets the 0005 treatment: opus security review before it
  touches the database, specifically the admin-on-admin guards and whether
  `decline_signup` can be aimed at anyone approved.
- Live acceptance with the existing test accounts (Dana Rivers declines and
  re-signs; Mose Testing gets un-approved and re-approved).

## Deploy order

0006 applied in the SQL editor (Claude drives Chrome, as with 0005) **before**
the client merges to main.
