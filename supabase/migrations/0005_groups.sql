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

-- CONSENT gate for membership creation: true only if the target user has a
-- live PENDING join request for this group. Without this, an organizer's
-- insert privilege could be used to add ANY user to a group without that
-- user ever having asked to join. Do not remove.
--
-- Restricted to status = 'pending' only (not 'accepted'): a request that has
-- already been accepted is stale consent, not live consent. If it stayed
-- valid after acceptance, a parent who joins and later leaves (deleting
-- their own membership) would leave behind an 'accepted' request that lets
-- the organizer silently re-add them forever with no fresh ask. The intended
-- accept flow is therefore ORDER-DEPENDENT: the client must INSERT the
-- membership row (which this function gates) WHILE the request is still
-- 'pending', and only AFTER that insert succeeds mark the request
-- 'accepted'. Flipping that order breaks the accept flow by design.
--
-- Also gated on the caller: has_open_request() is granted to all
-- `authenticated` (see memberships_insert_organizer_or_self_create, which
-- calls it as SECURITY DEFINER), so without a caller check it would be an
-- ungated oracle letting any logged-in user, approved or not, probe
-- "did family X ask to join group Y" for arbitrary gid/uid pairs, routing
-- around the join_requests SELECT policy entirely. Requiring the caller to
-- organize gid keeps that probe restricted to people who could already see
-- pending requests for that group via pending_requesters()/the SELECT policy.
create or replace function public.has_open_request(gid uuid, uid uuid)
returns boolean language sql security definer set search_path = public, pg_temp as $$
  select public.is_group_organizer(gid) and exists (
    select 1 from public.join_requests r
    where r.group_id = gid and r.user_id = uid
      and r.status = 'pending'
  );
$$;

revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.is_group_organizer(uuid) from public;
revoke all on function public.has_open_request(uuid, uuid) from public;
revoke execute on function public.is_group_member(uuid) from anon;
revoke execute on function public.is_group_organizer(uuid) from anon;
revoke execute on function public.has_open_request(uuid, uuid) from anon;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.is_group_organizer(uuid) to authenticated;
grant execute on function public.has_open_request(uuid, uuid) to authenticated;

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

-- Insert: the ORGANIZER adds members (this is how a join request is accepted),
-- or a creator seeds their own membership at creation time. A requester can
-- never insert themselves into someone else's group. The has_open_request()
-- clause is the CONSENT gate: it ensures the organizer can only add a target
-- user who actually asked to join (or is the organizer seeding their own
-- row). Without it, any approved member could create a group and bulk-add
-- arbitrary users pulled from family_directory(), then harvest their contact
-- info via group_roster(). Do not remove this clause.
drop policy if exists memberships_insert_organizer_or_self_create on public.memberships;
create policy memberships_insert_organizer_or_self_create
  on public.memberships for insert
  with check (
    public.is_approved_member()
    and public.is_group_organizer(group_id)
    and (
      user_id = auth.uid()                                  -- organizer seeds their own row
      or public.has_open_request(group_id, user_id)         -- target actually asked to join
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
    and public.is_group_organizer(gid);
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
-- memberships_insert_organizer_or_self_create trusts it to prove the target
-- asked to join. If its identity (who asked, for which group) could be
-- changed after the fact, an organizer could repoint one legitimate request
-- at any victim in turn via join_requests_update_organizer (which lets an
-- organizer UPDATE any request in their own group with no column
-- restriction) and re-run the has_open_request() consent gate against a
-- target who never asked, re-enabling the exact contact-harvest that gate
-- was built to stop. Two independent layers close this, because either one
-- alone is fragile to a future change:
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
create or replace function public.join_requests_pin_identity()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.user_id is distinct from old.user_id or new.group_id is distinct from old.group_id then
    raise exception 'A join request cannot be reassigned to another family or group';
  end if;
  return new;
end
$$;
revoke all on function public.join_requests_pin_identity() from public;

drop trigger if exists join_requests_identity_immutable on public.join_requests;
create trigger join_requests_identity_immutable
  before update on public.join_requests
  for each row execute function public.join_requests_pin_identity();
