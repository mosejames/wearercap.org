-- 0009: proximity matching, Phase A of the carpool-proximity-matching spec
-- (docs/superpowers/specs/2026-07-20-carpool-proximity-matching-design.md).
--
-- Two things, and ONLY these two things:
--   1. A nullable radius_miles column on families (the family's personal
--      "show me families within N miles" override; null = adaptive default).
--   2. A NEW read path, nearby_families(), that returns the caller's in-radius
--      families with two computed distances. family_directory() is left exactly
--      as 0008 wrote it because the admin panel (admin.js fetchAllFamilies)
--      consumes it and MUST keep receiving every family. nearby_families() is
--      the parent-facing, radius-scoped list; the two do not share a body.
--
-- Nothing here touches table data, any RLS policy, or family_directory().

-- ---------------------------------------------------------------- 1. column --
-- Personal radius override. null means "use the adaptive default computed in
-- nearby_families()". A number is the family's own cap. The CHECK keeps it in
-- [1, 25]; the 25-mile metro cap is ALSO re-enforced in the read (defense in
-- depth), so a column that somehow held > 25 still cannot widen a real list.
--
-- No new grant or policy is needed to let a family write this:
--   * 0002's families_update_self_* policy already scopes UPDATE to
--     `user_id = auth.uid()`, so a family can write their own row's columns.
--   * Unlike members (which has a column-narrowed `grant update (approval,
--     can_organize)` in 0006/0008 that would block a new column until widened),
--     families has NO column-narrowed grant. authenticated holds table-level
--     UPDATE on families, so a newly added column is writable through the
--     existing row policy the moment it exists. Deliberately adding nothing.
--
-- `add column if not exists` makes this idempotent: on a second run the whole
-- clause (column AND its inline CHECK) is skipped, so the constraint is never
-- added twice.
alter table public.families
  add column if not exists radius_miles double precision
  check (radius_miles is null or (radius_miles >= 1 and radius_miles <= 25));

