-- RCAP school-wide vault: open the vault_ schema to a second house ('rcap').
--
-- Rules this migration keeps:
--   * Identity is per person, not per vault. One verified phone, one profile,
--     works in every vault. Members, owner links, badges and bans stay global.
--   * Everything about a photo is decided by the photo's (or event's) house,
--     never by a literal. Amistad behaviour is unchanged: every new house
--     parameter defaults to 'amistad'.
--   * Staff: 'owner' runs every house. 'admin' and 'moderator' stay Amistad.
--     Every other house is run by its own passcode in vault_settings.
--   * Photos in a school-wide vault carry the RCA house of the family that
--     added them (rca_house), stamped at insert from the profile, for the
--     house leaderboard.

-- ------------------------------------------------------------ rca_house
alter table public.vault_profiles add column if not exists rca_house text
  check (rca_house in ('amistad','altruismo','isibindi','reveur'));
alter table public.vault_photos add column if not exists rca_house text
  check (rca_house in ('amistad','altruismo','isibindi','reveur'));

create or replace view public.vault_people as
 select owner, display_name, house, student, created_at, rca_house from public.vault_profiles;

create or replace function public.vault_save_rca_house(p_rca_house text)
returns text language plpgsql security definer set search_path to '' as $$
declare o text := vault_private.active_owner();
begin
 if o is null then raise exception 'Verify your mobile number to continue'; end if;
 if p_rca_house not in ('amistad','altruismo','isibindi','reveur') then raise exception 'Choose your RCA house'; end if;
 update public.vault_profiles set rca_house=p_rca_house, updated_at=now() where owner=o;
 if not found then raise exception 'Add your name first'; end if;
 return p_rca_house;
end $$;
revoke all on function public.vault_save_rca_house(text) from public, anon;
grant execute on function public.vault_save_rca_house(text) to authenticated, service_role;

-- ------------------------------------------------------------ staff and passcodes
create or replace function public.vault_pass_ok(p_house text, p_pass text)
returns boolean language sql stable security definer set search_path to '' as $$
 select (p_house='amistad' and vault_private.staff_can('admin'))
     or (p_house is not null and vault_private.staff_can('owner'))
     or exists(select 1 from public.vault_settings s where s.house=p_house and s.admin_pass=coalesce(p_pass,''))
$$;

create or replace function public.vault_staff_role_for(p_house text)
returns text language sql stable security definer set search_path to '' as $$
 select case when r='owner' then r when p_house='amistad' then r end
 from (select public.vault_staff_role() r) x
