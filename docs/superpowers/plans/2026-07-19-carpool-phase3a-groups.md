# Carpool Phase 3A: Groups, Join Requests & Contact Reveal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the map from a directory into actual carpools. An approved parent can **create a carpool group**, **see nearby groups** ranked by distance, **request to join** one, and the group's organizer can **accept or decline**. The moment two families share a group, and only then, their contact details unlock to each other.

**Architecture:** Three new tables (`groups`, `memberships`, `join_requests`) with RLS. Cross-family contact details stay unreachable by direct select; a single SECURITY DEFINER RPC `group_roster(group_id)` returns member contact info **only to members of that group**. Group browsing reuses the existing haversine ranking against the caller's own `area_lat/area_lng`. UI mounts inside the existing `Ready` view beneath the map.

**Tech Stack:** Existing Vite/React/Supabase stack. No new services. No new external accounts.

## Global Constraints

- **Contact reveal is the ONLY new data exposure, and it is membership-gated in the database.** `contact_email`/`contact_phone` may leave the row owner's control **only** via `group_roster(group_id)`, and only when `auth.uid()` is a member of that group. Never widen the `families` SELECT policy. Never return contacts from `family_directory()`.
- **Real address and coordinates stay private, always.** No group feature exposes `address`, `lat`, or `lng`. Groups carry their own coarse `area_*` (copied from the creator's area centroid), never a house.
- **Approved members only.** Creating a group, requesting to join, and viewing the roster all require `is_approved_member()`. Pending parents keep the count-teaser experience from Phase 2B.
- **Only the organizer decides.** Accepting/declining a join request, and adding a membership row, is restricted to the group's `created_by`. A requester can never insert their own membership.
- **RLS on every new table.** Anon gets nothing: `revoke execute ... from anon` on every new function (Supabase's default privileges grant anon EXECUTE even after `revoke from public`).
- **Do not disturb** the marketing homepage, onboarding/auth flow, the family form, the map, or admin approvals.
- Migrations are applied by a human in the Supabase SQL Editor BEFORE the client that depends on them merges (the Phase 2B deploy-order lesson).
- No em dashes in user-facing copy.

## Carry-over facts

- Migrations: `0001` members + `is_admin()`; `0002` families (column-split RLS) + `is_approved_member()`; `0003` member-writes + `family_directory()` + `area_family_count()` + `is_member()`; `0004` notify triggers + anon revokes (applied live, secret redacted in repo).
- `families` columns: `user_id, parent_name, child_names, address, lat, lng, area_lat, area_lng, area_label, direction, weekdays, contact_phone, contact_email, nearby_notified_at, created_at, updated_at`.
- `src/carpool/directory.js` exports `milesBetween(aLat,aLng,bLat,bLng)`, `rankNearby(me, families, {limit})`, `fetchDirectory()`, `fetchAreaCount()` — all tested.
- `Ready.jsx` renders: pendingBanner, adminBar, then either `FamilyForm` or (summary + `<MapView family isPending />`). `MapView` shows own pin + others' pins + ranked list.
- House style: plain, warm copy; no em dashes.

## External Setup (Mose, in the Supabase SQL Editor)

- **G1.** Apply `supabase/migrations/0005_groups.sql` (authored in Task 1) BEFORE the client merge.

---

## Task 1: Migration 0005 — groups, memberships, join_requests, roster RPC

**Files:**
- Create: `supabase/migrations/0005_groups.sql`

**Interfaces produced:**
- `public.groups(id uuid pk, name text, area_label text, area_lat double precision, area_lng double precision, direction text, weekdays text[], meeting_point text null, created_by uuid, status text, created_at timestamptz)`
- `public.memberships(group_id uuid, user_id uuid, joined_at timestamptz, pk(group_id,user_id))`
- `public.join_requests(id uuid pk, group_id uuid, user_id uuid, status text, created_at timestamptz, decided_at timestamptz null, unique(group_id,user_id))`
- `public.is_group_member(gid uuid) → boolean` (SECURITY DEFINER)
- `public.is_group_organizer(gid uuid) → boolean` (SECURITY DEFINER)
- `public.group_roster(gid uuid)` → table of `user_id, parent_name, child_names, area_label, direction, weekdays, contact_email, contact_phone` — **members of that group only**

> Author the file only. A human applies it. No DB access from the implementer.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0005_groups.sql`:

```sql
-- Phase 3A: carpool groups, join requests, and membership-gated contact reveal.
-- Privacy model: groups carry only a coarse area centroid (copied from the
-- creator's family area), never a house. Contact details leave a family's
-- control ONLY through group_roster(), and only for fellow group members.

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  area_label text not null,
  area_lat double precision not null,
  area_lng double precision not null,
  direction text not null check (direction in ('am', 'pm', 'both')),
  weekdays text[] not null check (weekdays <@ array['mon','tue','wed','thu','fri'] and cardinality(weekdays) > 0),
  meeting_point text,
  created_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'full')),
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (group_id, user_id)
);

