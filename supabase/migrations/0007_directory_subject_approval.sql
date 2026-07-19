-- 0007: the directory must check row SUBJECTS, not just the caller.
--
-- Found during admin-panel live acceptance: family_directory() (0003) gates
-- on is_approved_member() — the CALLER — and returns every families row. So
-- a family whose signup is still sitting unvetted in the admin queue already
-- has their parent name, child names, and area on every approved parent's
-- map. That defeats the point of the approval gut check, and it is the same
-- caller-vs-subject confusion fixed in 0005's group_roster (round 5) and
-- 0006's accept-time requester check. This migration applies the identical
-- subject predicate to the two 0003 read paths.
--
-- The admin panel is unaffected in the way that matters: pending families
-- reach admins through the queue (admin-gated SELECTs), which is the correct
-- surface for unvetted signups; the panel's Families roster is deliberately
-- "what approved parents see", which after this migration is once again true.

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
    -- The row SUBJECT must be an approved member too. Without this, filling
    -- in the family form is enough to broadcast a child's name to the whole
    -- community before any admin has looked at the signup.
    and exists (
      select 1 from public.members am
      where am.user_id = f.user_id and am.approval = 'approved'
    );
$$;

-- Same subject predicate for the count teaser a pending user sees ("N
-- families already in your area"). Counting unvetted signups inflates it.
-- The caller gate stays is_member() on purpose: pending users are meant to
-- see the count, just not names.
-- Body copied verbatim from 0003 with exactly ONE addition, the subject
-- predicate. Everything else (comma join, coalesce wrapper, clamp order,
-- haversine shape) is deliberately untouched so this replace cannot drift
-- the behavior it is not trying to change.
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

-- 0003 predates the pg_temp pinning and the explicit anon revokes that 0005
-- onward treat as mandatory; re-assert them here for both functions.
revoke all on function public.family_directory() from public;
revoke all on function public.area_family_count(double precision) from public;
revoke execute on function public.family_directory() from anon;
revoke execute on function public.area_family_count(double precision) from anon;
grant execute on function public.family_directory() to authenticated;
grant execute on function public.area_family_count(double precision) to authenticated;