$$;
grant execute on function public.vault_staff_role_for(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------ insert guard
create or replace function vault_private.limit_posts()
returns trigger language plpgsql security definer set search_path to '' as $$
declare o text:=vault_private.active_owner(); n bigint; h text; fallback text;
begin
 if o is null or new.owner<>o then raise exception 'Verify your number before contributing'; end if;
 perform pg_advisory_xact_lock(hashtextextended(o,8));
 if tg_table_name='vault_photos' then
  select count(*) into n from public.vault_photos where owner=o and created_at>now()-interval '1 hour';
  if n>=200 then raise exception 'Upload limit reached. Please try again later.'; end if;
  -- The event decides the house, whatever the client sent.
  select e.house into h from public.vault_events e where e.id=new.event_id;
  new.house:=coalesce(h,new.house);
  if new.house='amistad' then new.rca_house:='amistad';
  else
   new.rca_house:=(select rca_house from public.vault_profiles where owner=o);
   if new.rca_house is null then raise exception 'Choose your RCA house before adding photos'; end if;
  end if;
 else
  select p.house into h from public.vault_photos p where p.id=new.photo_id;
  select count(*) into n from public.vault_comments where owner=o and created_at>now()-interval '1 hour';
  if n>=60 then raise exception 'Please wait before adding more comments'; end if;
 end if;
 new.created_at:=now();
 fallback:=case when coalesce(h,'amistad')='amistad' then 'Amistad family' else 'RCA family' end;
 if tg_table_name='vault_photos' then
  new.uploader_name:=coalesce((select display_name from public.vault_profiles where owner=o),fallback);
 else
  new.author_name:=coalesce((select display_name from public.vault_profiles where owner=o),fallback);
 end if;
 return new;
end $$;

drop policy if exists vault_photos_insert on public.vault_photos;
create policy vault_photos_insert on public.vault_photos for insert to authenticated with check (
 owner = vault_private.active_owner() and not hidden and removed_at is null
 and exists(select 1 from public.vault_events e where e.id=vault_photos.event_id and e.open and not e.hidden and e.house=vault_photos.house)
 and key like (house||'/2026-27/'||(auth.uid())::text||'/%')
 and web_key = regexp_replace(key, '/orig\.[^/]+$', '/web.jpg')
 and thumb_key = regexp_replace(key, '/orig\.[^/]+$', '/thumb.jpg')
 and key ~ '/[0-9a-f-]{36}/orig\.(jpg|jpeg|png|webp|heic|heif|gif|mp4|mov|webm)$'
);
drop policy if exists vault_photo_reserved on public.vault_photos;
create policy vault_photo_reserved on public.vault_photos for insert to authenticated with check (
 vault_private.has_upload_slot(id, event_id)
 and house = (select e.house from public.vault_events e where e.id=vault_photos.event_id)
);

create or replace function vault_private.storage_slot(k text)
returns boolean language sql stable security definer set search_path to '' as $$
 select vault_private.active_owner() is not null and exists(select 1 from vault_private.upload_slots s
 join public.vault_events e on e.id=s.event_id
 where s.user_id=auth.uid() and s.created_at>now()-interval '1 hour'
 and k like (e.house||'/2026-27/'||s.user_id::text||'/'||left(regexp_replace(lower(s.slug),'[^a-z0-9-]+','-','g'),60)||'/'||s.id::text||'/%'))
$$;

create or replace function vault_private.can_delete_object(k text)
returns boolean language sql stable security definer set search_path to '' as $$
 select exists(select 1 from public.vault_photos p where p.removed_at is not null and k in(p.key,p.web_key,p.thumb_key)
 and (vault_private.owns(p.owner) or public.vault_moderation_ok(p.house,coalesce(current_setting('request.headers',true)::jsonb->>'x-vault-admin-pass',''))))
$$;

-- ------------------------------------------------------------ row-derived house
create or replace function public.vault_set_photo(p_id uuid, p_token text, p_pass text, p_hidden boolean default null, p_caption text default null)
returns void language plpgsql security definer set search_path to '' as $$
declare p public.vault_photos; a boolean;
begin
 select * into p from public.vault_photos where id=p_id; a:=coalesce(public.vault_pass_ok(p.house,p_pass),false);
 if p.id is null or not(a or vault_private.owns(p.owner)) then raise exception 'You cannot change this upload'; end if;
 if p.removed_at is not null then raise exception 'This upload was removed'; end if;
 if not a and vault_private.active_owner() is null and p_hidden is distinct from true then raise exception 'This account cannot publish'; end if;
 update public.vault_photos set hidden=coalesce(p_hidden,hidden),caption=coalesce(left(p_caption,280),caption) where id=p_id;
end $$;

create or replace function public.vault_remove_upload(p_id uuid, p_pass text default '')
returns jsonb language plpgsql security definer set search_path to '' as $$
declare p public.vault_photos;
begin
 select * into p from public.vault_photos where id=p_id for update;
 if p.id is null or not(vault_private.owns(p.owner) or public.vault_moderation_ok(p.house,p_pass)) then raise exception 'You cannot remove this upload'; end if;
 update public.vault_photos set hidden=true,removed_at=coalesce(removed_at,now()) where id=p_id;
 update vault_private.reports set status='removed',resolved_at=now() where photo_id=p_id;
 return jsonb_build_object('storage',p.storage,'keys',jsonb_build_array(p.key,p.web_key,p.thumb_key));
end $$;

create or replace function public.vault_finish_removal(p_id uuid, p_pass text default '')
returns void language plpgsql security definer set search_path to '' as $$
begin
 if not exists(select 1 from public.vault_photos where id=p_id and removed_at is not null and (vault_private.owns(owner) or public.vault_moderation_ok(house,p_pass))) then raise exception 'You cannot change this upload'; end if;
 update public.vault_photos set cleanup_pending=false where id=p_id;
end $$;

create or replace function public.vault_hide_comment(p_id uuid, p_token text, p_pass text)
returns void language plpgsql security definer set search_path to '' as $$
begin
 if not exists(select 1 from public.vault_comments c join public.vault_photos p on p.id=c.photo_id
   where c.id=p_id and (vault_private.owns(c.owner) or public.vault_moderation_ok(p.house,p_pass))) then raise exception 'You cannot remove this comment'; end if;
 update public.vault_comments set hidden=true where id=p_id;
end $$;

create or replace function public.vault_move_uploads(p_photos uuid[], p_from uuid, p_to uuid, p_pass text default '')
returns integer language plpgsql security definer set search_path to '' as $$
declare n integer; h text;
begin
 select house into h from public.vault_events where id=p_from;
 if h is null then raise exception 'Source gallery not found'; end if;
 if not public.vault_moderation_ok(h,p_pass) then raise exception 'Moderator access required'; end if;
 if p_from=p_to or p_from is null or p_to is null then raise exception 'Choose a different gallery'; end if;
 n:=cardinality(p_photos);
 if n is null or n<1 or n>500 or n<>(select count(distinct x) from unnest(p_photos) x) then raise exception 'Select between 1 and 500 uploads'; end if;
 perform 1 from public.vault_events where id=p_to and house=h and not hidden for share;
 if not found then raise exception 'That gallery is not available'; end if;
 perform 1 from public.vault_photos p join public.vault_events e on e.id=p.event_id where p.id=any(p_photos) and p.event_id=p_from and e.house=h and not p.hidden and p.removed_at is null for update of p;
 if (select count(*) from public.vault_photos where id=any(p_photos) and event_id=p_from and not hidden and removed_at is null)<>n then raise exception 'Some uploads changed. Refresh the gallery and try again'; end if;
 insert into vault_private.upload_moves(photo_id,from_event,to_event,actor) select unnest(p_photos),p_from,p_to,auth.uid();
 update public.vault_photos set event_id=p_to where id=any(p_photos);
 update public.vault_events set cover_photo=null where id=p_from and cover_photo=any(p_photos);
 return n;
end $$;

create or replace function public.vault_record_view(p_photo uuid, p_session text, p_legacy text default '')
returns boolean language plpgsql security definer set search_path to '' as $$
declare s text;
begin
 if p_session is null or p_session !~ '^[a-f0-9]{48}$' then return false; end if;
 if not exists(select 1 from public.vault_photos p join public.vault_events e on e.id=p.event_id where p.id=p_photo and not p.hidden and p.removed_at is null and not e.hidden and not vault_private.owns(p.owner) and (p_legacy='' or p.owner<>public.vault_hash(p_legacy))) then return false; end if;
 if auth.uid() is not null and vault_private.active_owner() is null then return false; end if;
 s:=public.vault_hash(p_session);
 perform pg_advisory_xact_lock(hashtextextended(s,29));
 if (select count(*) from vault_private.photo_views where session_hash=s and created_at>now()-interval '1 hour')>=300 then return false; end if;
 insert into vault_private.photo_views(photo_id,session_hash) values(p_photo,s) on conflict do nothing;
 return found;
end $$;

create or replace function public.vault_ban_uploader(p_pass text, p_photo uuid, p_reason text default '', p_hide_all boolean default false)
returns void language plpgsql security definer set search_path to '' as $$
declare m vault_private.members; h text;
begin
 select house into h from public.vault_photos where id=p_photo;
 if not public.vault_moderation_ok(h,p_pass) then raise exception 'Wrong passcode'; end if;
 select a.* into m from vault_private.members a join vault_private.owner_links l on l.user_id=a.user_id join public.vault_photos p on p.owner=l.owner where p.id=p_photo;
 if m.user_id is null then raise exception 'This older upload is not linked to a verified number yet. You can still remove it.'; end if;
 insert into vault_private.bans(phone_hash,reason) values(m.phone_hash,left(p_reason,500)) on conflict(phone_hash) do update set reason=excluded.reason;
 if p_hide_all then
  update public.vault_photos set hidden=true where owner in(select owner from vault_private.owner_links where user_id=m.user_id);
  update public.vault_comments set hidden=true where owner in(select owner from vault_private.owner_links where user_id=m.user_id);
 end if;
end $$;

create or replace function public.vault_set_gallery_visibility(p_id uuid, p_visible boolean, p_pass text default '')
returns void language plpgsql security definer set search_path to '' as $$
declare h text;
begin
 select house into h from public.vault_events where id=p_id;
 if not coalesce(public.vault_pass_ok(h,p_pass),false) then raise exception 'Admin access required'; end if;
 if p_visible is null then raise exception 'Choose whether to show this gallery'; end if;
 update public.vault_events set hidden=not p_visible where id=p_id and ongoing and category<>'everyday';
 if not found then raise exception 'Additional gallery not found'; end if;
end $$;

-- Amistad-only suggestion flow: pin its "term" lookup to Amistad now that
-- another house has an everyday album too.
do $$ declare d text; d2 text; begin
 select pg_get_functiondef('public.vault_review_event_suggestion(uuid,text,uuid,text,text)'::regprocedure) into d;
 d2:=replace(d,'from public.vault_events where kind=''everyday'' order by','from public.vault_events where kind=''everyday'' and house=''amistad'' order by');
 if d2=d then raise exception 'suggestion term lookup not found'; end if;
 execute d2;
end $$;

-- ------------------------------------------------------------ house parameter
drop function public.vault_admin_save_event(text, uuid, jsonb);
create function public.vault_admin_save_event(p_pass text, p_id uuid, p jsonb, p_house text default 'amistad')
returns public.vault_events language plpgsql security definer set search_path to 'public' as $$
declare r public.vault_events;
begin
  if not public.vault_pass_ok(p_house, p_pass) then raise exception 'Wrong passcode'; end if;
  if p_id is null then
    insert into public.vault_events (house, slug, title, blurb, kind, starts_on, ends_on, open, featured, hidden)
    values (p_house, p->>'slug', p->>'title', coalesce(p->>'blurb',''), coalesce(p->>'kind','house'),
            (p->>'starts_on')::date, nullif(p->>'ends_on','')::date,
            coalesce((p->>'open')::boolean, true), coalesce((p->>'featured')::boolean, false), coalesce((p->>'hidden')::boolean, false))
    returning * into r;
  else
    update public.vault_events set
      slug = p->>'slug', title = p->>'title', blurb = coalesce(p->>'blurb',''), kind = coalesce(p->>'kind', kind),
      starts_on = (p->>'starts_on')::date, ends_on = nullif(p->>'ends_on','')::date,
      open = coalesce((p->>'open')::boolean, open), featured = coalesce((p->>'featured')::boolean, featured),
      hidden = coalesce((p->>'hidden')::boolean, hidden)
    where id = p_id and house = p_house returning * into r;
    if r.id is null then raise exception 'Event not found'; end if;
  end if;
  update public.vault_events set category=case when p ? 'category' then nullif(p->>'category','') else category end, ongoing=coalesce((p->>'ongoing')::boolean,ongoing) where id=r.id returning * into r;
  return r;
end $$;
grant execute on function public.vault_admin_save_event(text,uuid,jsonb,text) to anon, authenticated, service_role;

drop function public.vault_admin_save_request(text, uuid, jsonb);
create function public.vault_admin_save_request(p_pass text, p_id uuid, p jsonb, p_house text default 'amistad')
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.vault_pass_ok(p_house, p_pass) then raise exception 'Wrong passcode'; end if;
  if not exists(select 1 from public.vault_events where id=(p->>'event_id')::uuid and house=p_house) then raise exception 'Event not found'; end if;
  if p_id is null then
    insert into public.vault_requests (house, event_id, message, goal, due_on, open)
    values (p_house, (p->>'event_id')::uuid, coalesce(p->>'message',''), coalesce((p->>'goal')::int, 40),
            nullif(p->>'due_on','')::date, coalesce((p->>'open')::boolean, true));
  else
    update public.vault_requests set
      event_id = (p->>'event_id')::uuid, message = coalesce(p->>'message',''), goal = coalesce((p->>'goal')::int, goal),
      due_on = nullif(p->>'due_on','')::date, open = coalesce((p->>'open')::boolean, open)
    where id = p_id and house = p_house;
    if not found then raise exception 'Ask not found'; end if;
  end if;
end $$;
grant execute on function public.vault_admin_save_request(text,uuid,jsonb,text) to anon, authenticated, service_role;

drop function public.vault_reserve_uploads(text, uuid[]);
create function public.vault_reserve_uploads(p_slug text, p_ids uuid[], p_house text default 'amistad')
returns void language plpgsql security definer set search_path to '' as $$
declare ev public.vault_events; n int;
begin
 if vault_private.active_owner() is null then raise exception 'This account cannot upload'; end if;
 n:=coalesce(array_length(p_ids,1),0);
 if n<1 or n>40 then raise exception 'Select between 1 and 40 files per batch'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,9));
 if (select count(*) from vault_private.upload_slots where user_id=auth.uid() and created_at>now()-interval '1 hour')+n>200 then raise exception 'Upload limit reached. Please try again later.'; end if;
 select * into ev from public.vault_events where slug=p_slug and house=p_house and open and not hidden;
 if ev.id is null then raise exception 'This album is not accepting uploads'; end if;
 if p_house<>'amistad' and (select rca_house from public.vault_profiles where owner=vault_private.active_owner()) is null then raise exception 'Choose your RCA house before adding photos'; end if;
 if exists(select 1 from public.vault_photos where id=any(p_ids)) then raise exception 'An upload with this ID already exists'; end if;
 insert into vault_private.upload_slots(id,user_id,event_id,slug) select unnest(p_ids),auth.uid(),ev.id,ev.slug;
