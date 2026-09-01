-- One row per house: the numbers on the hero.
create or replace view public.vault_totals
with (security_invoker = true) as
  select
    e.house,
    count(p.id)                              as photo_count,
    count(distinct p.user_id)                as family_count,
    count(distinct p.event_id)               as event_count,
    (select count(*) from public.vault_likes l
      join public.vault_photos q on q.id = l.photo_id
      where q.house = e.house and not q.hidden) as like_count
  from public.vault_events e
  left join public.vault_photos p on p.event_id = e.id and not p.hidden
  group by e.house;

grant select on public.vault_totals to anon, authenticated;