alter table public.groups enable row level security;
alter table public.memberships enable row level security;
alter table public.join_requests enable row level security;

-- Helpers. SECURITY DEFINER so their internal reads bypass RLS and cannot
-- recurse through the policies that call them (same pattern as is_admin()).
create or replace function public.is_group_member(gid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.group_id = gid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_group_organizer(gid uuid)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.groups g
    where g.id = gid and g.created_by = auth.uid()
  );
$$;

revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.is_group_organizer(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_organizer(uuid) to authenticated;

-- GROUPS
-- Read: any approved member may browse groups (no PII here: a group is a
-- name, a coarse area, a schedule, and an optional public meeting spot).
drop policy if exists groups_select_approved on public.groups;
create policy groups_select_approved
  on public.groups for select
  using (public.is_approved_member());

drop policy if exists groups_insert_self_approved on public.groups;
create policy groups_insert_self_approved
  on public.groups for insert
  with check (created_by = auth.uid() and public.is_approved_member());

-- Only the organizer edits their group (name, schedule, meeting point, status).
drop policy if exists groups_update_organizer on public.groups;
create policy groups_update_organizer
  on public.groups for update
  using (created_by = auth.uid() and public.is_approved_member())
  with check (created_by = auth.uid() and public.is_approved_member());

-- MEMBERSHIPS
-- Read: your own rows, plus every row of a group you belong to (so you can
-- see who your group-mates are), plus admins.
drop policy if exists memberships_select_own_or_group on public.memberships;
create policy memberships_select_own_or_group
  on public.memberships for select
  using (user_id = auth.uid() or public.is_group_member(group_id) or public.is_admin());

-- Insert: the ORGANIZER adds members (this is how a join request is accepted),
-- or a creator seeds their own membership at creation time. A requester can
-- never insert themselves into someone else's group.
drop policy if exists memberships_insert_organizer_or_self_create on public.memberships;
create policy memberships_insert_organizer_or_self_create
  on public.memberships for insert
  with check (
    public.is_approved_member()
    and (
      public.is_group_organizer(group_id)
      or (user_id = auth.uid() and public.is_group_organizer(group_id))
    )
  );

-- Leave: you may remove yourself; the organizer may remove anyone.
drop policy if exists memberships_delete_self_or_organizer on public.memberships;
create policy memberships_delete_self_or_organizer
  on public.memberships for delete
  using (user_id = auth.uid() or public.is_group_organizer(group_id));

-- JOIN REQUESTS
-- Read: the requester sees their own; the organizer sees requests for theirs.
drop policy if exists join_requests_select_self_or_organizer on public.join_requests;
create policy join_requests_select_self_or_organizer
  on public.join_requests for select
  using (user_id = auth.uid() or public.is_group_organizer(group_id) or public.is_admin());

-- Insert: only for yourself, only as pending, only if approved, and not if
-- you are already in that group.
drop policy if exists join_requests_insert_self on public.join_requests;
create policy join_requests_insert_self
  on public.join_requests for insert
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and public.is_approved_member()
    and not public.is_group_member(group_id)
  );

-- Update: ONLY the organizer decides. (A requester withdrawing is a delete.)
drop policy if exists join_requests_update_organizer on public.join_requests;
create policy join_requests_update_organizer
  on public.join_requests for update
  using (public.is_group_organizer(group_id))
  with check (public.is_group_organizer(group_id));

drop policy if exists join_requests_delete_self on public.join_requests;
create policy join_requests_delete_self
  on public.join_requests for delete
  using (user_id = auth.uid());

