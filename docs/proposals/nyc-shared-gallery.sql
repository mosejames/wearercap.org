-- REVIEW DRAFT ONLY. Do not apply until the owner approves database activation.
-- Additive NYC-only storage metadata. No London/M3 objects are modified.
begin;
create schema if not exists trip_private;
revoke all on schema trip_private from public;
grant usage on schema trip_private to anon, authenticated;
create table trip_private.photos (
 id uuid primary key, vault text not null check(vault='nyc-2026'),
 album text not null check(album in ('send-off','the-whole-adventure')),
 owner uuid not null references auth.users(id), display_name text not null check(length(display_name) between 1 and 60),
 scholar_name text not null default '' check(length(scholar_name)<=40),
 source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 ext text not null check(ext in ('jpg','png','webp','heic','heif')),
 width integer not null check(width between 1 and 50000), height integer not null check(height between 1 and 50000),
 bytes bigint not null check(bytes between 1 and 52428800),
 taken_at timestamptz, created_at timestamptz not null default now(), hidden boolean not null default false,
 unique(vault,source_hash)
);
alter table trip_private.photos enable row level security;
revoke all on trip_private.photos from public,anon,authenticated;
create index trip_photos_visible on trip_private.photos(vault,created_at desc) where not hidden;
create table trip_private.upload_requests (
 owner uuid not null references auth.users(id), minute timestamptz not null, count integer not null,
 primary key(owner,minute)
);
alter table trip_private.upload_requests enable row level security;
revoke all on trip_private.upload_requests from public,anon,authenticated;

create function trip_private.gallery(p_vault text,p_album text default null,p_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(v.item order by v.moment desc,v.created desc),'[]'::jsonb) from (
 select jsonb_build_object('id',p.id,'vault',p.vault,'album',p.album,'contributor',p.display_name,'scholar',p.scholar_name,
 'takenAt',p.taken_at,'createdAt',p.created_at,'isMine',coalesce(p.owner=auth.uid(),false),
 'key',p.vault||'/'||left(replace(p.owner::text,'-',''),8)||'/'||p.album||'/'||p.id||'/orig.'||p.ext,
 'webKey',p.vault||'/'||left(replace(p.owner::text,'-',''),8)||'/'||p.album||'/'||p.id||'/web.jpg',
 'thumbKey',p.vault||'/'||left(replace(p.owner::text,'-',''),8)||'/'||p.album||'/'||p.id||'/thumb.jpg') item,
 coalesce(p.taken_at,p.created_at) moment,p.created_at created
 from trip_private.photos p where p_vault='nyc-2026' and p.vault=p_vault and not p.hidden
 and (p_album is null or p.album=p_album) and (p_id is null or p.id=p_id)
 order by coalesce(p.taken_at,p.created_at) desc,p.created_at desc limit 5000) v;
$$;
create function trip_private.upload_allowed(p_vault text,p_album text,p_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); n integer; found_photo uuid;
begin
 if u is null or not exists(select 1 from auth.users where id=u and (phone_confirmed_at is not null or email_confirmed_at is not null)) then raise exception 'Please sign in with a text code'; end if;
 if p_vault is distinct from 'nyc-2026' or p_album is null or p_album not in ('send-off','the-whole-adventure') or p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid NYC album'; end if;
 insert into trip_private.upload_requests(owner,minute,count) values(u,date_trunc('minute',now()),1)
 on conflict(owner,minute) do update set count=trip_private.upload_requests.count+1 returning count into n;
 if n>70 then return jsonb_build_object('allowed',false,'error','Please wait a minute before trying again.'); end if;
 select id into found_photo from trip_private.photos where vault=p_vault and source_hash=p_hash;
 return jsonb_build_object('allowed',true,'duplicate',found_photo is not null);
end $$;
create function trip_private.add_photo(p_id uuid,p_vault text,p_album text,p_hash text,p_ext text,p_name text,p_scholar text,p_width integer,p_height integer,p_bytes bigint,p_taken timestamptz default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); n integer;
begin
 if u is null or not exists(select 1 from auth.users where id=u and (phone_confirmed_at is not null or email_confirmed_at is not null)) then raise exception 'Please sign in first'; end if;
 if p_vault is distinct from 'nyc-2026' or p_album is null or p_album not in ('send-off','the-whole-adventure') then raise exception 'Invalid NYC album'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select count(*) into n from trip_private.photos where owner=u and created_at>now()-interval '1 hour';
 if n>=240 then raise exception 'Thank you for sharing. Please try the next batch later.'; end if;
 if not exists(select 1 from trip_private.upload_requests where owner=u and minute>=date_trunc('minute',now()-interval '15 minutes')) then raise exception 'Please prepare this upload again'; end if;
 insert into trip_private.photos(id,vault,album,owner,display_name,scholar_name,source_hash,ext,width,height,bytes,taken_at)
 values(p_id,p_vault,p_album,u,btrim(p_name),coalesce(btrim(p_scholar),''),p_hash,p_ext,p_width,p_height,p_bytes,p_taken)
 on conflict(vault,source_hash) do nothing;
 return found;
end $$;
create function trip_private.hide_photo(p_vault text,p_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Please sign in first'; end if;
 update trip_private.photos set hidden=true where vault='nyc-2026' and vault=p_vault and id=p_id and owner=auth.uid();
 if not found then raise exception 'This photo does not belong to your account'; end if;
 return true;
end $$;
-- Public invoker wrappers expose only the narrowly scoped operations above.
create function public.trip_gallery(p_vault text,p_album text default null,p_id uuid default null) returns jsonb language sql security invoker set search_path='' as $$select trip_private.gallery(p_vault,p_album,p_id)$$;
create function public.trip_upload_allowed(p_vault text,p_album text,p_hash text) returns jsonb language sql security invoker set search_path='' as $$select trip_private.upload_allowed(p_vault,p_album,p_hash)$$;
create function public.trip_add_photo(p_id uuid,p_vault text,p_album text,p_hash text,p_ext text,p_name text,p_scholar text,p_width integer,p_height integer,p_bytes bigint,p_taken timestamptz default null) returns boolean language sql security invoker set search_path='' as $$select trip_private.add_photo(p_id,p_vault,p_album,p_hash,p_ext,p_name,p_scholar,p_width,p_height,p_bytes,p_taken)$$;
create function public.trip_hide_photo(p_vault text,p_id uuid) returns boolean language sql security invoker set search_path='' as $$select trip_private.hide_photo(p_vault,p_id)$$;
revoke all on all functions in schema trip_private from public,anon,authenticated;
revoke all on function public.trip_gallery(text,text,uuid),public.trip_upload_allowed(text,text,text),public.trip_add_photo(uuid,text,text,text,text,text,text,integer,integer,bigint,timestamptz),public.trip_hide_photo(text,uuid) from public,anon,authenticated;
grant execute on function trip_private.gallery(text,text,uuid),public.trip_gallery(text,text,uuid) to anon,authenticated;
grant execute on function trip_private.upload_allowed(text,text,text),public.trip_upload_allowed(text,text,text),trip_private.add_photo(uuid,text,text,text,text,text,text,integer,integer,bigint,timestamptz),public.trip_add_photo(uuid,text,text,text,text,text,text,integer,integer,bigint,timestamptz),trip_private.hide_photo(text,uuid),public.trip_hide_photo(text,uuid) to authenticated;
commit;
