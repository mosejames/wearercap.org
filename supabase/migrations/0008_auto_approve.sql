-- 0008: auto-approve signups (admin-switchable), and gate ORGANIZING behind
-- an explicit admin grant.
--
-- PRODUCT DECISION (Mose, 2026-07-19). The approval queue was the biggest
-- drop-off in the funnel: a parent filled in the whole family form, hit a
-- wall, and waited days for a volunteer to check their email. So joining is
-- now instant by default. But the first review of that change found the hole
-- it opened, and this migration closes it in the same breath:
--
--   Joining is cheap and reversible. ORGANIZING is not. A group organizer is
--   the one role that can pull real families' email, phone, and children's
--   names out of the system (via group_roster, by accepting join requests).
--   With auto-approve on, anyone holding a working email address could have
--   become one: sign up, type any plausible family into the form, create a
--   group, wait for real RCA families to ask to join, accept, harvest.
--
-- So the human gate did not disappear, it MOVED to where the leverage is.
-- Signing up: automatic. Becoming an organizer: an admin says yes, per
-- family, in the admin panel.
--
-- Both behaviours are switchable at runtime from the admin panel, because
-- Mose asked to be able to turn auto-approve back off later without a code
-- change. See public.settings below.
--
-- WHAT STILL HOLDS THE LINE:
--   1. ORGANIZER GRANT (new). members.can_organize, admin-set, required to
--      create a group. Admins can always organize.
--   2. RECIPROCAL DISCLOSURE (new). Reading the directory or the group list
--      requires the caller to have published their OWN family row. You cannot
--      browse other people's children while staying anonymous yourself.
--   3. CONTACT DETAILS. Still require group membership, which still requires
--      an organizer to accept a request. 0005 is not relaxed here at all.
--   4. ADMINS STILL REMOVE. unapprove_member() (0006) locks a family straight
--      back out of the directory and sweeps their group memberships.
--   5. ROLE IS STILL PINNED. INSERT forces role='parent'; 0006's column grant
--      plus members_pin_role make role changes impossible through the API.
--      Self-approval is now intended; self-PROMOTION remains impossible.
--
-- KNOWN LIMIT, ACCEPTED: a removed family can sign up again and, while
-- auto-approve is on, be approved again. There is no blocklist. The admin has
-- to remove them again, or switch auto-approve off. If that becomes a real
-- problem the fix is a blocked-emails table checked at insert, not a return
-- to the queue.

-- ---------------------------------------------------------------- settings --
-- Single-row config table. The `id boolean primary key check (id)` trick
-- makes a second row impossible: the only value that satisfies the check is
-- true, and true is already taken by the primary key.
create table if not exists public.settings (
  id boolean primary key default true check (id),
  auto_approve_signups boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

-- Any signed-in user may READ the setting (it is a policy flag, not a
-- secret, and the admin panel has to render its current state). Only admins
-- may change it.
drop policy if exists settings_select_authenticated on public.settings;
create policy settings_select_authenticated
  on public.settings for select
  using (auth.uid() is not null);

drop policy if exists settings_update_admin on public.settings;
create policy settings_update_admin
  on public.settings for update
  using (public.is_admin())
  with check (public.is_admin());

-- No INSERT or DELETE policy on purpose: the single row is seeded above and
-- must never be removed or duplicated. Without those policies RLS denies
-- both for everyone.

-- SECURITY DEFINER so the members INSERT policy and the column default can
-- both read the flag without every signing-up user needing table privileges.
--
-- Note the coalesce fails OPEN, not safe: a missing row means auto-approve ON.
-- That is deliberate, because the alternative is worse. If the row vanished
-- and this returned false, the column default and the INSERT policy would
-- still agree, so signup would keep working but silently switch to
-- hold-for-review with nobody told. Failing open keeps behaviour matching the
-- table's own default. Only a superuser can delete that row (no DELETE
-- policy), so this branch is close to unreachable either way.
create or replace function public.auto_approve_enabled()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select coalesce((select s.auto_approve_signups from public.settings s where s.id), true);
$$;

revoke all on function public.auto_approve_enabled() from public;
revoke execute on function public.auto_approve_enabled() from anon;
grant execute on function public.auto_approve_enabled() to authenticated;

-- ------------------------------------------------------- signup approval --
-- The COLUMN DEFAULT has to track the toggle, because ensureMemberRow
-- (auth.js) inserts only {user_id, email} and never sends approval. Postgres
-- applies the default BEFORE evaluating the RLS WITH CHECK, so if the two
-- disagree every signup dies with 42501 and the app's fatal error screen is
-- the first thing a new parent sees. Review round 1 of this file shipped
-- exactly that bug. Default and policy call the SAME function so they cannot
-- drift apart.
alter table public.members
  alter column approval
  set default (case when public.auto_approve_enabled() then 'approved' else 'pending' end);

