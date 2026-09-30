-- Capability links are private, never enumerable through the Data API.
create table vault_private.capsule_share_links (
 id uuid primary key default gen_random_uuid(),
 capsule_id uuid not null unique references public.vault_events(id) on delete cascade,
 token text not null unique default encode(extensions.gen_random_bytes(32), 'hex'),
 enabled boolean not null default true,
 allow_web_download boolean not null default true,
 allow_full_download boolean not null default true,
 created_by text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz,
 download_count bigint not null default 0 check (download_count >= 0)
);
alter table vault_private.capsule_share_links enable row level security;
revoke all on vault_private.capsule_share_links from public, anon, authenticated;

-- Short-lived receipts make completion counting idempotent. Never store ZIPs.
create table vault_private.capsule_download_receipts (
 token_hash text primary key,
 link_id uuid not null references vault_private.capsule_share_links(id) on delete cascade,
 link_token text not null,
 expires_at timestamptz not null default now() + interval '24 hours',
 completed boolean not null default false
);
alter table vault_private.capsule_download_receipts enable row level security;
revoke all on vault_private.capsule_download_receipts from public, anon, authenticated;

create function vault_private.capsule_share_admin(p_event uuid, p_action text, p_pass text, p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.vault_events; s vault_private.capsule_share_links;
begin
 select * into e from public.vault_events where id=p_event;
 if e.id is null or not coalesce(public.vault_pass_ok(e.house, p_pass), false) then
  raise exception 'Admin access required' using errcode='42501';
 end if;
 if p_action not in ('get','create','update','regenerate') or p_action is null then raise exception 'Invalid action'; end if;
 -- Serialize creation, rotation and settings for one capsule.
 perform pg_advisory_xact_lock(hashtextextended(p_event::text, 37));
 select * into s from vault_private.capsule_share_links where capsule_id=p_event for update;
 if p_action='create' and s.id is null then
  insert into vault_private.capsule_share_links(capsule_id,created_by)
   values(p_event,coalesce(auth.uid()::text,'passcode:'||e.house)) returning * into s;
 elsif p_action='regenerate' then
  if s.id is null then raise exception 'Generate a link first'; end if;
  update vault_private.capsule_share_links set
   token=encode(extensions.gen_random_bytes(32),'hex'), enabled=true,
   created_by=coalesce(auth.uid()::text,'passcode:'||e.house), created_at=now(), download_count=0
   where id=s.id returning * into s;
  delete from vault_private.capsule_download_receipts where link_id=s.id;
 elsif p_action='update' then
  if s.id is null then raise exception 'Generate a link first'; end if;
  update vault_private.capsule_share_links set
   enabled=case when p_patch ? 'enabled' then (p_patch->>'enabled')::boolean else enabled end,
   allow_web_download=case when p_patch ? 'allow_web_download' then (p_patch->>'allow_web_download')::boolean else allow_web_download end,
   allow_full_download=case when p_patch ? 'allow_full_download' then (p_patch->>'allow_full_download')::boolean else allow_full_download end,
   expires_at=case when p_patch ? 'expires_at' then (p_patch->>'expires_at')::timestamptz else expires_at end
   where id=s.id returning * into s;
 end if;
 if s.id is null then return null; end if;
 return to_jsonb(s);
end $$;

create function public.capsule_share_admin(p_event uuid, p_action text default 'get', p_pass text default '', p_patch jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
 select vault_private.capsule_share_admin(p_event,p_action,p_pass,p_patch)
$$;
revoke all on function vault_private.capsule_share_admin(uuid,text,text,jsonb) from public;
revoke all on function public.capsule_share_admin(uuid,text,text,jsonb) from public;
grant execute on function vault_private.capsule_share_admin(uuid,text,text,jsonb), public.capsule_share_admin(uuid,text,text,jsonb) to anon,authenticated;

create function vault_private.capsule_share(p_token text, p_action text, p_quality text, p_receipt text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s vault_private.capsule_share_links; e public.vault_events; files jsonb; receipt text;
begin
 if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return null; end if;
 select * into s from vault_private.capsule_share_links where token=p_token for update;
 if s.id is null or not s.enabled or s.expires_at<=now() then return null; end if;
 select * into e from public.vault_events where id=s.capsule_id and not hidden;
 if e.id is null then return null; end if;
 if p_action='info' then
  return jsonb_build_object('title',e.title,'house',e.house,
   'allow_web_download',s.allow_web_download,'allow_full_download',s.allow_full_download,
   'file_count',(select count(*) from public.vault_photos where event_id=e.id and not hidden and removed_at is null));
 elsif p_action='start' then
  if p_quality is null or p_quality not in ('web','full') then raise exception 'Invalid quality'; end if;
  if (p_quality='web' and not s.allow_web_download) or (p_quality='full' and not s.allow_full_download) then
   raise exception 'This download option is unavailable' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
   'key',case when p_quality='full' or content_type like 'video/%' or content_type='image/gif' then key else web_key end,
   'storage',storage,'date',coalesce(taken_at,created_at)) order by taken_at nulls last,created_at,id),'[]'::jsonb)
   into files from public.vault_photos where event_id=e.id and not hidden and removed_at is null;
  if jsonb_array_length(files)=0 then raise exception 'No files are available yet'; end if;
  delete from vault_private.capsule_download_receipts where expires_at<now();
  receipt:=encode(extensions.gen_random_bytes(32),'hex');
  insert into vault_private.capsule_download_receipts(token_hash,link_id,link_token)
   values(encode(extensions.digest(receipt,'sha256'),'hex'),s.id,s.token);
  return jsonb_build_object('title',e.title,'files',files,'receipt',receipt);
 elsif p_action='complete' then
  update vault_private.capsule_download_receipts set completed=true
   where token_hash=encode(extensions.digest(coalesce(p_receipt,''),'sha256'),'hex')
    and link_id=s.id and link_token=s.token and not completed and expires_at>now();
  if found then update vault_private.capsule_share_links set download_count=download_count+1 where id=s.id; end if;
  return jsonb_build_object('ok',true);
 else raise exception 'Invalid action';
 end if;
end $$;
create function public.capsule_share(p_token text, p_action text default 'info', p_quality text default null, p_receipt text default null)
returns jsonb language sql security invoker set search_path = '' as $$
 select vault_private.capsule_share(p_token,p_action,p_quality,p_receipt)
$$;
revoke all on function vault_private.capsule_share(text,text,text,text), public.capsule_share(text,text,text,text) from public;
grant execute on function vault_private.capsule_share(text,text,text,text), public.capsule_share(text,text,text,text) to anon,authenticated;