end $$;
grant execute on function public.vault_reserve_uploads(text,uuid[],text) to anon, authenticated, service_role;

drop function public.vault_contributors(date, uuid);
create function public.vault_contributors(p_month date default null, p_event uuid default null, p_house text default 'amistad')
returns jsonb language sql stable security definer set search_path to '' as $$
with identities as (
 select p.owner,coalesce(m.owner,p.owner) canonical
 from public.vault_profiles p left join vault_private.owner_links l on l.owner=p.owner
 left join vault_private.members m on m.user_id=l.user_id
 where not exists(select 1 from vault_private.bans b where b.phone_hash=m.phone_hash)
), visible as (
 select p.*,i.canonical from public.vault_photos p join identities i on i.owner=p.owner
 join public.vault_events e on e.id=p.event_id
 where not p.hidden and p.removed_at is null and not e.hidden and p.house=p_house
 and (p_event is null or p.event_id=p_event)
), uploads as (
 select canonical,count(*) uploads,count(*) filter(where content_type like 'image/%') photos,count(distinct event_id) events
 from visible where p_month is null or date_trunc('month',created_at at time zone 'America/New_York')=date_trunc('month',p_month::timestamp)
 group by canonical
), engagement as (
 select canonical,sum(points) points,count(*) interactions from (
 select i.canonical,l.photo_id,1 points from public.vault_likes l join identities i on i.owner=l.owner join visible p on p.id=l.photo_id
 where i.canonical<>p.canonical and (p_month is null or date_trunc('month',l.created_at at time zone 'America/New_York')=date_trunc('month',p_month::timestamp)) group by i.canonical,l.photo_id
 union all
 select i.canonical,c.photo_id,2 points from public.vault_comments c join identities i on i.owner=c.owner join visible p on p.id=c.photo_id
 where not c.hidden and i.canonical<>p.canonical and (p_month is null or date_trunc('month',c.created_at at time zone 'America/New_York')=date_trunc('month',p_month::timestamp)) group by i.canonical,c.photo_id
 ) q group by canonical
), scores as (
 select p.owner,p.display_name,p.avatar_key,p.rca_house,coalesce(u.uploads,0) uploads,coalesce(u.photos,0) photos,coalesce(u.events,0) events,
 coalesce(g.interactions,0) interactions,coalesce(u.uploads,0)*5+coalesce(u.events,0)*10+least(coalesce(g.points,0),100) score
 from public.vault_profiles p left join uploads u on u.canonical=p.owner left join engagement g on g.canonical=p.owner
 where u.canonical is not null or g.canonical is not null
), ranked as (select *,dense_rank() over(order by score desc) rank from scores)
select coalesce(jsonb_agg(to_jsonb(r) order by score desc,uploads desc,display_name,owner),'[]'::jsonb) from ranked r
$$;
grant execute on function public.vault_contributors(date,uuid,text) to anon, authenticated, service_role;

