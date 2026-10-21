-- Optional group labels preserve all existing uploads and old client compatibility.
alter table trip_private.photos add column trip_group text check (trip_group in ('A','AA','both'));
create or replace function trip_private.gallery(p_vault text,p_album text default null,p_id uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(v.item order by v.moment desc,v.created desc),'[]'::jsonb) from (
 select jsonb_build_object('id',p.id,'vault',p.vault,'album',p.album,'group',p.trip_group,'contributor',p.display_name,'scholar',p.scholar_name,
 'takenAt',p.taken_at,'createdAt',p.created_at,'isMine',coalesce(p.owner=auth.uid(),false),
 'key',p.vault||'/'||left(replace(p.owner::text,'-',''),8)||'/'||p.album||'/'||p.id||'/orig.'||p.ext,
 'webKey',p.vault||'/'||left(replace(p.owner::text,'-',''),8)||'/'||p.album||'/'||p.id||'/web.jpg',
 'thumbKey',p.vault||'/'||left(replace(p.owner::text,'-',''),8)||'/'||p.album||'/'||p.id||'/thumb.jpg') item,
 coalesce(p.taken_at,p.created_at) moment,p.created_at created
 from trip_private.photos p where p_vault='nyc-2026' and p.vault=p_vault and not p.hidden
 and (p_album is null or p.album=p_album) and (p_id is null or p.id=p_id)
 order by coalesce(p.taken_at,p.created_at) desc,p.created_at desc limit 5000) v;
$$;

-- Reuse all existing upload validation and deduplication atomically.
create function trip_private.add_grouped_photo(p_id uuid,p_vault text,p_album text,p_hash text,p_ext text,p_name text,p_scholar text,p_width integer,p_height integer,p_bytes bigint,p_group text,p_taken timestamptz default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare added boolean;
begin
 if p_group is null or p_group not in ('A','AA','both') then raise exception 'Choose Group A, Group AA or Both groups'; end if;
 added:=trip_private.add_photo(p_id,p_vault,p_album,p_hash,p_ext,p_name,p_scholar,p_width,p_height,p_bytes,p_taken);
 if added then
 update trip_private.photos set trip_group=p_group where id=p_id and owner=auth.uid() and vault='nyc-2026';
 end if;
 return added;
end $$;
create function trip_private.set_photo_group(p_vault text,p_id uuid,p_group text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Please sign in first'; end if;
 if p_group is null or p_group not in ('A','AA','both') then raise exception 'Choose Group A, Group AA or Both groups'; end if;
 update trip_private.photos set trip_group=p_group where vault='nyc-2026' and vault=p_vault and id=p_id and owner=auth.uid() and not hidden;
 if not found then raise exception 'This photo does not belong to your account'; end if;
 return true;
end $$;
create function public.trip_add_grouped_photo(p_id uuid,p_vault text,p_album text,p_hash text,p_ext text,p_name text,p_scholar text,p_width integer,p_height integer,p_bytes bigint,p_group text,p_taken timestamptz default null)
returns boolean language sql security invoker set search_path='' as $$select trip_private.add_grouped_photo(p_id,p_vault,p_album,p_hash,p_ext,p_name,p_scholar,p_width,p_height,p_bytes,p_group,p_taken)$$;
create function public.trip_set_photo_group(p_vault text,p_id uuid,p_group text)
returns boolean language sql security invoker set search_path='' as $$select trip_private.set_photo_group(p_vault,p_id,p_group)$$;
revoke all on function trip_private.add_grouped_photo(uuid,text,text,text,text,text,text,integer,integer,bigint,text,timestamptz),public.trip_add_grouped_photo(uuid,text,text,text,text,text,text,integer,integer,bigint,text,timestamptz),trip_private.set_photo_group(text,uuid,text),public.trip_set_photo_group(text,uuid,text) from public,anon,authenticated;
grant execute on function trip_private.add_grouped_photo(uuid,text,text,text,text,text,text,integer,integer,bigint,text,timestamptz),public.trip_add_grouped_photo(uuid,text,text,text,text,text,text,integer,integer,bigint,text,timestamptz),trip_private.set_photo_group(text,uuid,text),public.trip_set_photo_group(text,uuid,text) to authenticated;
notify pgrst,'reload schema';
