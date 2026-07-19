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
