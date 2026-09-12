-- Applied September 12, 2026 (migrations m3_vault_photo_team, m3_vault_drop_old_move).
-- A photo's team is stamped at upload from the chaperone's profile and can be
-- changed afterwards, by the owner (token) or an admin (passcode). Older rows
-- with an empty team fall back to the chaperone's current team.
alter table public.m3_photos add column team text not null default '';
create index m3_photos_team on public.m3_photos (vault, team);

create or replace view public.m3_teams as
with eff as (
  select ph.id, ph.vault, ph.created_at, coalesce(nullif(ph.team, ''), pr.team, '') as team
  from public.m3_photos ph
  left join public.m3_profiles pr on pr.owner = ph.owner
  where not ph.hidden
), names as (
  select vault, team from public.m3_profiles where team <> ''
  union
  select vault, team from eff where team <> ''
)
select n.vault, n.team,
  coalesce((select array_agg(distinct p.display_name order by p.display_name) from public.m3_profiles p where p.vault = n.vault and p.team = n.team), '{}'::text[]) as chaperones,
  coalesce((select array_agg(distinct s order by s) from public.m3_profiles p, unnest(p.students) s where p.vault = n.vault and p.team = n.team), '{}'::text[]) as students,
  (select count(*) from eff e where e.vault = n.vault and e.team = n.team) as photo_count,
  (select max(e.created_at) from eff e where e.vault = n.vault and e.team = n.team) as last_upload_at
from names n;

grant select on public.m3_teams to anon, authenticated;

create or replace function public.m3_set_team(p_photos uuid[], p_team text, p_token text default '', p_pass text default '')
returns integer language plpgsql security definer set search_path = '' as $$
declare o text := public.m3_hash(p_token); n integer;
begin
  update public.m3_photos ph set team = left(btrim(coalesce(p_team, '')), 40)
  where ph.id = any(p_photos)
    and (ph.owner = o or public.m3_pass_ok(ph.vault, p_pass));
  get diagnostics n = row_count;
  return n;
end $$;

drop function public.m3_move_uploads(text, uuid[], uuid);
create or replace function public.m3_move_uploads(p_pass text, p_photos uuid[], p_to uuid, p_token text default '')
returns integer language plpgsql security definer set search_path = '' as $$
declare v text; n integer; o text := public.m3_hash(p_token);
begin
  select vault into v from public.m3_events where id = p_to and not hidden;
  if v is null then raise exception 'No such album'; end if;
  update public.m3_photos ph set event_id = p_to
  where ph.id = any(p_photos) and ph.vault = v
    and (ph.owner = o or public.m3_pass_ok(v, p_pass));
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.m3_set_team(uuid[], text, text, text), public.m3_move_uploads(text, uuid[], uuid, text) from public;
grant execute on function public.m3_set_team(uuid[], text, text, text), public.m3_move_uploads(text, uuid[], uuid, text) to anon, authenticated;
