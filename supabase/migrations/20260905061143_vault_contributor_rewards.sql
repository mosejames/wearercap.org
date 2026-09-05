-- Rankings expose public names and counts only, merging reclaimed legacy owners.
alter table public.vault_profiles add column avatar_key text;
create function public.vault_contributors(p_month date default null,p_event uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
with identities as (
 select p.owner,coalesce(m.owner,p.owner) canonical
 from public.vault_profiles p left join vault_private.owner_links l on l.owner=p.owner
 left join vault_private.members m on m.user_id=l.user_id
 where p.house='amistad' and not exists(select 1 from vault_private.bans b where b.phone_hash=m.phone_hash)
), visible as (
 select p.*,i.canonical from public.vault_photos p join identities i on i.owner=p.owner
 join public.vault_events e on e.id=p.event_id
 where not p.hidden and p.removed_at is null and not e.hidden and p.house='amistad'
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
 select p.owner,p.display_name,p.avatar_key,coalesce(u.uploads,0) uploads,coalesce(u.photos,0) photos,coalesce(u.events,0) events,
 coalesce(g.interactions,0) interactions,coalesce(u.uploads,0)*5+coalesce(u.events,0)*10+least(coalesce(g.points,0),100) score
 from public.vault_profiles p left join uploads u on u.canonical=p.owner left join engagement g on g.canonical=p.owner
 where u.canonical is not null or g.canonical is not null
), ranked as (select *,dense_rank() over(order by score desc) rank from scores)
select coalesce(jsonb_agg(to_jsonb(r) order by score desc,uploads desc,display_name,owner),'[]'::jsonb) from ranked r
$$;
revoke all on function public.vault_contributors(date,uuid) from public;
grant execute on function public.vault_contributors(date,uuid) to anon,authenticated;

-- A single small JPEG per member. Replacing it cannot accumulate orphan files.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('vault-avatars','vault-avatars',true,524288,array['image/jpeg']);
create policy vault_avatar_read on storage.objects for select to anon,authenticated using(bucket_id='vault-avatars');
create policy vault_avatar_insert on storage.objects for insert to authenticated with check(bucket_id='vault-avatars' and name=vault_private.active_owner()||'/profile.jpg');
create policy vault_avatar_update on storage.objects for update to authenticated using(bucket_id='vault-avatars' and name=vault_private.active_owner()||'/profile.jpg') with check(bucket_id='vault-avatars' and name=vault_private.active_owner()||'/profile.jpg');
create policy vault_avatar_delete on storage.objects for delete to authenticated using(bucket_id='vault-avatars' and vault_private.owns(split_part(name,'/',1)));
create function public.vault_avatar(p_remove boolean default false) returns text language plpgsql security definer set search_path='' as $$
declare o text:=vault_private.active_owner(); k text;
begin
 if o is null then raise exception 'Sign in to update your photo'; end if;
 k:=o||'/profile.jpg';
 if not p_remove and not exists(select 1 from storage.objects where bucket_id='vault-avatars' and name=k) then raise exception 'Upload your profile photo first'; end if;
 update public.vault_profiles set avatar_key=case when p_remove then null else k end,updated_at=now() where owner=o;
 return case when p_remove then null else k end;
end $$;
create function public.vault_avatars() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(i.owner,p.avatar_key),'{}'::jsonb)
 from (select owner,owner canonical from public.vault_profiles union select l.owner,m.owner from vault_private.owner_links l join vault_private.members m using(user_id)) i
 join public.vault_profiles p on p.owner=i.canonical where p.avatar_key is not null
 and not exists(select 1 from vault_private.members m join vault_private.bans b using(phone_hash) where m.owner=p.owner)
$$;
revoke all on function public.vault_avatar(boolean),public.vault_avatars() from public;
grant execute on function public.vault_avatar(boolean) to authenticated;
grant execute on function public.vault_avatars() to anon,authenticated;

create table vault_private.badges(user_id uuid references auth.users(id),milestone integer check(milestone in(10,50,100,250,500)),earned_at timestamptz not null default now(),primary key(user_id,milestone));
alter table vault_private.badges enable row level security;
create function public.vault_claim_badges() returns jsonb language plpgsql security definer set search_path='' as $$
declare n bigint; result jsonb;
begin
 if vault_private.active_owner() is null then raise exception 'Sign in to collect badges'; end if;
 select count(*) into n from public.vault_photos p join public.vault_events e on e.id=p.event_id
 where vault_private.owns(p.owner) and not p.hidden and p.removed_at is null and not e.hidden and p.content_type like 'image/%';
 with earned as(insert into vault_private.badges(user_id,milestone) select auth.uid(),v from unnest(array[10,50,100,250,500]) v where v<=n on conflict do nothing returning milestone)
 select coalesce(jsonb_agg(milestone order by milestone),'[]'::jsonb) into result from earned;
 return result;
end $$;
create function public.vault_my_rewards() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('photos',(select count(*) from public.vault_photos p join public.vault_events e on e.id=p.event_id where vault_private.owns(p.owner) and not p.hidden and p.removed_at is null and not e.hidden and p.content_type like 'image/%'),
 'badges',(select coalesce(jsonb_agg(milestone order by milestone),'[]'::jsonb) from vault_private.badges where user_id=auth.uid()))
$$;
revoke all on function public.vault_claim_badges(),public.vault_my_rewards() from public;
grant execute on function public.vault_claim_badges(),public.vault_my_rewards() to authenticated;
