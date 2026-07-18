-- Phase 2B: one-sitting onboarding + map.
-- 1) Pending members may create/edit THEIR OWN family row (approval no longer
--    gates writing your own profile — it gates seeing others).
-- 2) family_directory(): the ONLY cross-family read path. Safe columns only,
--    approved members only.
-- 3) area_family_count(): count-only teaser for pending members.
-- 4) nearby_notified_at: throttle for "new family near you" emails.

-- Any member (pending or approved)?
create or replace function public.is_member()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

-- Relax writes: own row + any member (was: own row + approved member).
drop policy if exists families_insert_self_approved on public.families;
drop policy if exists families_update_self_approved on public.families;

create policy families_insert_self_member
  on public.families for insert
  with check (user_id = auth.uid() and public.is_member());

create policy families_update_self_member
  on public.families for update
  using (user_id = auth.uid() and public.is_member())
  with check (user_id = auth.uid() and public.is_member());

-- Throttle column for nearby notifications.
alter table public.families
  add column if not exists nearby_notified_at timestamptz;

-- The one sanctioned cross-family read: safe columns, approved members only.
-- SECURITY DEFINER bypasses families RLS; the WHERE clause is the gate.
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
set search_path = public
as $$
  select f.user_id, f.parent_name, f.child_names,
         f.area_lat, f.area_lng, f.area_label, f.direction, f.weekdays
  from public.families f
  where public.is_approved_member();
$$;

revoke all on function public.family_directory() from public;
grant execute on function public.family_directory() to authenticated;

-- Count-only teaser for pending members: how many OTHER families sit within
-- radius_miles of the caller's own area point. 0 if the caller has no family
-- row yet. Haversine on area centroids (coarse by design).
create or replace function public.area_family_count(radius_miles double precision default 5)
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select count(*)::int
    from public.families f, public.families me
    where me.user_id = auth.uid()
      and f.user_id <> auth.uid()
      and public.is_member()
      and 3959 * acos(
            least(1.0,
              cos(radians(me.area_lat)) * cos(radians(f.area_lat))
              * cos(radians(f.area_lng) - radians(me.area_lng))
              + sin(radians(me.area_lat)) * sin(radians(f.area_lat))
            )
          ) <= radius_miles
  ), 0);
$$;

revoke all on function public.area_family_count(double precision) from public;
grant execute on function public.area_family_count(double precision) to authenticated;