drop policy if exists members_insert_self_pending on public.members;
drop policy if exists members_insert_self on public.members;
create policy members_insert_self
  on public.members for insert
  with check (
    user_id = auth.uid()
    and role = 'parent'
    and approval = (case when public.auto_approve_enabled() then 'approved' else 'pending' end)
  );

-- Backfill, FIRST RUN ONLY. Families already sitting in the queue signed up
-- under the old model and are exactly the people this change is meant to stop
-- stranding.
--
-- Two things make this statement dangerous if written the obvious way, and
-- both are handled here:
--
--   1. RE-RUNS WOULD UNDO MODERATION. A bare `update ... where approval =
--      'pending'` re-approves everyone an admin has un-approved SINCE the
--      first run. The settings row doubles as a has-this-migration-run-before
--      marker: the CTE only returns a row on the run that actually seeds it,
--      so the update fires exactly once, ever.
--   2. IT SENDS EMAIL. 0004's notify_member_update is AFTER UPDATE FOR EACH
--      ROW and unconditional, and the edge function keys the "You're approved"
--      mail on precisely this pending -> approved transition. So this
--      statement mails every affected family, one message each, at commit.
--      That is CORRECT and wanted (they have been waiting; telling them is
--      the point), but it is not free: Resend's free tier allows 100 mails a
--      day shared with sign-in codes. If the queue is ever deep, apply this
--      migration when the day's allowance is fresh, or comment out this
--      statement and approve them from the admin panel in batches instead.
with seeded as (
  insert into public.settings (id) values (true)
  on conflict (id) do nothing
  returning 1
)
update public.members
set approval = 'approved'
where approval = 'pending'
  and exists (select 1 from seeded);

-- ------------------------------------------------------ organizer grant --
alter table public.members
  add column if not exists can_organize boolean not null default false;

-- Admins can always organize without needing the flag set on themselves.
create or replace function public.can_organize()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select public.is_admin() or exists (
    select 1 from public.members m
    where m.user_id = auth.uid()
      and m.approval = 'approved'
      and m.can_organize
  );
$$;

revoke all on function public.can_organize() from public;
revoke execute on function public.can_organize() from anon;
grant execute on function public.can_organize() to authenticated;

-- Creating a group now needs the grant. Editing and deleting a group you
-- already organize are deliberately NOT gated on it: revoking someone's
-- ability to start new groups should not strand the group they already run,
-- and an admin can delete the whole group if it comes to that.
drop policy if exists groups_insert_self_approved on public.groups;
create policy groups_insert_self_approved
  on public.groups for insert
  with check (
    created_by = auth.uid()
    and public.is_approved_member()
    and public.can_organize()
  );

-- The admin panel writes both of these columns. 0006 narrowed authenticated's
-- UPDATE to (approval) alone; widen it by exactly one column. role stays
-- unwritable through the API, which is what stops self-promotion.
revoke update on public.members from authenticated;
grant update (approval, can_organize) on public.members to authenticated;
revoke update on public.members from anon;

-- -------------------------------------------------- reciprocal disclosure --
-- Reading the directory requires the caller to have their own families row.
-- Their UI already cannot reach the map before the family form is saved
-- (Ready.jsx renders the form until a family exists), so this costs a real
-- parent nothing; it exists because the RPC is callable directly with nothing
-- but an anon key and a session, and without it the product would hand a
-- complete list of RCA children's names to anyone who confirmed an email.
--
-- Kept separate from is_approved_member() because that also guards WRITES
-- (creating your first family), where a family-row requirement is circular.
create or replace function public.family_directory()
returns table (
  user_id uuid,
  parent_name text,
  child_names text,
  area_lat double precision,
  area_lng double precision,
  area_label text,
  direction text,
  weekdays text[]
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select f.user_id, f.parent_name, f.child_names,
         f.area_lat, f.area_lng, f.area_label, f.direction, f.weekdays
  from public.families f
  where public.is_approved_member()
    -- Publish your own family before reading others'. Admins are exempt: an
    -- admin without a family row would otherwise get an empty roster in the
    -- admin panel, and the un-approve button lives inside that roster, so the
    -- moderation tools would quietly vanish for the person who needs them.
    and (
      public.is_admin()
      or exists (select 1 from public.families me where me.user_id = auth.uid())
    )
    -- Row SUBJECT must be approved too (0007). Un-approving a family removes
    -- them from every other parent's map immediately.
    and exists (
      select 1 from public.members am
      where am.user_id = f.user_id and am.approval = 'approved'
    );
$$;

-- Body copied verbatim from 0007; no behavioural change here. area_family_count
-- already required the caller to have a families row by construction (it joins
-- `me` on auth.uid(), so no row means no rows means coalesce 0). Restated only
-- so 0007's subject predicate survives this migration intact.
create or replace function public.area_family_count(radius_miles double precision default 5)
returns integer
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select count(*)::int
    from public.families f, public.families me
    where me.user_id = auth.uid()
      and f.user_id <> auth.uid()
      and public.is_member()
      and exists (
        select 1 from public.members am
        where am.user_id = f.user_id and am.approval = 'approved'
      )
      and 3959 * acos(
            greatest(-1.0, least(1.0,
              cos(radians(me.area_lat)) * cos(radians(f.area_lat))
              * cos(radians(f.area_lng) - radians(me.area_lng))
              + sin(radians(me.area_lat)) * sin(radians(f.area_lat))
            ))
          ) <= least(50, greatest(0.25, radius_miles))
  ), 0);
