-- Verified contributors, community reports, and immediate account bans.
-- Viewing stays public. Publishing has no approval queue.
create schema if not exists vault_private;
revoke all on schema vault_private from public;
grant usage on schema vault_private to anon, authenticated;
create table vault_private.members (
 user_id uuid primary key references auth.users(id), owner text unique not null,
 phone_hash text not null, created_at timestamptz not null default now()
);
create table vault_private.owner_links (
 owner text primary key, user_id uuid not null references auth.users(id)
);
create table vault_private.bans (
 phone_hash text primary key, reason text not null default '', created_at timestamptz not null default now()
);
alter table vault_private.members enable row level security;
alter table vault_private.owner_links enable row level security;
alter table vault_private.bans enable row level security;
alter table public.vault_photos add column removed_at timestamptz;
create table vault_private.reports (
 id uuid primary key default gen_random_uuid(), photo_id uuid not null references public.vault_photos(id),
 reporter uuid not null references auth.users(id), reason text not null check(reason in ('inappropriate','privacy','spam','other')),
 note text not null default '' check(length(note)<=500), status text not null default 'open' check(status in ('open','dismissed','removed')),
 created_at timestamptz not null default now(), resolved_at timestamptz, unique(photo_id,reporter)
);
alter table vault_private.reports enable row level security;
create index on vault_private.reports(status,created_at);
create index on vault_private.owner_links(user_id);

create function vault_private.owns(o text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from vault_private.owner_links l where l.user_id=auth.uid() and l.owner=o)
$$;
create function vault_private.active_owner() returns text language sql stable security definer set search_path='' as $$
 select m.owner from vault_private.members m join auth.users u on u.id=m.user_id
 where m.user_id=auth.uid() and u.phone_confirmed_at is not null and nullif(u.phone,'') is not null
 and m.phone_hash=public.vault_hash(u.phone)
 and not exists(select 1 from vault_private.bans b where b.phone_hash=m.phone_hash)
$$;
create function public.vault_actor() returns text language sql stable security invoker set search_path='' as $$
 select vault_private.active_owner()