-- CONTACT REVEAL. The ONE sanctioned path to another family's contact info.
-- SECURITY DEFINER bypasses the families RLS; is_group_member() is the gate.
create or replace function public.group_roster(gid uuid)
returns table (
  user_id uuid,
  parent_name text,
  child_names text,
  area_label text,
  direction text,
  weekdays text[],
  contact_email text,
  contact_phone text
)
language sql security definer set search_path = public as $$
  select f.user_id, f.parent_name, f.child_names, f.area_label,
         f.direction, f.weekdays, f.contact_email, f.contact_phone
  from public.memberships m
  join public.families f on f.user_id = m.user_id
  where m.group_id = gid
    and public.is_group_member(gid)
    and public.is_approved_member();
$$;

revoke all on function public.group_roster(uuid) from public;
grant execute on function public.group_roster(uuid) to authenticated;

-- Requester-facing view of a join request's people is NOT provided: an
-- organizer reviewing a request needs to know who is asking, so expose only
-- the safe columns for pending requesters of groups you organize.
create or replace function public.pending_requesters(gid uuid)
returns table (
  request_id uuid,
  user_id uuid,
  parent_name text,
  child_names text,
  area_label text,
  direction text,
  weekdays text[]
)
language sql security definer set search_path = public as $$
  select r.id, f.user_id, f.parent_name, f.child_names, f.area_label,
         f.direction, f.weekdays
  from public.join_requests r
  join public.families f on f.user_id = r.user_id
  where r.group_id = gid
    and r.status = 'pending'
    and public.is_group_organizer(gid);
$$;