drop function public.vault_contributor_gallery(text, integer);
drop function public.vault_contributor_gallery_filtered(text, integer, uuid);
create function public.vault_contributor_gallery_filtered(p_owner text, p_offset integer default 0, p_event uuid default null, p_house text default 'amistad')
returns jsonb language sql stable security definer set search_path to '' as $$
with target as (
 select coalesce(m.owner,p.owner) owner
 from public.vault_profiles p left join vault_private.owner_links l on l.owner=p.owner
 left join vault_private.members m on m.user_id=l.user_id
 where p.owner=p_owner
 and not exists(select 1 from vault_private.bans b where b.phone_hash=m.phone_hash)
), visible as (
 select p.id,p.created_at,p.event_id from public.vault_photos p
 join public.vault_events e on e.id=p.event_id
 left join vault_private.owner_links l on l.owner=p.owner
 left join vault_private.members m on m.user_id=l.user_id
 where coalesce(m.owner,p.owner)=(select owner from target)
 and p.house=p_house and not p.hidden and p.removed_at is null and not e.hidden
 and not exists(select 1 from vault_private.bans b where b.phone_hash=m.phone_hash)
), filtered as (select * from visible where p_event is null or event_id=p_event), page as (
 select id,created_at from filtered order by created_at desc,id limit 60 offset greatest(coalesce(p_offset,0),0)
)
select jsonb_build_object('owner',t.owner,'name',p.display_name,'total',(select count(*) from filtered), 'events',(select coalesce(jsonb_agg(distinct event_id),'[]'::jsonb) from visible),
 'ids',coalesce((select jsonb_agg(id order by created_at desc,id) from page),'[]'::jsonb))