$$;

revoke all on function public.family_directory() from public;
revoke all on function public.area_family_count(double precision) from public;
revoke execute on function public.family_directory() from anon;
revoke execute on function public.area_family_count(double precision) from anon;
grant execute on function public.family_directory() to authenticated;
grant execute on function public.area_family_count(double precision) to authenticated;

-- The same reciprocal rule for the group list. 0005's groups_select_approved
-- gated only on is_approved_member(), which used to mean an admin had vouched
-- for you and now means "confirmed an email address". A group row carries the
-- group name, the creator's area centroid, the weekday schedule, and
-- meeting_point, which in a carpool product is the corner where somebody's
-- children get picked up. That is a where and a when for children, and an
-- account that has disclosed nothing should not be able to read it.
drop policy if exists groups_select_approved on public.groups;
create policy groups_select_approved
  on public.groups for select
  using (
    public.is_approved_member()
    and (
      public.is_admin()
      or exists (select 1 from public.families me where me.user_id = auth.uid())
    )
  );

-- request_to_join() checked is_approved_member() but never that the requester
-- had published a family. An account with no family row could file a request
-- the organizer cannot even see (pending_requesters inner-joins families), and
-- if that request were accepted through a direct RPC call the ghost would read
-- the whole roster's contacts while staying anonymous itself.
--
-- Body copied verbatim from 0005 with ONE inserted guard. Every other line,
-- including the exact exception wording the client tests assert on and the
-- explicit status='pending' on insert, is unchanged so this replace cannot
-- drift behaviour it is not trying to change.
create or replace function public.request_to_join(gid uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  new_id uuid;
begin
  if not public.is_approved_member() then
    raise exception 'Only approved members can request to join';
  end if;

  -- NEW in 0008: reciprocity, see above.
  if not exists (select 1 from public.families where user_id = auth.uid()) then
    raise exception 'Add your family before asking to join a group';
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

-- ------------------------------------------- second layer on can_organize --
-- can_organize is a privilege-granting column, so it gets the same two-layer
-- treatment 0006 gave `role`, for the same stated reason: either layer alone
-- is fragile to a future migration. Layer 1 is the column grant plus
-- members_update_admin_only (the only UPDATE policy on this table today).
-- Layer 2 is here: even if someone later adds a permissive UPDATE policy for
-- profile editing, a parent still cannot hand themselves the organizer bit.
create or replace function public.members_pin_can_organize()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.can_organize is distinct from old.can_organize
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only a committee admin can change who may start groups';
  end if;
  return new;
end
$$;
revoke all on function public.members_pin_can_organize() from public;
revoke execute on function public.members_pin_can_organize() from anon;

drop trigger if exists members_can_organize_admin_only on public.members;
create trigger members_can_organize_admin_only
  before update on public.members
  for each row execute function public.members_pin_can_organize();

-- Removing a family should take their organizer grant with it. Without this,
-- un-approving someone and later re-approving them silently restores their
-- ability to start groups, which is not what the admin who removed them
-- would expect. Body is 0006's verbatim plus the one added column in the
-- UPDATE; every guard and the join_requests reasoning are unchanged.
create or replace function public.unapprove_member(target uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.members%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Only admins can un-approve a member';
  end if;

  select * into m from public.members where user_id = target for update;
  if not found then
    raise exception 'That member no longer exists';
  end if;

  if m.role = 'admin' then
    raise exception 'An admin account cannot be un-approved';
  end if;

  update public.members
  set approval = 'pending', can_organize = false
  where user_id = target;
  delete from public.memberships where user_id = target;
end
$$;

revoke all on function public.unapprove_member(uuid) from public;
revoke execute on function public.unapprove_member(uuid) from anon;
grant execute on function public.unapprove_member(uuid) to authenticated;

-- Explicit grants on settings, matching the convention every other object in
-- 0005 onward follows rather than relying on Supabase's default privileges.
-- Two layers here as everywhere else: RLS already denies INSERT and DELETE
-- (no policy exists for either), and this revoke removes the privilege
-- outright so the policy is not the only thing standing in the way. Supabase
-- grants ALL on new public tables by default, so without the revoke the grant
-- below would be purely additive and INSERT/DELETE would stay granted.
revoke all on public.settings from anon;
revoke all on public.settings from authenticated;
grant select, update on public.settings to authenticated;