revoke all on function public.pending_requesters(uuid) from public;
grant execute on function public.pending_requesters(uuid) to authenticated;
```

- [ ] **Step 2: Verify structure** — `cat` the file. Confirm: three tables with RLS enabled; both helpers SECURITY DEFINER with pinned `search_path`; every policy present with drop-if-exists guards; `group_roster` returns contacts ONLY with `is_group_member(gid)` in the WHERE; `pending_requesters` returns NO contact columns; revokes/grants on all four functions. Do NOT apply.
- [ ] **Step 3: Commit** — `git add supabase/migrations/0005_groups.sql && git commit -m "feat(carpool): groups, join requests, membership-gated contact reveal"`

---

## Task 2: Group data helpers + ranking (TDD)

**Files:**
- Create: `src/carpool/groups.js`
- Create: `src/carpool/groups.test.js`

**Interfaces:**
- PURE: `rankGroups(me, groups, { limit = 20 } = {})` → groups annotated `{ ...g, distanceMiles }`, sorted ascending, name tiebreak. `me = { area_lat, area_lng }`. Reuses `milesBetween` from `directory.js`.
- PURE: `scheduleOverlap(a, b)` → `{ directionMatches: boolean, sharedDays: string[] }` where direction matches if either is `'both'` or they are equal; `sharedDays` is the weekday intersection in mon..fri order.
- PURE: `summarizeSchedule({ direction, weekdays })` → e.g. `"Morning & afternoon · mon, tue"` (used by several views; keeps copy consistent).
- I/O: `fetchGroups()`, `createGroup(record)`, `fetchMyMemberships()`, `requestToJoin(groupId)`, `fetchMyRequests()`, `fetchPendingRequesters(groupId)`, `decideRequest({requestId, groupId, userId, accept})`, `fetchRoster(groupId)`, `leaveGroup(groupId)`.
  - `decideRequest` with `accept: true` must insert the membership FIRST, then mark the request accepted (so a failure leaves a still-pending request rather than a phantom acceptance). With `accept: false` it just marks declined.

- [ ] **Step 1: Failing tests** — `src/carpool/groups.test.js` covering: `rankGroups` (excludes nothing, sorts by distance, name tiebreak, respects limit, empty input); `scheduleOverlap` (both/am/pm matrix, day intersection order, no overlap); `summarizeSchedule` (all three directions, day joining). Use the College Park (33.6534,-84.4494) / East Point-ish fixtures already used in `directory.test.js` for consistency.
- [ ] **Step 2: RED** — `npm test src/carpool/groups.test.js` fails (module missing).
- [ ] **Step 3: Implement `groups.js`.** Import `milesBetween` from `./directory.js`; import `{ supabase }` (named) from `./supabaseClient.js`. RPC names must match 0005 EXACTLY: `group_roster`, `pending_requesters`.
- [ ] **Step 4: GREEN + full suite** — `npm test` (22 existing + new).
- [ ] **Step 5: Commit** — `git add src/carpool/groups.js src/carpool/groups.test.js && git commit -m "feat(carpool): group helpers and schedule matching (tested)"`

---

## Task 3: Groups UI inside `Ready`

**Files:**
- Create: `src/carpool/views/Groups.jsx`
- Modify: `src/carpool/views/Ready.jsx` (mount `<Groups family={family} />` below `MapView`, approved users only, i.e. `!isPending`)

**Behavior (bare-bones styling; design pass is deliberately deferred):**
1. **My groups.** For each group the user belongs to: name, area, schedule summary, meeting point if set, and a roster from `fetchRoster(groupId)` showing each member's name, child(ren), and **contact email/phone** (this is the reveal). A "Leave group" action.
2. **Requests to me** (organizer view). For each group the user organizes, list `fetchPendingRequesters(groupId)` with name, child(ren), area, schedule, and Accept / Decline buttons wired to `decideRequest`.
3. **Nearby groups.** `rankGroups(family, groups)` excluding groups the user is already in or has a pending request for. Show name, area, schedule, distance, and a "Request to join" button. After requesting, show "Request sent" instead.
4. **Create a group.** A small form: name, direction, weekdays, optional meeting point. Area fields are copied from the caller's own family (`area_label/area_lat/area_lng`) so a group never carries a house. On create, also insert the creator's own membership (allowed by the insert policy since they are the organizer).
5. Loading/error states in-view (`role="alert"`), unmount guards, no stuck disabled buttons (wrap every supabase call in try/catch: the client rethrows non-auth errors).

- [ ] **Step 1:** Write `Groups.jsx`.
- [ ] **Step 2:** Mount in `Ready.jsx` summary branch, after `<MapView .../>`, only when `!isPending`.
- [ ] **Step 3:** `npm test && npm run build` green.
- [ ] **Step 4: Commit** — `git commit -m "feat(carpool): groups UI with join requests and contact reveal"`

---

## Task 4: Deploy + live acceptance

- [ ] **Step 1:** Mose applies migration 0005 (G1) BEFORE the merge.
- [ ] **Step 2:** Merge to `main`, push; Vercel builds.
- [ ] **Step 3: Live acceptance:**
  - As an approved parent, create a group. It appears under "My groups" with you as the only member; your own contact shows.
  - As a second approved parent, see that group under "Nearby groups" with a distance; request to join; the button becomes "Request sent".
  - Back as the organizer, the request appears with the requester's name/child/area (and NO contact info yet). Accept it.
  - As the requester, the group moves to "My groups" and **now** both families' contact details are visible to each other.
  - Decline path: a declined request disappears from the organizer's list and does not grant contact access.
  - Privacy spot-check: a third approved parent who is in neither group sees the group in "Nearby groups" but **cannot** see any member contact info; an anonymous REST call to `group_roster` is denied.

## Self-Review

- **Spec coverage:** groups create/browse/join (Tasks 1-3) ✓; organizer accept/decline (1-3) ✓; contact reveal strictly on shared membership (Task 1 `group_roster` + Task 3 roster UI) ✓; meeting point field ✓ (optional, surfaced in UI). Proximity+schedule SUGGESTIONS and join-request EMAILS are deliberately Phase 3B, not here.
- **Placeholder scan:** Task 1 SQL is complete; Task 2's pure functions are fully specified with the test matrix named; Task 3 is a behavioral contract (UI, no exact code) consistent with how Phase 2B handled view work.
- **Name consistency:** `group_roster` / `pending_requesters` / `is_group_member` / `is_group_organizer` used identically in SQL and `groups.js`; `area_lat/area_lng/area_label` match `families`.

## Roadmap after 3A
- **Phase 3B:** "these 3 families match your schedule" suggestions; meeting-point coordinates on the map; join-request + accepted emails via the existing `notify` function (add `join_requests` INSERT/UPDATE triggers).
- **Phase 4:** availability toggle (looking/matched/inactive), annual year rollover, full admin panel (master map, remove, CSV export).
- **Design pass:** the whole carpool surface is deliberately unstyled; apply the house visual system (heavy condensed display, monospace metadata, color block) once behavior settles.