$$;
create function public.vault_join(p_token text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare u auth.users; o text; legacy text; linked uuid;
begin
 select * into u from auth.users where id=auth.uid();
 if u.id is null or u.phone_confirmed_at is null or nullif(u.phone,'') is null then raise exception 'Verify your mobile number first'; end if;
 o:=public.vault_hash(u.id::text);
 insert into vault_private.members(user_id,owner,phone_hash) values(u.id,o,public.vault_hash(u.phone))
 on conflict(user_id) do update set phone_hash=excluded.phone_hash;
 insert into vault_private.owner_links(owner,user_id) values(o,u.id) on conflict do nothing;
 -- Possession of the old secret lets a family recover this browser's earlier uploads.
 if length(coalesce(p_token,''))>=16 then
  legacy:=public.vault_hash(p_token);
  if exists(select 1 from public.vault_profiles where owner=legacy) or exists(select 1 from public.vault_photos where owner=legacy) then
   insert into vault_private.owner_links(owner,user_id) values(legacy,u.id) on conflict do nothing;
   select user_id into linked from vault_private.owner_links where owner=legacy;
   if linked=u.id then
    insert into public.vault_profiles(owner,display_name,student)
     select o,display_name,student from public.vault_profiles where owner=legacy on conflict do nothing;
   end if;
  end if;
 end if;
 return jsonb_build_object('owner',o,'owners',(select jsonb_agg(owner) from vault_private.owner_links where user_id=u.id));
end $$;

create or replace function public.vault_save_profile(p_token text,p_name text,p_student text default '',p_phone text default '')
returns public.vault_people language plpgsql security definer set search_path='' as $$
declare o text:=vault_private.active_owner(); r public.vault_people;
begin
 if o is null then raise exception 'Verify your mobile number to continue'; end if;
 insert into public.vault_profiles(owner,display_name,student,phone) values(o,btrim(p_name),coalesce(btrim(p_student),''),'')
 on conflict(owner) do update set display_name=excluded.display_name,student=excluded.student,updated_at=now();
 select * into r from public.vault_people where owner=o; return r;
end $$;
-- Do not store verified sign-in numbers in the legacy marketing/contact list.

create or replace function public.vault_set_photo(p_id uuid,p_token text,p_pass text,p_hidden boolean default null,p_caption text default null)
returns void language plpgsql security definer set search_path='' as $$
declare p public.vault_photos; a boolean;
begin
 select * into p from public.vault_photos where id=p_id; a:=public.vault_pass_ok('amistad',p_pass);
 if p.id is null or not(a or vault_private.owns(p.owner)) then raise exception 'You cannot change this upload'; end if;
 if p.removed_at is not null then raise exception 'This upload was removed'; end if;
 if not a and vault_private.active_owner() is null and p_hidden is distinct from true then raise exception 'This account cannot publish'; end if;
 update public.vault_photos set hidden=coalesce(p_hidden,hidden),caption=coalesce(left(p_caption,280),caption) where id=p_id;
end $$;
create or replace function public.vault_unlike(p_photo uuid,p_token text) returns void language sql security definer set search_path='' as $$
 delete from public.vault_likes where photo_id=p_photo and vault_private.owns(owner)
$$;
create or replace function public.vault_hide_comment(p_id uuid,p_token text,p_pass text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.vault_comments where id=p_id and (vault_private.owns(owner) or public.vault_pass_ok('amistad',p_pass))) then raise exception 'You cannot remove this comment'; end if;
 update public.vault_comments set hidden=true where id=p_id;
end $$;

-- Close the old anonymous write paths; ownership and bans are checked on every write.
drop policy vault_photos_read on public.vault_photos;
create policy vault_photos_read on public.vault_photos for select using(not hidden and removed_at is null);
drop policy vault_photos_insert on public.vault_photos;
create policy vault_photos_insert on public.vault_photos for insert to authenticated with check (
 owner=vault_private.active_owner() and house='amistad' and not hidden and removed_at is null
 and key like ('amistad/2026-27/'||auth.uid()::text||'/%')
 and web_key=regexp_replace(key,'/orig\.[^/]+$','/web.jpg') and thumb_key=regexp_replace(key,'/orig\.[^/]+$','/thumb.jpg')
 and key ~ '/[0-9a-f-]{36}/orig\.(jpg|jpeg|png|webp|heic|heif|gif|mp4|mov|webm)$'
 and exists(select 1 from public.vault_events e where e.id=event_id and e.open and not e.hidden)
);
drop policy vault_likes_insert on public.vault_likes;
create policy vault_likes_insert on public.vault_likes for insert to authenticated with check(owner=vault_private.active_owner() and exists(select 1 from public.vault_photos p where p.id=photo_id));
drop policy vault_comments_insert on public.vault_comments;
create policy vault_comments_insert on public.vault_comments for insert to authenticated with check(owner=vault_private.active_owner() and not hidden and exists(select 1 from public.vault_photos p where p.id=photo_id));
drop policy vault_media_insert on storage.objects;
create policy vault_media_insert on storage.objects for insert to authenticated with check(bucket_id='vault-media' and vault_private.active_owner() is not null and name like ('amistad/2026-27/'||auth.uid()::text||'/%'));

create function public.vault_my_uploads() returns setof public.vault_photos language sql stable security definer set search_path='' as $$
 select * from public.vault_photos where vault_private.owns(owner) order by created_at desc
$$;
create function public.vault_report(p_photo uuid,p_reason text,p_note text default '') returns void language plpgsql security definer set search_path='' as $$
begin
 if vault_private.active_owner() is null then raise exception 'Verify your mobile number to report a concern'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,7));
 if exists(select 1 from vault_private.reports where photo_id=p_photo and reporter=auth.uid()) then return; end if;
 if (select count(*) from vault_private.reports where reporter=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'Please wait before sending more reports'; end if;
 if not exists(select 1 from public.vault_photos where id=p_photo and not hidden and removed_at is null) then raise exception 'This upload is no longer available'; end if;
 insert into vault_private.reports(photo_id,reporter,reason,note) values(p_photo,auth.uid(),p_reason,btrim(coalesce(p_note,'')));
end $$;
create function public.vault_review_reports(p_pass text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.vault_pass_ok('amistad',p_pass) then raise exception 'Wrong passcode'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'photo',to_jsonb(p),'event',e.title,'reason',r.reason,'note',r.note,'status',r.status,'created_at',r.created_at,'can_ban',l.user_id is not null,'banned',b.phone_hash is not null) order by r.created_at desc)
 from vault_private.reports r join public.vault_photos p on p.id=r.photo_id join public.vault_events e on e.id=p.event_id
 left join vault_private.owner_links l on l.owner=p.owner left join vault_private.members m on m.user_id=l.user_id left join vault_private.bans b on b.phone_hash=m.phone_hash
 where r.status='open'),'[]'::jsonb);
