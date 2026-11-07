-- Temporary administrator-only album access, independent of shared passcodes.
alter table public.vault_events add column admin_only boolean not null default false;

-- Preserve row identity, media keys, ownership and all attached interactions.
do $$
declare source_id uuid; destination_id uuid; moved integer;
begin
 select id into strict source_id from public.vault_events where house='amistad' and slug='afterhours';
 insert into public.vault_events(house,slug,title,blurb,kind,starts_on,open,hidden,admin_only)
 values('amistad','ami-halloween-party','AMI Halloween Party','October 30, 2026.','house','2026-10-30',false,true,true)
 returning id into destination_id;
 update public.vault_photos set event_id=destination_id
 where event_id=source_id and created_at >= timestamptz '2026-10-30 00:00:00 America/New_York'
 and created_at < timestamptz '2026-11-07 00:00:00 America/New_York';
 get diagnostics moved=row_count;
 if moved<>54 then raise exception 'Expected 54 Halloween uploads, found %; review before moving',moved; end if;
 update public.vault_events set admin_only=true,hidden=true,open=false where id=source_id;
 -- Existing upload slots cannot bypass the restrictive write trigger below.
end $$;


create function vault_private.album_access(p_event uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.vault_events where id=p_event and admin_only)
 or coalesce(public.vault_staff_role() in ('owner','admin'),false)
$$;
revoke all on function vault_private.album_access(uuid) from public;
grant execute on function vault_private.album_access(uuid) to anon,authenticated;

create policy vault_events_admin_only on public.vault_events as restrictive for select
 using (not admin_only or coalesce(public.vault_staff_role() in ('owner','admin'),false));
create policy vault_events_locked_staff on public.vault_events for select to authenticated
 using (admin_only and coalesce(public.vault_staff_role() in ('owner','admin'),false));
create policy vault_photos_admin_only on public.vault_photos as restrictive for select
 using (vault_private.album_access(event_id));

-- Captions/comments, reactions and upload requests follow the same boundary.
create function vault_private.photo_album_access(p_photo uuid) returns boolean
 language sql stable security definer set search_path='' as $$
 select coalesce((select vault_private.album_access(event_id) from public.vault_photos where id=p_photo),false)
$$;
revoke all on function vault_private.photo_album_access(uuid) from public;
grant execute on function vault_private.photo_album_access(uuid) to anon,authenticated;
create policy vault_comments_admin_only on public.vault_comments as restrictive for select
 using (vault_private.photo_album_access(photo_id));
create policy vault_likes_admin_only on public.vault_likes as restrictive for select
 using (vault_private.photo_album_access(photo_id));
create policy vault_requests_admin_only on public.vault_requests as restrictive for select
 using (vault_private.album_access(event_id));

create or replace function public.vault_my_uploads() returns setof public.vault_photos
 language sql stable security definer set search_path='' as $$
 select * from public.vault_photos where vault_private.owns(owner)
 and vault_private.album_access(event_id) order by created_at desc
$$;

-- Report review is the other existing reader that deliberately includes hidden
-- albums. Preserve its existing permission check and filter only locked albums.
do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.vault_review_reports(text,text)'::regprocedure);
 if position('where p.house=p_house and' in definition)=0 then raise exception 'Review function changed; inspect before patching'; end if;
 definition:=replace(definition,'where p.house=p_house and','where vault_private.album_access(p.event_id) and p.house=p_house and');
 execute definition;
end $$;

create function vault_private.guard_admin_only_photo() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if not vault_private.album_access(new.event_id)
 or (tg_op='UPDATE' and not vault_private.album_access(old.event_id)) then
  raise exception 'This gallery is restricted to signed-in administrators' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function vault_private.guard_admin_only_photo() from public,anon,authenticated;
create trigger vault_admin_only_photo before insert or update on public.vault_photos
 for each row execute function vault_private.guard_admin_only_photo();

create function vault_private.guard_admin_only_event() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if old.admin_only or new.admin_only then
  if not coalesce(public.vault_staff_role() in ('owner','admin'),false) then
   raise exception 'Signed-in administrator required' using errcode='42501';
  end if;
  -- This temporary restriction cannot be undone with existing public controls.
  new.admin_only:=true; new.hidden:=true; new.open:=false;
 end if;
 return new;
end $$;
revoke all on function vault_private.guard_admin_only_event() from public,anon,authenticated;
create trigger vault_admin_only_event before update on public.vault_events
 for each row execute function vault_private.guard_admin_only_event();
