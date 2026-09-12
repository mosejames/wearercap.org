-- Applied September 12, 2026 (migration m3_vault_team_visibility).
-- Teams see only their own photos while the marathon is on. Admin sees all.
-- After reveal_at (null = never) everyone sees everything.
alter table public.m3_settings add column reveal_at timestamptz;
update public.m3_settings set reveal_at = '2026-09-15 13:00:00 America/New_York' where vault = 'm3-2028';

-- Photos and comments are no longer readable directly. The insert policies stay.
drop policy if exists m3_photos_read on public.m3_photos;
drop policy if exists m3_comments_read on public.m3_comments;

create or replace function public.m3_visibility(p_token text default '', p_pass text default '', p_vault text default 'm3-2028')
returns table (team text, see_all boolean, reveal_at timestamptz, owner text)
language sql stable security definer set search_path = '' as $$
  select coalesce(pr.team, ''),
         public.m3_pass_ok(p_vault, p_pass) or (s.reveal_at is not null and now() >= s.reveal_at),
         s.reveal_at,
         public.m3_hash(p_token)
  from public.m3_settings s
  left join public.m3_profiles pr on pr.owner = public.m3_hash(p_token) and pr.vault = p_vault
  where s.vault = p_vault;
$$;

-- Every photo read in the app. p_mode: 'order' (capture time), 'recent', 'top', 'mine'.
create or replace function public.m3_list_photos(p_token text default '', p_pass text default '', p_event uuid default null, p_mode text default 'order', p_limit integer default 2000, p_vault text default 'm3-2028')
returns table (photo public.m3_photos, likes integer)
language plpgsql stable security definer set search_path = '' as $$
declare v record;
begin
  select * into v from public.m3_visibility(p_token, p_pass, p_vault);
  return query
    select ph, coalesce(l.likes, 0)
    from public.m3_photos ph
    left join public.m3_profiles pr on pr.owner = ph.owner
    left join public.m3_photo_likes l on l.photo_id = ph.id
    where ph.vault = p_vault and not ph.hidden
      and (p_event is null or ph.event_id = p_event)
      and (p_mode <> 'mine' or ph.owner = v.owner)
      and (v.see_all
           or ph.owner = v.owner
           or (v.team <> '' and coalesce(nullif(ph.team, ''), pr.team, '') = v.team))
    order by
      case when p_mode = 'top' then coalesce(l.likes, 0) end desc nulls last,
      case when p_mode in ('recent', 'mine') then ph.created_at end desc nulls last,
      coalesce(ph.taken_at, ph.created_at) asc, ph.created_at asc
    limit greatest(1, least(p_limit, 5000));
end $$;

create or replace function public.m3_photo_visible(p_photo uuid, p_token text default '', p_pass text default '')
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.m3_list_photos(p_token, p_pass, null, 'order', 5000) x where (x.photo).id = p_photo);
$$;

create or replace function public.m3_list_comments(p_photo uuid, p_token text default '', p_pass text default '')
returns setof public.m3_comments language sql stable security definer set search_path = '' as $$
  select c.* from public.m3_comments c
  where c.photo_id = p_photo and not c.hidden and public.m3_photo_visible(p_photo, p_token, p_pass)
  order by c.created_at;
$$;

create or replace function public.m3_comment_counts(p_photos uuid[], p_token text default '', p_pass text default '')
returns table (photo_id uuid, n bigint) language sql stable security definer set search_path = '' as $$
  select c.photo_id, count(*) from public.m3_comments c
  join public.m3_list_photos(p_token, p_pass, null, 'order', 5000) x on (x.photo).id = c.photo_id
  where c.photo_id = any(p_photos) and not c.hidden
  group by c.photo_id;
$$;

revoke all on function public.m3_visibility(text,text,text), public.m3_list_photos(text,text,uuid,text,integer,text),
  public.m3_photo_visible(uuid,text,text), public.m3_list_comments(uuid,text,text), public.m3_comment_counts(uuid[],text,text) from public;
grant execute on function public.m3_visibility(text,text,text), public.m3_list_photos(text,text,uuid,text,integer,text),
  public.m3_photo_visible(uuid,text,text), public.m3_list_comments(uuid,text,text), public.m3_comment_counts(uuid[],text,text) to anon, authenticated;
