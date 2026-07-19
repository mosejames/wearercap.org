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
returns boolean language sql security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.memberships m
    where m.group_id = gid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_group_organizer(gid uuid)
returns boolean language sql security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.groups g
    where g.id = gid and g.created_by = auth.uid()
  );
$$;

-- There is deliberately NO consent-gate function here, and the memberships
-- INSERT policy deliberately has NO "the target asked to join" branch.
--
-- An earlier revision had has_open_request(gid, uid), letting an organizer
-- insert a membership row directly whenever the target had a pending
-- request. Once acceptance moved into accept_join_request() (SECURITY
-- DEFINER, which bypasses RLS anyway), that branch stopped being the path
-- anyone actually used and became a live hole: an organizer could insert the
-- membership directly and simply never decide the request, leaving it
-- 'pending' forever. The family leaves; the request is still pending; the
-- organizer re-adds them, repeatedly, with no fresh ask. That is exactly the
-- harm the gate existed to prevent.
--
-- The fix is to make the RPC the ONLY way a family is added to a group.
-- Direct INSERT is now organizer-self-seed only (see the policy below), so
-- pending -> accepted is unskippable and every membership traces to a
-- decision the organizer actually made on a request the family actually
-- filed. Decisions are terminal (join_requests_update_organizer's WITH CHECK
-- plus the join_requests_pin_identity trigger), so a family who was declined,
-- or who joined and later left, must file a fresh request via
-- request_to_join() to be considered again.
--
-- The function is dropped explicitly (down at the memberships policy, which
-- has to be dropped first or the dependency blocks it) rather than merely
-- deleted from this file: an earlier draft may have created it, and leaving
-- it behind would leave a SECURITY DEFINER oracle granted to every
-- authenticated user, letting anyone probe "did family X ask to join group Y".

revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.is_group_organizer(uuid) from public;
revoke execute on function public.is_group_member(uuid) from anon;
revoke execute on function public.is_group_organizer(uuid) from anon;
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

-- Delete: the organizer can take down their own group, or an admin can
-- take down any group. A children's-safety product needs a moderation path.
drop policy if exists groups_delete_organizer_or_admin on public.groups;
create policy groups_delete_organizer_or_admin
  on public.groups for delete
  using ((created_by = auth.uid() and public.is_approved_member()) or public.is_admin());

-- MEMBERSHIPS
-- Read: your own rows, plus every row of a group you belong to (so you can
-- see who your group-mates are), plus admins.
drop policy if exists memberships_select_own_or_group on public.memberships;
create policy memberships_select_own_or_group
  on public.memberships for select
  using (user_id = auth.uid() or public.is_group_member(group_id) or public.is_admin());

-- Insert: SELF-SEED ONLY. The only membership row anyone may create by a
-- direct table write is their own, in a group they organize (i.e. a creator
-- seeding themselves at creation time). Adding ANOTHER family goes through
-- accept_join_request(), never through here.
--
-- `user_id = auth.uid()` is the CONSENT gate. Without it, any approved member
-- could create a group, bulk-add arbitrary users pulled from
-- family_directory(), and harvest their contact info and children's names via
-- group_roster(). Do not widen this clause. In particular, do not re-add a
-- "the target has a pending request" branch: a pending request is not a
-- decision, so that branch let an organizer insert the membership and never
-- decide the request, keeping the consent token live forever and allowing
-- silent re-adds after the family left.
drop policy if exists memberships_insert_organizer_or_self_create on public.memberships;
-- Must follow the drop above: the policy referenced this function, and that
-- dependency would block the drop. See the note at the top of this file.
drop function if exists public.has_open_request(uuid, uuid);
create policy memberships_insert_organizer_or_self_create
  on public.memberships for insert
  with check (
    public.is_approved_member()
    and public.is_group_organizer(group_id)
    and user_id = auth.uid()                                -- organizer seeds their own row
  );

-- Leave: you may remove yourself; the organizer may remove anyone; a
-- committee admin may remove anyone. The admin branch matters because this
-- is a product about children: an admin who can delete an entire group but
-- cannot remove one family from it has the wrong tool for a safety report.
drop policy if exists memberships_delete_self_or_organizer on public.memberships;
create policy memberships_delete_self_or_organizer
  on public.memberships for delete
  using (
    user_id = auth.uid()
    or (public.is_group_organizer(group_id) and public.is_approved_member())
    or public.is_admin()
  );

-- JOIN REQUESTS
-- Read: the requester sees their own; the organizer sees requests for theirs.
drop policy if exists join_requests_select_self_or_organizer on public.join_requests;
create policy join_requests_select_self_or_organizer
  on public.join_requests for select
  using (user_id = auth.uid() or (public.is_group_organizer(group_id) and public.is_approved_member()) or public.is_admin());

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