end $$;
create function public.vault_resolve_report(p_pass text,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.vault_pass_ok('amistad',p_pass) then raise exception 'Wrong passcode'; end if;
 update vault_private.reports set status='dismissed',resolved_at=now() where id=p_id;
end $$;
create function public.vault_ban_uploader(p_pass text,p_photo uuid,p_reason text default '',p_hide_all boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare m vault_private.members;
begin
 if not public.vault_pass_ok('amistad',p_pass) then raise exception 'Wrong passcode'; end if;
 select a.* into m from vault_private.members a join vault_private.owner_links l on l.user_id=a.user_id join public.vault_photos p on p.owner=l.owner where p.id=p_photo;
 if m.user_id is null then raise exception 'This older upload is not linked to a verified number yet. You can still remove it.'; end if;
 insert into vault_private.bans(phone_hash,reason) values(m.phone_hash,left(p_reason,500)) on conflict(phone_hash) do update set reason=excluded.reason;
 if p_hide_all then
  update public.vault_photos set hidden=true where owner in(select owner from vault_private.owner_links where user_id=m.user_id);
  update public.vault_comments set hidden=true where owner in(select owner from vault_private.owner_links where user_id=m.user_id);
 end if;
end $$;
create function public.vault_remove_upload(p_id uuid,p_pass text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.vault_photos;
begin
 select * into p from public.vault_photos where id=p_id for update;
 if p.id is null or not(vault_private.owns(p.owner) or public.vault_pass_ok('amistad',p_pass)) then raise exception 'You cannot remove this upload'; end if;
 update public.vault_photos set hidden=true,removed_at=coalesce(removed_at,now()) where id=p_id;
 update vault_private.reports set status='removed',resolved_at=now() where photo_id=p_id;
 return jsonb_build_object('storage',p.storage,'keys',jsonb_build_array(p.key,p.web_key,p.thumb_key));
end $$;
-- A removal must first be authorized by vault_remove_upload. These exact stored
-- paths, including old uploads, can then be purged using the caller's session.
create function vault_private.can_delete_object(k text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.vault_photos p where p.removed_at is not null and k in(p.key,p.web_key,p.thumb_key)
 and (vault_private.owns(p.owner) or public.vault_pass_ok('amistad',coalesce(current_setting('request.headers',true)::jsonb->>'x-vault-admin-pass',''))))
$$;
create policy vault_media_delete on storage.objects for delete to anon,authenticated using(bucket_id='vault-media' and vault_private.can_delete_object(name));

-- Server-side posting limits apply even if clients bypass the UI.
create function vault_private.limit_posts() returns trigger language plpgsql security definer set search_path='' as $$
declare o text:=vault_private.active_owner(); n bigint;
begin
 if o is null or new.owner<>o then raise exception 'Verify your number before contributing'; end if;
 perform pg_advisory_xact_lock(hashtextextended(o,8));
 if tg_table_name='vault_photos' then
  select count(*) into n from public.vault_photos where owner=o and created_at>now()-interval '1 hour';
  if n>=200 then raise exception 'Upload limit reached. Please try again later.'; end if;
 else
  select count(*) into n from public.vault_comments where owner=o and created_at>now()-interval '1 hour';
  if n>=60 then raise exception 'Please wait before adding more comments'; end if;
 end if;
 new.created_at:=now();
 if tg_table_name='vault_photos' then
  new.uploader_name:=coalesce((select display_name from public.vault_profiles where owner=o),'Amistad family');
 else
  new.author_name:=coalesce((select display_name from public.vault_profiles where owner=o),'Amistad family');
 end if;
 return new;
end $$;
create trigger vault_photo_limit before insert on public.vault_photos for each row execute function vault_private.limit_posts();
create trigger vault_comment_limit before insert on public.vault_comments for each row execute function vault_private.limit_posts();

revoke all on all functions in schema vault_private from public;
grant execute on function vault_private.owns(text),vault_private.active_owner(),vault_private.can_delete_object(text) to anon,authenticated;
revoke all on function public.vault_join(text),public.vault_actor(),public.vault_my_uploads(),public.vault_report(uuid,text,text),public.vault_review_reports(text),public.vault_resolve_report(text,uuid),public.vault_ban_uploader(text,uuid,text,boolean),public.vault_remove_upload(uuid,text) from public;
grant execute on function public.vault_join(text),public.vault_actor(),public.vault_my_uploads(),public.vault_report(uuid,text,text) to authenticated;
grant execute on function public.vault_review_reports(text),public.vault_resolve_report(text,uuid),public.vault_ban_uploader(text,uuid,text,boolean),public.vault_remove_upload(uuid,text) to anon,authenticated;

-- Reserve fresh IDs before issuing upload URLs. Existing media cannot be overwritten
-- with a previously issued URL after its contributor has been banned.
create table vault_private.upload_slots(id uuid primary key,user_id uuid not null,event_id uuid not null,slug text not null,created_at timestamptz not null default now());
alter table vault_private.upload_slots enable row level security;
create index on vault_private.upload_slots(user_id,created_at);
create function public.vault_reserve_uploads(p_slug text,p_ids uuid[]) returns void language plpgsql security definer set search_path='' as $$
declare ev public.vault_events; n int;
begin
 if vault_private.active_owner() is null then raise exception 'This account cannot upload'; end if;
 n:=coalesce(array_length(p_ids,1),0);
 if n<1 or n>40 then raise exception 'Select between 1 and 40 files per batch'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,9));
 if (select count(*) from vault_private.upload_slots where user_id=auth.uid() and created_at>now()-interval '1 hour')+n>200 then raise exception 'Upload limit reached. Please try again later.'; end if;
 select * into ev from public.vault_events where slug=p_slug and house='amistad' and open and not hidden;
 if ev.id is null then raise exception 'This album is not accepting uploads'; end if;
 if exists(select 1 from public.vault_photos where id=any(p_ids)) then raise exception 'An upload with this ID already exists'; end if;
 insert into vault_private.upload_slots(id,user_id,event_id,slug) select unnest(p_ids),auth.uid(),ev.id,ev.slug;
end $$;
create function vault_private.has_upload_slot(p_id uuid,p_event uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from vault_private.upload_slots where id=p_id and user_id=auth.uid() and event_id=p_event and created_at>now()-interval '1 hour')
$$;
create function vault_private.storage_slot(k text) returns boolean language sql stable security definer set search_path='' as $$
 select vault_private.active_owner() is not null and exists(select 1 from vault_private.upload_slots s
 where s.user_id=auth.uid() and s.created_at>now()-interval '1 hour'
 and k like ('amistad/2026-27/'||s.user_id::text||'/'||left(regexp_replace(lower(s.slug),'[^a-z0-9-]+','-','g'),60)||'/'||s.id::text||'/%'))
$$;
create policy vault_photo_reserved on public.vault_photos as restrictive for insert to authenticated with check(vault_private.has_upload_slot(id,event_id));
drop policy vault_media_insert on storage.objects;
create policy vault_media_insert on storage.objects for insert to authenticated with check(bucket_id='vault-media' and vault_private.storage_slot(name));
revoke all on function public.vault_reserve_uploads(text,uuid[]),vault_private.has_upload_slot(uuid,uuid),vault_private.storage_slot(text) from public;
grant execute on function public.vault_reserve_uploads(text,uuid[]),vault_private.has_upload_slot(uuid,uuid),vault_private.storage_slot(text) to authenticated;
create function public.vault_banned_members(p_pass text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.vault_pass_ok('amistad',p_pass) then raise exception 'Wrong passcode'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'name',p.display_name,'last_four',right(u.phone,4),'reason',b.reason)) from vault_private.bans b join vault_private.members m on m.phone_hash=b.phone_hash join auth.users u on u.id=m.user_id left join public.vault_profiles p on p.owner=m.owner),'[]'::jsonb);
end $$;
create function public.vault_unban_member(p_pass text,p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.vault_pass_ok('amistad',p_pass) then raise exception 'Wrong passcode'; end if;
 delete from vault_private.bans where phone_hash in(select phone_hash from vault_private.members where user_id=p_user);
end $$;
revoke all on function public.vault_banned_members(text),public.vault_unban_member(text,uuid) from public;
grant execute on function public.vault_banned_members(text),public.vault_unban_member(text,uuid) to anon,authenticated;
