-- Count detail opens, not thumbnail impressions. No IPs or phone numbers stored.
create table vault_private.view_tracking(id boolean primary key default true check(id),started_at timestamptz not null default now());
insert into vault_private.view_tracking(id) values(true);
alter table vault_private.view_tracking enable row level security;
create table vault_private.photo_views(photo_id uuid not null references public.vault_photos(id),session_hash text not null,created_at timestamptz not null default now(),primary key(photo_id,session_hash));
alter table vault_private.photo_views enable row level security;
create index vault_views_session_time on vault_private.photo_views(session_hash,created_at);
create function public.vault_record_view(p_photo uuid,p_session text,p_legacy text default '') returns boolean language plpgsql security definer set search_path='' as $$
declare s text;
begin
 if p_session is null or p_session !~ '^[a-f0-9]{48}$' then return false; end if;
 if not exists(select 1 from public.vault_photos p join public.vault_events e on e.id=p.event_id where p.id=p_photo and p.house='amistad' and not p.hidden and p.removed_at is null and not e.hidden and not vault_private.owns(p.owner) and (p_legacy='' or p.owner<>public.vault_hash(p_legacy))) then return false; end if;
 if auth.uid() is not null and vault_private.active_owner() is null then return false; end if;
 s:=public.vault_hash(p_session);
 perform pg_advisory_xact_lock(hashtextextended(s,29));
 if (select count(*) from vault_private.photo_views where session_hash=s and created_at>now()-interval '1 hour')>=300 then return false; end if;
 insert into vault_private.photo_views(photo_id,session_hash) values(p_photo,s) on conflict do nothing;
 return found;
end $$;
revoke all on function public.vault_record_view(uuid,text,text) from public;
grant execute on function public.vault_record_view(uuid,text,text) to anon,authenticated;

create function public.vault_my_activity(p_kind text default 'likes',p_offset integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in to see your activity'; end if;
 if p_kind not in('likes','comments') or p_offset<0 then raise exception 'Invalid activity request'; end if;
 with activity as (
 select l.photo_id,l.created_at,null::text body,l.photo_id::text id from public.vault_likes l where p_kind='likes' and vault_private.owns(l.owner)
 union all
 select c.photo_id,c.created_at,c.body,c.id::text from public.vault_comments c where p_kind='comments' and not c.hidden and vault_private.owns(c.owner)
 ), visible as (
 select a.id,a.created_at,a.body,p.id photo_id,p.storage,p.thumb_key,p.web_key,p.key,p.content_type,p.uploader_name,p.caption,e.title,e.slug
 from activity a join public.vault_photos p on p.id=a.photo_id join public.vault_events e on e.id=p.event_id
 where not p.hidden and p.removed_at is null and not e.hidden
 ), page as (select * from visible order by created_at desc,id offset p_offset limit 20)
 select jsonb_build_object('total',(select count(*) from visible),'items',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id) from page),'[]'::jsonb)) into result;
 return result;
end $$;
create function public.vault_my_dashboard() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; ranking jsonb; own_row jsonb; leader bigint; o text;
begin
 if auth.uid() is null then raise exception 'Sign in to see your dashboard'; end if;
 select owner into o from vault_private.members where user_id=auth.uid();
 ranking:=public.vault_contributors();
 select r into own_row from jsonb_array_elements(ranking) r where r->>'owner'=o;
 select coalesce(max((r->>'score')::bigint),0) into leader from jsonb_array_elements(ranking) r;
 with mine as (select p.* from public.vault_photos p join public.vault_events e on e.id=p.event_id where vault_private.owns(p.owner) and not p.hidden and p.removed_at is null and not e.hidden)
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
revoke all on function public.vault_my_activity(text,integer),public.vault_my_dashboard() from public;
grant execute on function public.vault_my_activity(text,integer),public.vault_my_dashboard() to authenticated;