from target t join public.vault_profiles p on p.owner=t.owner
$$;
create function public.vault_contributor_gallery(p_owner text, p_offset integer default 0, p_house text default 'amistad')
returns jsonb language sql stable security definer set search_path to '' as $$
 select public.vault_contributor_gallery_filtered(p_owner,p_offset,null,p_house)
$$;

grant execute on function public.vault_contributor_gallery(text,integer,text) to anon, authenticated, service_role;
grant execute on function public.vault_contributor_gallery_filtered(text,integer,uuid,text) to anon, authenticated, service_role;

drop function public.vault_my_dashboard();
create function public.vault_my_dashboard(p_house text default 'amistad')
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare result jsonb; ranking jsonb; own_row jsonb; leader bigint; o text;
begin
 if auth.uid() is null then raise exception 'Sign in to see your dashboard'; end if;
 select owner into o from vault_private.members where user_id=auth.uid();
 ranking:=public.vault_contributors(null,null,p_house);
 select r into own_row from jsonb_array_elements(ranking) r where r->>'owner'=o;
 select coalesce(max((r->>'score')::bigint),0) into leader from jsonb_array_elements(ranking) r;
 with mine as (select p.* from public.vault_photos p join public.vault_events e on e.id=p.event_id where vault_private.owns(p.owner) and p.house=p_house and not p.hidden and p.removed_at is null and not e.hidden)
 select jsonb_build_object(
 'uploads',(select count(*) from mine),'events',(select count(distinct event_id) from mine),
 'likes_received',(select count(*) from public.vault_likes l join mine p on p.id=l.photo_id where not vault_private.owns(l.owner)),
 'comments_received',(select count(*) from public.vault_comments c join mine p on p.id=c.photo_id where not c.hidden and not vault_private.owns(c.owner)),
 'views',(select count(*) from vault_private.photo_views v join mine p on p.id=v.photo_id),
 'tracking_since',(select started_at from vault_private.view_tracking),
 'rank',own_row->'rank','score',coalesce((own_row->>'score')::bigint,0),'leader_score',leader,
 'points_to_lead',case when coalesce((own_row->>'score')::bigint,0)>0 and (own_row->>'score')::bigint=leader then 0 else greatest(leader-coalesce((own_row->>'score')::bigint,0)+1,1) end
 ) into result;
 return result;