-- Update: ONLY the organizer decides, and only ever INTO a decided state.
-- 'pending' can never be written by this policy (it can only ever come from
-- the requester's own INSERT via join_requests_insert_self), so a decision
-- is terminal: an organizer cannot PATCH an already-decided request back to
-- 'pending' to silently re-add a family who left. See the
-- join_requests_pin_identity trigger below for a second, independent layer
-- of the same rule.
drop policy if exists join_requests_update_organizer on public.join_requests;
create policy join_requests_update_organizer
  on public.join_requests for update
  using (public.is_group_organizer(group_id) and public.is_approved_member())
  -- is_approved_member() is repeated here rather than left to USING alone.
  -- USING already gates every UPDATE, so this is redundant today; it is here
  -- so the two halves can't drift into disagreeing about who may write.
  with check (
    public.is_group_organizer(group_id)
    and public.is_approved_member()
    and status in ('accepted', 'declined')
  );

drop policy if exists join_requests_delete_self on public.join_requests;
create policy join_requests_delete_self
  on public.join_requests for delete
  using (user_id = auth.uid());

-- CONSENT LIFECYCLE RPCs. These three SECURITY DEFINER functions are the
-- intended route for every join-request state change; the direct-table
-- policies above remain as defense in depth, not the primary path.
--
-- request_to_join(): lets an approved member file (or re-file) a request.
-- Deleting any existing row for (gid, auth.uid()) before inserting a fresh
-- 'pending' row means a family whose earlier request was accepted or
-- declined (or who joined and later left) is never stuck behind the
-- unique(group_id, user_id) constraint with no way back in.
create or replace function public.request_to_join(gid uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  new_id uuid;
begin
  if not public.is_approved_member() then
    raise exception 'Only approved members can request to join';
  end if;

  if not exists (select 1 from public.groups g where g.id = gid) then
    raise exception 'That group does not exist';
  end if;

  if public.is_group_member(gid) then
    raise exception 'You are already in this group';
  end if;

  delete from public.join_requests where group_id = gid and user_id = auth.uid();

  insert into public.join_requests (group_id, user_id, status)
  values (gid, auth.uid(), 'pending')
  returning id into new_id;

  return new_id;
end
$$;

revoke all on function public.request_to_join(uuid) from public;
revoke execute on function public.request_to_join(uuid) from anon;
grant execute on function public.request_to_join(uuid) to authenticated;

-- accept_join_request(): inserts the membership row and marks the request
-- 'accepted' in ONE call, so there is no window where a half-completed
-- accept leaves a member whose request is still 'pending'.
create or replace function public.accept_join_request(request_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.join_requests%rowtype;
begin
  -- FOR UPDATE, not a bare select: two organizers double-clicking Accept
  -- would otherwise both read 'pending', and the loser's UPDATE would trip
  -- the terminal-decision trigger with "A decided join request cannot be
  -- reopened" — technically safe, but nonsense to the person reading it.
  -- Locking makes the loser re-read the committed row (READ COMMITTED) and
  -- fall into the clean "already been decided" branch below.
  select * into r from public.join_requests where id = request_id for update;
  if not found then
    raise exception 'Join request not found';
  end if;

  if not (public.is_group_organizer(r.group_id) and public.is_approved_member()) then
    raise exception 'Only the group organizer can accept requests';
  end if;

  if r.status <> 'pending' then
    raise exception 'That request has already been decided';
  end if;

  -- The requester was approved when they filed, but an admin may have
  -- removed or un-approved them since. Accepting anyway would reveal their
  -- contacts and children's names via group_roster() to a group they can no
  -- longer be vouched for in. Checked here rather than via
  -- is_approved_member(), which only ever tests the CALLER.
  if not exists (
    select 1 from public.members m
    where m.user_id = r.user_id and m.approval = 'approved'
  ) then
    raise exception 'That family is no longer an approved member';
  end if;

  insert into public.memberships (group_id, user_id)
  values (r.group_id, r.user_id)
  on conflict do nothing;

  update public.join_requests
  set status = 'accepted', decided_at = now()
  where id = r.id;
end
$$;

revoke all on function public.accept_join_request(uuid) from public;
revoke execute on function public.accept_join_request(uuid) from anon;
grant execute on function public.accept_join_request(uuid) to authenticated;

-- decline_join_request(): same guards as accept, no membership side effect.
create or replace function public.decline_join_request(request_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r public.join_requests%rowtype;
begin
  -- FOR UPDATE for the same reason as accept_join_request: without it, an
  -- accept and a decline racing each other leave the loser tripping the
  -- terminal-decision trigger and reading "cannot be reopened" instead of
  -- "already decided". Keep the two functions symmetric.
  select * into r from public.join_requests where id = request_id for update;
  if not found then
    raise exception 'Join request not found';
  end if;

  if not (public.is_group_organizer(r.group_id) and public.is_approved_member()) then
    raise exception 'Only the group organizer can decline requests';
  end if;

  if r.status <> 'pending' then
    raise exception 'That request has already been decided';
  end if;

  update public.join_requests
  set status = 'declined', decided_at = now()
  where id = r.id;
end
$$;

revoke all on function public.decline_join_request(uuid) from public;
revoke execute on function public.decline_join_request(uuid) from anon;
grant execute on function public.decline_join_request(uuid) to authenticated;

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
language sql security definer set search_path = public, pg_temp as $$
  select f.user_id, f.parent_name, f.child_names, f.area_label,
         f.direction, f.weekdays, f.contact_email, f.contact_phone
  from public.memberships m
  join public.families f on f.user_id = m.user_id
  where m.group_id = gid
    and public.is_group_member(gid)
    and public.is_approved_member();
$$;

revoke all on function public.group_roster(uuid) from public;
revoke execute on function public.group_roster(uuid) from anon;
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
language sql security definer set search_path = public, pg_temp as $$
  select r.id, f.user_id, f.parent_name, f.child_names, f.area_label,
         f.direction, f.weekdays
  from public.join_requests r
  join public.families f on f.user_id = r.user_id
  where r.group_id = gid
    and r.status = 'pending'
    and public.is_group_organizer(gid)
    and public.is_approved_member();
$$;

revoke all on function public.pending_requesters(uuid) from public;
revoke execute on function public.pending_requesters(uuid) from anon;
grant execute on function public.pending_requesters(uuid) to authenticated;

-- AREA ENFORCEMENT. groups.area_lat/area_lng/area_label must never be
-- client-supplied: groups is readable by every approved member, so a buggy
-- or hostile client writing an exact coordinate here would defeat the point
-- of families.lat/lng being private. This trigger always overwrites the
-- incoming area_* values with the creator's own family area, ignoring
-- whatever the client sent.
create or replace function public.groups_force_creator_area()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare fam public.families%rowtype;
begin
  select * into fam from public.families where user_id = new.created_by;
  if not found then
    raise exception 'Add your family before creating a group';
  end if;
  new.area_lat := fam.area_lat;
  new.area_lng := fam.area_lng;
  new.area_label := fam.area_label;
  return new;
end
$$;
revoke all on function public.groups_force_creator_area() from public;
revoke execute on function public.groups_force_creator_area() from anon;

-- Fires on BEFORE INSERT OR UPDATE, i.e. on every update to a group, not
-- just creation. That is intentional: any edit to a group (rename, schedule
-- change, status flip, etc.) re-syncs area_lat/area_lng/area_label to the
-- creator's CURRENT family area, so a group's displayed area never drifts
-- out of sync if the creator later moves.
drop trigger if exists groups_area_from_creator on public.groups;
create trigger groups_area_from_creator
  before insert or update on public.groups
  for each row execute function public.groups_force_creator_area();

-- HYGIENE: is_approved_member() and is_admin() are defined and granted to
-- `authenticated` in earlier migrations, but were never explicitly revoked
-- from anon there. Close that gap here (idempotent; harmless if already revoked).
revoke execute on function public.is_approved_member() from anon;
revoke execute on function public.is_admin() from anon;

-- IDENTITY LOCKDOWN for join_requests. A join request is a CONSENT RECORD:
-- accept_join_request() reads user_id off the row and inserts exactly that
-- family into the group, as SECURITY DEFINER. If its identity (who asked, for
-- which group) could be changed after the fact, an organizer could repoint
-- one legitimate request at any victim in turn via
-- join_requests_update_organizer (which lets an organizer UPDATE any request
-- in their own group with no column restriction) and then accept it, adding a
-- family that never asked and exposing their contacts and children's names
-- through group_roster(). Two independent layers close this, because either
-- one alone is fragile to a future change:
--
-- 1. Column-level grants: app JWTs (the `authenticated` role) can write only
--    status/decided_at, never user_id/group_id, at the grant level.
revoke update on public.join_requests from authenticated;
grant update (status, decided_at) on public.join_requests to authenticated;

-- 2. A defensive trigger as a second, independent layer: if a future
--    migration ever runs a broad `grant all` (or `grant update` without a
--    column list) on join_requests and silently undoes step 1 above, this
--    trigger still blocks any attempt to move a request to a different
--    user_id or group_id after creation.
-- Also enforces that a decision is terminal: once old.status is 'accepted'
-- or 'declined', no further update to that row is permitted, regardless of
-- which columns it touches. This is the second, independent layer for the
-- same invariant join_requests_update_organizer's WITH CHECK enforces above
-- (I1): even a future broad `grant update` that reopens the column-level
-- grants, or a bug in that policy, still cannot resurrect a decided request
-- into 'pending' through this trigger. accept_join_request() and
-- decline_join_request() only ever move a row OUT of 'pending' once, so
-- they always pass (old.status = 'pending' at the moment they run).
create or replace function public.join_requests_pin_identity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.user_id is distinct from old.user_id or new.group_id is distinct from old.group_id then
    raise exception 'A join request cannot be reassigned to another family or group';
  end if;

  if old.status <> 'pending' then
    raise exception 'A decided join request cannot be reopened; the family must ask again';
  end if;

  return new;
end
$$;
revoke all on function public.join_requests_pin_identity() from public;
revoke execute on function public.join_requests_pin_identity() from anon;

drop trigger if exists join_requests_identity_immutable on public.join_requests;
create trigger join_requests_identity_immutable
  before update on public.join_requests
  for each row execute function public.join_requests_pin_identity();

-- M2: close the anon gap on the table-level UPDATE grant too. Step 1 above
-- narrows `authenticated` to (status, decided_at); anon should have none of
-- it, since anon has no business updating join_requests at all.
revoke update on public.join_requests from anon;