-- ------------------------------------------------------- 2. nearby_families --
-- The parent-facing near-you list. Returns the SAME safe columns as
-- family_directory() plus two computed miles values, already filtered to the
-- caller's effective radius and ordered nearest-first.
--
-- GATING CONTRACT: this carries EVERY gate family_directory() (0008) has,
-- unchanged, and ADDS the radius filter on top. The radius filter is an extra
-- AND on the final select; it never replaces or weakens a gate:
--   * caller is an approved member                    -- is_approved_member()
--   * caller has a family row OR is_admin()           -- 0008 reciprocal
--   * the row SUBJECT is an approved member           -- 0007 subject predicate
--   * the caller's own row is excluded                -- f.user_id <> auth.uid()
--   * distance <= the caller's EFFECTIVE radius       -- NEW (added on top)
--
-- SECURITY DEFINER (bypasses families RLS; the WHERE clause is the gate) and
-- `set search_path = public, pg_temp`, matching every function 0005 onward.
create or replace function public.nearby_families()
returns table (
  user_id uuid,
  parent_name text,
  child_names text,
  area_lat double precision,
  area_lng double precision,
  area_label text,
  direction text,
  weekdays text[],
  distance_miles double precision,          -- caller's area centroid -> this family's
  distance_to_school_miles double precision -- this family's area centroid -> RCA
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with me as (
    -- The caller's own family row. It supplies the area centroid that every
    -- distance is measured from, and the caller's personal radius_miles.
    -- If the caller has NO family row this CTE is empty, and because `cand`
    -- cross joins it, `cand` is empty and the function returns zero rows. That
    -- is precisely the 0008 reciprocal gate: publish your own family before you
    -- can read others'. (An admin with no family row also lands here with zero
    -- rows; that is fine, because the admin roster uses family_directory(), not
    -- this RPC, so no moderation surface is lost.)
    select f.user_id, f.area_lat, f.area_lng, f.radius_miles
    from public.families f
    where f.user_id = auth.uid()
  ),
  cand as (
    -- Every family that passes ALL the family_directory() gates, each carrying
    -- its distance from the caller and its distance to school. The radius
    -- filter is NOT applied here -- it is applied on the final select, strictly
    -- on top of these gates.
    select
      f.user_id, f.parent_name, f.child_names,
      f.area_lat, f.area_lng, f.area_label, f.direction, f.weekdays,
      -- caller's centroid -> this family's centroid.
      -- Haversine copied verbatim from area_family_count (0003): the
      -- `3959 * acos(greatest(-1.0, least(1.0, ...)))` clamped form, so
      -- precision and edge-case handling match the rest of the codebase.
      3959 * acos(
            greatest(-1.0, least(1.0,
              cos(radians(me.area_lat)) * cos(radians(f.area_lat))
              * cos(radians(f.area_lng) - radians(me.area_lng))
              + sin(radians(me.area_lat)) * sin(radians(f.area_lat))
            ))
          ) as distance_miles,
      -- this family's centroid -> Ron Clark Academy.
      -- RCA is a hard-coded constant, NOT a DB row or input:
      --   228 Margaret St SE, Atlanta, GA 30315  ->  lat 33.7407, lng -84.3731
      -- Same haversine shape as above. v1 uses this only as a displayed fact
      -- ("about N miles from school"); it is not a matching gate.
      3959 * acos(
            greatest(-1.0, least(1.0,
              cos(radians(33.7407)) * cos(radians(f.area_lat))
              * cos(radians(f.area_lng) - radians(-84.3731))
              + sin(radians(33.7407)) * sin(radians(f.area_lat))
            ))
          ) as distance_to_school_miles
    from public.families f
    cross join me
    where
      -- GATE 1 (0003/0007/0008): the CALLER is an approved member.
      public.is_approved_member()
      -- GATE 2 (0008 reciprocal): the caller has published their own family row
      -- OR is an admin. The `cross join me` already enforces the family-row
      -- half (no `me`, no candidates); this predicate is restated so the gate
      -- is explicit here and so an admin is not silently narrowed differently
      -- from family_directory().
      and (
        public.is_admin()
        or exists (select 1 from public.families m2 where m2.user_id = auth.uid())
      )
      -- GATE 3 (0007): the row SUBJECT must be an approved member too. Un-
      -- approving a family removes them from every other parent's list at once.
      and exists (
        select 1 from public.members am
        where am.user_id = f.user_id and am.approval = 'approved'
      )
      -- GATE 4: never surface the caller's own row.
      and f.user_id <> auth.uid()
  ),
  effective as (
    -- The effective radius, the three layers from the spec, computed here so
    -- the client receives nothing outside it.
    --
    --   * METRO CAP (privacy floor): the whole expression is wrapped in
    --     least(25, ...), so NOTHING -- personal or adaptive -- ever exceeds
    --     25 miles. This is also the defense-in-depth guarantee the review
    --     asks for: even if radius_miles somehow held > 25, the read clamps it.
    --
    --   * PERSONAL OVERRIDE: if the caller set radius_miles, that value wins
    --     (already inside [1,25] by the column CHECK; the least(25, ...) is the
    --     belt-and-suspenders clamp on top).
    --
    --   * ADAPTIVE DEFAULT: if no personal radius is set, widen a 3-mile base
    --     to the distance of the 3rd-nearest candidate when that is farther, so
    --     a sparse area is never stranded on an empty list:
    --       - fewer than 3 candidates total  -> 25 (show everything in-metro)
    --       - otherwise  -> greatest(3, distance-of-3rd-nearest)
    --     "distance of the 3rd-nearest" is a distance-ascending rank: ORDER BY
    --     distance ASC, LIMIT 1 OFFSET 2 (offset 2 = the 3rd row, 0-based).
    select least(
      25.0,
      case
        when (select radius_miles from me) is not null
          then (select radius_miles from me)
        when (select count(*) from cand) < 3
          then 25.0
        else greatest(
          3.0,
          (select c.distance_miles from cand c order by c.distance_miles limit 1 offset 2)
        )
      end
    ) as radius_miles
  )
  select
    c.user_id, c.parent_name, c.child_names,
    c.area_lat, c.area_lng, c.area_label, c.direction, c.weekdays,
    c.distance_miles, c.distance_to_school_miles
  from cand c
  where c.distance_miles <= (select radius_miles from effective)
  order by c.distance_miles, c.parent_name;
$$;

-- Hardening, matching 0005/0007/0008: never callable by public or anon; only
-- authenticated sessions (the RLS bypass lives inside the definer body, so the
-- grant must be tight). Idempotent -- revoke/grant re-run cleanly.
revoke all on function public.nearby_families() from public;
revoke execute on function public.nearby_families() from anon;
grant execute on function public.nearby_families() to authenticated;