end $$;
revoke all on function public.vault_my_dashboard(text) from public, anon;
grant execute on function public.vault_my_dashboard(text) to authenticated, service_role;

drop function public.vault_review_reports(text);
create function public.vault_review_reports(p_pass text, p_house text default 'amistad')
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
 if not public.vault_moderation_ok(p_house,p_pass) then raise exception 'Wrong passcode'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'photo',to_jsonb(p),'event',e.title,'reason',r.reason,'note',r.note,'status',r.status,'created_at',r.created_at,'can_ban',l.user_id is not null,'banned',b.phone_hash is not null) order by r.created_at desc)
 from vault_private.reports r join public.vault_photos p on p.id=r.photo_id join public.vault_events e on e.id=p.event_id
 left join vault_private.owner_links l on l.owner=p.owner left join vault_private.members m on m.user_id=l.user_id left join vault_private.bans b on b.phone_hash=m.phone_hash
 where p.house=p_house and (r.status='open' or p.cleanup_pending)),'[]'::jsonb);
end $$;
grant execute on function public.vault_review_reports(text,text) to anon, authenticated, service_role;

drop function public.vault_resolve_report(text, uuid);
create function public.vault_resolve_report(p_pass text, p_id uuid, p_house text default 'amistad')
returns void language plpgsql security definer set search_path to '' as $$
begin
 if not public.vault_moderation_ok(p_house,p_pass) then raise exception 'Wrong passcode'; end if;
 update vault_private.reports r set status='dismissed',resolved_at=now() from public.vault_photos p where r.id=p_id and p.id=r.photo_id and p.house=p_house;
