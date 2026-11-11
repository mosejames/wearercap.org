-- Carpool mutual interest (Mose, 2026-11-10).
--
-- WHY. Families could see neighbours but nobody took the next step: zero
-- working carpools. Starting a group told nobody, and a cold ask to a named
-- stranger is expensive. Now each parent privately says "I'm interested" in a
-- nearby family. Nothing is revealed to anyone until BOTH families have said
-- yes; only then do names, children and contact details unlock, for those two
-- families only.
--
-- PRIVACY MOVES INTO THE DATABASE. Before this, nearby_families() handed every
-- approved member the parent and child names of everyone nearby, and
-- family_directory() handed them everyone in the program. Hiding names in the
-- UI alone would be theatre. So:
--   * carpool_neighbors() is the ONE parent-facing read. Non-matched rows carry
--     area, schedule and distance only. Names and contact are NULL unless the
--     pair is mutual.
--   * nearby_families() stays as the gate engine (radius, approval, pause) but
--     is no longer executable by clients; carpool_neighbors() and
--     set_carpool_interest() call it as definers.
--   * family_directory() becomes admin-only. The admin roster is its only
--     caller.

create table if not exists public.carpool_interests (
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user   uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_user, to_user),
  constraint carpool_interests_not_self check (from_user <> to_user)
);
create index if not exists carpool_interests_to_user_idx on public.carpool_interests (to_user);
alter table public.carpool_interests enable row level security;
-- No policies and no grants: clients never touch this table directly. Who is
-- interested in whom is exactly the secret this feature keeps.
revoke all on public.carpool_interests from anon, authenticated;

-- ---------------------------------------------------------------- read --
create or replace function public.carpool_neighbors()
returns table (
  user_id uuid,
  area_label text,
  direction text,
  weekdays text[],
  distance_miles double precision,
  interested boolean,
  mutual boolean,
  parent_name text,
  child_names text,
  contact_email text,
  contact_phone text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select f.user_id, f.area_lat, f.area_lng
    from public.families f
    where f.user_id = auth.uid()
  ),
  -- Pairs where both sides said yes. Matches survive a later radius change or
  -- pause, the same way group memberships do: an introduction already made
  -- is not silently taken back. Either side can withdraw, which ends it.
  matches as (
    select a.to_user as uid
    from public.carpool_interests a
    join public.carpool_interests b
      on b.from_user = a.to_user and b.to_user = a.from_user
    where a.from_user = auth.uid()
  ),
  matched as (
    select
      f.user_id, f.area_label, f.direction, f.weekdays,
      case when me.user_id is null then null else
        3959 * acos(greatest(-1.0, least(1.0,
          cos(radians(me.area_lat)) * cos(radians(f.area_lat))
          * cos(radians(f.area_lng) - radians(me.area_lng))
          + sin(radians(me.area_lat)) * sin(radians(f.area_lat)))))
      end as distance_miles,
      true as interested, true as mutual,
      f.parent_name, f.child_names, f.contact_email, f.contact_phone
    from public.families f
    join matches m on m.uid = f.user_id
    left join me on true
    where public.is_approved_member()
      and exists (select 1 from public.members am
                  where am.user_id = f.user_id and am.approval = 'approved')
  ),
  -- Everyone else in range, through every nearby_families() gate (approved
  -- caller, reciprocal publish, approved subject, not yourself, pause both
  -- ways, effective radius). Identity columns are deliberately NULL.
  near as (
    select
      n.user_id, n.area_label, n.direction, n.weekdays, n.distance_miles,
      exists (select 1 from public.carpool_interests i
              where i.from_user = auth.uid() and i.to_user = n.user_id) as interested,
      false as mutual,
      null::text, null::text, null::text, null::text
    from public.nearby_families() n
    where n.user_id not in (select uid from matches)
  )
  select * from matched
  union all
  select * from near
  order by 7 desc, 5 nulls last;
$$;

-- --------------------------------------------------------------- write --
create or replace function public.set_carpool_interest(p_family uuid, p_interested boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_mutual boolean;
begin
  if v_me is null or not public.is_approved_member() then
    raise exception 'Please sign in again to continue.';
  end if;

  if p_interested then
    if not exists (select 1 from public.families f
                   where f.user_id = v_me and f.paused_at is null) then
      raise exception 'Resume carpool before saying you are interested.';
    end if;
    -- You can only reach families the gates already show you. This stops a
    -- client from fishing for matches with arbitrary ids.
    if not exists (select 1 from public.nearby_families() n where n.user_id = p_family) then
      raise exception 'That family is no longer in your search area.';
    end if;
    insert into public.carpool_interests (from_user, to_user)
    values (v_me, p_family)
    on conflict do nothing;
  else
    delete from public.carpool_interests
    where from_user = v_me and to_user = p_family;
  end if;

  select exists (
    select 1 from public.carpool_interests a
    join public.carpool_interests b on b.from_user = a.to_user and b.to_user = a.from_user
    where a.from_user = v_me and a.to_user = p_family
  ) into v_mutual;

  return jsonb_build_object('interested', p_interested, 'mutual', coalesce(v_mutual, false));
end;
$$;

revoke all on function public.carpool_neighbors() from public, anon;
grant execute on function public.carpool_neighbors() to authenticated;
revoke all on function public.set_carpool_interest(uuid, boolean) from public, anon;
grant execute on function public.set_carpool_interest(uuid, boolean) to authenticated;

-- nearby_families() keeps its gates but is no longer a client endpoint: it
-- returns names. Definer functions above still call it.
revoke execute on function public.nearby_families() from public, anon, authenticated;

-- ------------------------------------------------- admin-only directory --
create or replace function public.family_directory()
returns table(user_id uuid, parent_name text, child_names text, area_lat double precision,
              area_lng double precision, area_label text, direction text, weekdays text[])
language sql
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select f.user_id, f.parent_name, f.child_names,
         f.area_lat, f.area_lng, f.area_label, f.direction, f.weekdays
  from public.families f
  where public.is_approved_member()
    -- Admin only since mutual interest (20261111). Parents now read neighbours
    -- through carpool_neighbors(), which never returns a name before a match.
    -- The admin roster is the only caller, and the un-approve button lives
    -- there, so admins keep the full list even without a family row.
    and public.is_admin()
    -- Row SUBJECT must be approved too (0007).
    and exists (
      select 1 from public.members am
      where am.user_id = f.user_id and am.approval = 'approved'
    );
$function$;

-- ---------------------------------------------------- match notification --
-- Every new interest row goes to the notify edge function, which emails both
-- families only when the reverse row already exists (a mutual match). The
-- record carries two user ids and a timestamp, nothing else.
drop trigger if exists carpool_interests_notify on public.carpool_interests;
create trigger carpool_interests_notify
  after insert on public.carpool_interests
  for each row execute function public.notify_carpool_webhook();
