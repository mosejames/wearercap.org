create table vault_private.upload_moves(id bigint generated always as identity primary key,photo_id uuid not null,from_event uuid not null,to_event uuid not null,actor uuid,created_at timestamptz not null default now());
alter table vault_private.upload_moves enable row level security;
create function public.vault_move_uploads(p_photos uuid[],p_from uuid,p_to uuid,p_pass text default '') returns integer
language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not public.vault_moderation_ok('amistad',p_pass) then raise exception 'Moderator access required'; end if;
 if not exists(select 1 from public.vault_events where id=p_from and house='amistad') then raise exception 'Source gallery not found'; end if;
 if p_from=p_to or p_from is null or p_to is null then raise exception 'Choose a different gallery'; end if;
 n:=cardinality(p_photos);
 if n is null or n<1 or n>500 or n<>(select count(distinct x) from unnest(p_photos) x) then raise exception 'Select between 1 and 500 uploads'; end if;
 perform 1 from public.vault_events where id=p_to and house='amistad' and not hidden for share;
 if not found then raise exception 'That gallery is not available'; end if;
 perform 1 from public.vault_photos p join public.vault_events e on e.id=p.event_id where p.id=any(p_photos) and p.event_id=p_from and e.house='amistad' and not p.hidden and p.removed_at is null for update of p;
 if (select count(*) from public.vault_photos where id=any(p_photos) and event_id=p_from and not hidden and removed_at is null)<>n then raise exception 'Some uploads changed. Refresh the gallery and try again'; end if;
 insert into vault_private.upload_moves(photo_id,from_event,to_event,actor) select unnest(p_photos),p_from,p_to,auth.uid();
 update public.vault_photos set event_id=p_to where id=any(p_photos);
 update public.vault_events set cover_photo=null where id=p_from and cover_photo=any(p_photos);
 return n;
end $$;
revoke all on function public.vault_move_uploads(uuid[],uuid,uuid,text) from public;
grant execute on function public.vault_move_uploads(uuid[],uuid,uuid,text) to anon,authenticated;