end $$;
grant execute on function public.vault_resolve_report(text,uuid,text) to anon, authenticated, service_role;

-- Bans are per phone and apply in every vault, so any house's moderators can
-- see and lift them.
drop function public.vault_banned_members(text);
create function public.vault_banned_members(p_pass text, p_house text default 'amistad')
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
 if not public.vault_moderation_ok(p_house,p_pass) then raise exception 'Wrong passcode'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'name',p.display_name,'last_four',right(u.phone,4),'reason',b.reason)) from vault_private.bans b join vault_private.members m on m.phone_hash=b.phone_hash join auth.users u on u.id=m.user_id left join public.vault_profiles p on p.owner=m.owner),'[]'::jsonb);
end $$;
grant execute on function public.vault_banned_members(text,text) to anon, authenticated, service_role;

drop function public.vault_unban_member(text, uuid);
create function public.vault_unban_member(p_pass text, p_user uuid, p_house text default 'amistad')
returns void language plpgsql security definer set search_path to '' as $$
begin
 if not public.vault_moderation_ok(p_house,p_pass) then raise exception 'Wrong passcode'; end if;
 delete from vault_private.bans where phone_hash in(select phone_hash from vault_private.members where user_id=p_user);
end $$;
grant execute on function public.vault_unban_member(text,uuid,text) to anon, authenticated, service_role;

