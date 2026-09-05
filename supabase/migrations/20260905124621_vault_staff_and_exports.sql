-- Named staff are independent of the legacy passcode. Only the owner grants roles.
create table vault_private.staff(user_id uuid primary key references auth.users(id), role text not null check(role in('owner','admin','moderator')), created_at timestamptz not null default now());
alter table vault_private.staff enable row level security;
create table vault_private.staff_audit(id bigint generated always as identity primary key,actor uuid,target uuid,role text,created_at timestamptz default now());
alter table vault_private.staff_audit enable row level security;
create function public.vault_staff_role() returns text language sql stable security definer set search_path='' as $$
 select s.role from vault_private.staff s join auth.users u on u.id=s.user_id where s.user_id=auth.uid() and u.phone_confirmed_at is not null
$$;
create function vault_private.staff_can(p_scope text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(case p_scope when 'owner' then public.vault_staff_role()='owner' when 'moderate' then public.vault_staff_role() in('owner','admin','moderator') else public.vault_staff_role() in('owner','admin') end,false)
$$;
-- Preserve passcode access for existing admin tools; named moderators do not gain event management.
create or replace function public.vault_pass_ok(p_house text,p_pass text) returns boolean language sql stable security definer set search_path='' as $$
 select (p_house='amistad' and vault_private.staff_can('admin')) or exists(select 1 from public.vault_settings s where s.house=p_house and s.admin_pass=coalesce(p_pass,''))
$$;
create function public.vault_staff_list() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not vault_private.staff_can('owner') then raise exception 'Only the owner can manage staff'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',p.display_name,'role',s.role) order by p.display_name) from vault_private.members m join public.vault_profiles p on p.owner=m.owner join auth.users u on u.id=m.user_id left join vault_private.staff s on s.user_id=m.user_id where u.phone_confirmed_at is not null),'[]');
end $$;
create function public.vault_staff_set(p_user uuid,p_role text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not vault_private.staff_can('owner') then raise exception 'Only the owner can manage staff'; end if;
 if exists(select 1 from vault_private.staff where user_id=p_user and role='owner') then raise exception 'The owner role cannot be changed here'; end if;
 if p_role is not null and p_role not in('admin','moderator') then raise exception 'Choose admin or moderator'; end if;
 if not exists(select 1 from vault_private.members m join auth.users u on u.id=m.user_id where m.user_id=p_user and u.phone_confirmed_at is not null) then raise exception 'This person must verify their phone first'; end if;
 if p_role is null then delete from vault_private.staff where user_id=p_user;
 else insert into vault_private.staff values(p_user,p_role,now()) on conflict(user_id) do update set role=excluded.role; end if;
 insert into vault_private.staff_audit(actor,target,role) values(auth.uid(),p_user,p_role);
end $$;
create function public.vault_moderation_ok(p_house text,p_pass text) returns boolean language sql stable security definer set search_path='' as $$
 select (p_house='amistad' and vault_private.staff_can('moderate')) or public.vault_pass_ok(p_house,p_pass)
$$;
-- Extend only moderation operations to moderators, including storage cleanup.
do $$ declare r record; d text; begin
 for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in('vault_review_reports','vault_resolve_report','vault_ban_uploader','vault_remove_upload','vault_finish_removal','vault_banned_members','vault_unban_member','vault_hide_comment')) or (n.nspname='vault_private' and p.proname='can_delete_object') loop
 d:=pg_get_functiondef(r.oid);
 d:=replace(d,'public.vault_pass_ok(', 'public.vault_moderation_ok(');
 execute d;
 end loop;
end $$;

create table vault_private.export_config(id boolean primary key default true check(id), worker_hash text not null,last_seen timestamptz);
alter table vault_private.export_config enable row level security;
create table vault_private.exports(
 id uuid primary key default gen_random_uuid(), requested_by uuid not null references auth.users(id), event_ids uuid[] not null, include_videos boolean not null,
 status text not null default 'queued' check(status in('queued','processing','ready','failed','cancelled','expired')),
 manifest jsonb not null, total_files integer not null, total_bytes bigint not null, completed_files integer not null default 0,
 parts jsonb not null default '[]', error text, attempts integer not null default 0, lease uuid, lease_until timestamptz,
 created_at timestamptz not null default now(), completed_at timestamptz, expires_at timestamptz not null default now()+interval '7 days');
alter table vault_private.exports enable row level security;
create function vault_private.export_worker() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from vault_private.export_config where worker_hash=encode(extensions.digest(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-vault-export-worker',''),'sha256'),'hex'))
$$;
create function public.vault_export_estimate(p_events uuid[],p_videos boolean default true) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not vault_private.staff_can('admin') then raise exception 'Admin sign-in required'; end if;
 return (select jsonb_build_object('files',count(*),'bytes',coalesce(sum(p.bytes),0)) from public.vault_photos p join public.vault_events e on e.id=p.event_id where p.event_id=any(p_events) and not p.hidden and p.removed_at is null and not e.hidden and p.house='amistad' and (p_videos or p.content_type like 'image/%'));
end $$;
create function public.vault_export_create(p_events uuid[],p_videos boolean default true) returns uuid language plpgsql security definer set search_path='' as $$
declare j uuid; items jsonb; bytes bigint; count_files integer;
begin
 if not vault_private.staff_can('admin') then raise exception 'Admin sign-in required'; end if;
 perform pg_advisory_xact_lock(hashtext('vault-export-create'));
 if (select count(*) from vault_private.exports where status in('queued','processing'))>=5 then raise exception 'Five exports are already waiting. Please wait for one to finish.'; end if;
 if coalesce(cardinality(p_events),0)=0 or cardinality(p_events)>100 then raise exception 'Choose one or more events'; end if;
 select jsonb_agg(jsonb_build_object('id',p.id,'event',e.title,'slug',e.slug,'date',e.starts_on,'key',p.key,'storage',p.storage,'bytes',p.bytes,'type',p.content_type) order by e.starts_on,p.created_at,p.id),coalesce(sum(p.bytes),0),count(*) into items,bytes,count_files
 from public.vault_photos p join public.vault_events e on e.id=p.event_id where p.event_id=any(p_events) and not p.hidden and p.removed_at is null and not e.hidden and p.house='amistad' and (p_videos or p.content_type like 'image/%');
 if count_files=0 then raise exception 'No visible uploads in this selection'; end if;
 if bytes>21474836480 then raise exception 'Please split this selection into exports smaller than 20 GB'; end if;
 insert into vault_private.exports(requested_by,event_ids,include_videos,manifest,total_files,total_bytes) values(auth.uid(),p_events,p_videos,items,count_files,bytes) returning id into j;
 return j;
end $$;
create function public.vault_export_list() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not vault_private.staff_can('admin') then raise exception 'Admin sign-in required'; end if;
 return jsonb_build_object('worker_seen',(select last_seen from vault_private.export_config), 'jobs',coalesce((select jsonb_agg(to_jsonb(j) order by created_at desc) from (select id,event_ids,include_videos,case when expires_at<now() then 'expired' else status end status,total_files,total_bytes,completed_files,parts,error,created_at,expires_at from vault_private.exports order by created_at desc limit 50) j),'[]'));
end $$;
create function public.vault_export_cancel(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not vault_private.staff_can('admin') then raise exception 'Admin sign-in required'; end if;
 update vault_private.exports set status='cancelled',expires_at=now(),lease=null,lease_until=null where id=p_id and status in('queued','processing','ready','failed');
end $$;
create function public.vault_export_claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare j vault_private.exports;
begin
 if not vault_private.export_worker() then raise exception 'Worker authorization required'; end if;
 update vault_private.export_config set last_seen=now();
 update vault_private.exports set status='failed',error='The worker was interrupted. Please create the export again.' where status='processing' and lease_until<now() and attempts>=3;
 -- Revoked admins cannot leave an export queued for processing.
 update vault_private.exports e set status='cancelled',expires_at=now() where status in('queued','processing') and not exists(select 1 from vault_private.staff s where s.user_id=e.requested_by and s.role in('owner','admin'));
 select * into j from vault_private.exports where expires_at>now() and (status='queued' or (status='processing' and lease_until<now() and attempts<3)) order by created_at for update skip locked limit 1;
 if j.id is null then return null; end if;
 update vault_private.exports set status='processing',lease=gen_random_uuid(),lease_until=now()+interval '10 minutes',attempts=attempts+1,completed_files=0,parts='[]',error=null where id=j.id returning * into j;
 return jsonb_build_object('id',j.id,'lease',j.lease,'manifest',j.manifest,'total_files',j.total_files);
end $$;
create function public.vault_export_progress(p_id uuid,p_lease uuid,p_done integer,p_parts jsonb,p_finish boolean default false,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
declare j vault_private.exports;
begin
 if not vault_private.export_worker() then raise exception 'Worker authorization required'; end if;
 select * into j from vault_private.exports where id=p_id and lease=p_lease and status='processing' and lease_until>now() for update;
 if j.id is null then raise exception 'Export cancelled or lease expired'; end if;
 if p_done<0 or p_done>j.total_files or jsonb_typeof(p_parts)<>'array' then raise exception 'Invalid progress'; end if;
 if exists(select 1 from jsonb_array_elements(p_parts) p where left(p->>'key',37)<>p_id::text||'/' or coalesce((p->>'bytes')::bigint,0)<=0) then raise exception 'Invalid export parts'; end if;
 if p_finish and (p_done<>j.total_files or jsonb_array_length(p_parts)=0) then raise exception 'Incomplete export'; end if;
 update vault_private.exports set completed_files=p_done,parts=p_parts,lease_until=now()+interval '10 minutes',status=case when p_error is not null then 'failed' when p_finish then 'ready' else 'processing' end,error=left(p_error,300),completed_at=case when p_finish then now() else null end,expires_at=case when p_finish then now()+interval '7 days' else expires_at end where id=p_id;
end $$;
create function public.vault_export_cleanup() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not vault_private.export_worker() then raise exception 'Worker authorization required'; end if;
 update vault_private.exports set status='expired' where expires_at<now() and status not in('expired','cancelled');
 return coalesce((select jsonb_agg(name) from storage.objects where bucket_id='vault-exports' and exists(select 1 from vault_private.exports j where split_part(name,'/',1)=j.id::text and (j.expires_at<now() or j.status in('cancelled','failed')))),'[]');
end $$;
-- Downloads require named admin access and expire with their job. Workers can
-- write only to a live leased job; no broader service-role credential is used.
create function vault_private.export_access(p_name text,p_write boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from vault_private.exports j where split_part(p_name,'/',1)=j.id::text and (
  (vault_private.export_worker() and (not p_write or (j.status='processing' and j.lease_until>now() and split_part(p_name,'/',2)=j.lease::text)))
  or (not p_write and vault_private.staff_can('admin') and j.status='ready' and j.expires_at>now())))
$$;
insert into storage.buckets(id,name,public,file_size_limit) values('vault-exports','vault-exports',false,52428800) on conflict(id) do nothing;
create policy vault_exports_read on storage.objects for select to anon,authenticated using(bucket_id='vault-exports' and vault_private.export_access(name));
create policy vault_exports_insert on storage.objects for insert to anon,authenticated with check(bucket_id='vault-exports' and vault_private.export_access(name,true));
create policy vault_exports_delete on storage.objects for delete to anon,authenticated using(bucket_id='vault-exports' and vault_private.export_worker());
-- Lock down all newly introduced endpoints explicitly.
do $$ declare r record; begin
 for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in('vault_staff_role','vault_staff_list','vault_staff_set','vault_export_estimate','vault_export_create','vault_export_list','vault_export_cancel','vault_export_claim','vault_export_progress','vault_export_cleanup','vault_moderation_ok')) or (n.nspname='vault_private' and p.proname in('staff_can','export_worker','export_access')) loop
 execute format('revoke all on function %s from public,anon,authenticated',r.sig);
 execute format('grant execute on function %s to anon,authenticated',r.sig);
 end loop;
end $$;