-- ------------------------------------------------------------ leaderboard and most loved
-- Visible means: not hidden, not removed, in an event that is not hidden.
create or replace function public.vault_house_board(p_house text, p_event uuid default null)
returns jsonb language sql stable security definer set search_path to '' as $$
 with houses(rca_house, ord) as (values ('amistad',1),('altruismo',2),('isibindi',3),('reveur',4)),
 counts as (
  select p.rca_house, count(*) photos, count(distinct p.owner) families
  from public.vault_photos p join public.vault_events e on e.id=p.event_id
  where p.house=p_house and not p.hidden and p.removed_at is null and not e.hidden
  and (p_event is null or p.event_id=p_event) and p.rca_house is not null
  group by p.rca_house
 )
 select coalesce(jsonb_agg(jsonb_build_object('house',h.rca_house,'photos',coalesce(c.photos,0),'families',coalesce(c.families,0))
   order by coalesce(c.photos,0) desc, h.ord),'[]'::jsonb)
 from houses h left join counts c using (rca_house)
$$;
grant execute on function public.vault_house_board(text,uuid) to anon, authenticated, service_role;

-- Ranked by likes. Ties go to the photo that reached its count first, which
-- is the one people found first, then to the earlier upload.
create or replace function public.vault_top_photos(p_house text, p_limit integer default 60, p_event uuid default null)
returns table(photo_id uuid, likes integer) language sql stable security definer set search_path to '' as $$
 select p.id, count(l.*)::integer likes
 from public.vault_photos p join public.vault_events e on e.id=p.event_id
 join public.vault_likes l on l.photo_id=p.id
 where p.house=p_house and not p.hidden and p.removed_at is null and not e.hidden
 and (p_event is null or p.event_id=p_event)
 group by p.id, p.created_at
 order by count(l.*) desc, max(l.created_at) asc, p.created_at asc
 limit least(greatest(coalesce(p_limit,60),1),200)
$$;
grant execute on function public.vault_top_photos(text,integer,uuid) to anon, authenticated, service_role;

-- ------------------------------------------------------------ the RCAP vault
insert into public.vault_settings(house, admin_pass) values ('rcap', 'rcap2026') on conflict (house) do nothing;

insert into public.vault_events(house, slug, title, blurb, kind, category, starts_on, ends_on, ongoing, open, featured, hidden) values
 ('rcap','everyday-rca','Everyday RCA','Not an event, but it belongs here. Carline, the hallway, a Tuesday.','everyday','everyday','2026-08-26','2027-05-28',true,true,false,false),
 ('rcap','bingo-night','Bingo Night','RCAP Bingo Night at RCA. Every card, every house, every win.','school',null,'2026-09-15',null,false,true,true,false)
on conflict (house, slug) do nothing;

insert into public.vault_requests(house, event_id, message, goal, due_on, open)
select 'rcap', e.id, 'Bingo Night is on your camera roll. Add it before Tuesday.', 150, '2026-09-22', true
from public.vault_events e where e.house='rcap' and e.slug='bingo-night'
and not exists(select 1 from public.vault_requests r where r.event_id=e.id);
