-- A private event-team record; submitted versions are immutable and Google delivery is explicit.
begin;
create schema if not exists closeout_private;
revoke all on schema closeout_private from public,anon,authenticated;
grant usage on schema closeout_private to authenticated;
create table closeout_private.events(id text primary key,name text not null,event_date date not null,doc_id text not null,folder_id text not null,reference jsonb not null default '{}',sync_hash text,sync_ready boolean not null default false,last_sync_at timestamptz);
create table closeout_private.members(event text references closeout_private.events(id),email text not null,role text not null check(role in ('lead','contributor')),primary key(event,email));
create table closeout_private.drafts(event text references closeout_private.events(id),author uuid references auth.users(id),content jsonb not null,revision integer not null default 0,updated_at timestamptz not null default now(),primary key(event,author));
create table closeout_private.submissions(id uuid primary key default gen_random_uuid(),event text not null references closeout_private.events(id),author uuid not null references auth.users(id),author_name text not null,content jsonb not null,revision integer not null,receipt_ids uuid[] not null default '{}',created_at timestamptz not null default now(),drive_synced_at timestamptz,drive_archive_id text,unique(event,author,revision));
create table closeout_private.receipts(id uuid primary key default gen_random_uuid(),event text not null references closeout_private.events(id),author uuid not null references auth.users(id),name text not null,mime text not null,bytes bytea not null,created_at timestamptz not null default now(),drive_id text,included boolean not null default true);
alter table closeout_private.events enable row level security;
alter table closeout_private.members enable row level security;
alter table closeout_private.drafts enable row level security;
alter table closeout_private.submissions enable row level security;
alter table closeout_private.receipts enable row level security;
revoke all on all tables in schema closeout_private from public,anon,authenticated;
create index on closeout_private.receipts(event,author);
create index on closeout_private.submissions(event,created_at);
insert into closeout_private.events(id,name,event_date,doc_id,folder_id) values('karaoke-2026','R&B Karaoke Parent Social','2026-09-27','1piDV7MlTP6Sbb1USMNvLDgX0kvovzXpDVMhEZs5hLIk','17dYF3_FPx_tMTbyLvxKg3CBuyGwiERNV');
-- Existing verified organization administrators are the initial stewards.
-- Event contributors and financial reference amounts are seeded privately, not in public source.
insert into closeout_private.members(event,email,role) select 'karaoke-2026',email,'lead' from playbook_private.admins;
create function closeout_private.valid_content(c jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare k text; v jsonb; a jsonb; n text;
begin
 if jsonb_typeof(c->'name') is distinct from 'string' or jsonb_typeof(c) is distinct from 'object' or length(c::text)>50000 or coalesce(length(trim(c->>'name')),0) not between 1 and 80 or jsonb_typeof(c->'answers') is distinct from 'object' or jsonb_typeof(c->'vendors') is distinct from 'object' or length(coalesce(c->>'finalNote',''))>4000 then return false; end if;
 for k,v in select * from jsonb_each(c) loop if k not in ('answers','vendors','name','finalNote') then return false; end if; end loop;
 for k,v in select * from jsonb_each(c->'answers') loop
  if k not in ('flow','attendance','people','equipment','approval','food','decor','overage','facilities','lessons','materials') or jsonb_typeof(v) is distinct from 'object' or coalesce(v->>'status','') not in ('confirmed','pending','unknown','unanswered') or length(coalesce(v->>'text',''))>4000 or length(coalesce(v->>'owner',''))>80 then return false; end if;
  if v->>'status'='confirmed' and length(trim(coalesce(v->>'text','')))=0 then return false; end if;
  for n,a in select * from jsonb_each(v) loop if n not in ('status','text','owner') or jsonb_typeof(a) is distinct from 'string' then return false; end if; end loop;
 end loop;
 for k,v in select * from jsonb_each(c->'vendors') loop
  if k not in ('dj','catering','bartender','decor') or jsonb_typeof(v) is distinct from 'object' or coalesce(v->>'status','unknown') not in ('unknown','paid','reimbursed','pending','review') or length(coalesce(v->>'evidence',''))>2000 then return false; end if;
  for n,a in select * from jsonb_each(v) loop
   if n not in ('cost','rcap_paid','status','date','evidence') or jsonb_typeof(a) is distinct from 'string' then return false; end if;
   if n in ('cost','rcap_paid') and a#>>'{}'<>'' and (a#>>'{}' !~ '^\d{1,6}(\.\d{1,2})?$' or (a#>>'{}')::numeric>100000) then return false; end if;
   if n='date' and a#>>'{}'<>'' and a#>>'{}' !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  end loop;
 end loop;
 return true;
end $$;
create function closeout_private.dispatch(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); mail text; ev text:=p_payload->>'event'; role text; c jsonb; d closeout_private.drafts; result jsonb; f closeout_private.receipts; sid uuid; key text;
begin
 if uid is null then raise exception 'Sign in with an invited event-team email.'; end if;
 select lower(email) into mail from auth.users where id=uid and email_confirmed_at is not null;
 select m.role into role from closeout_private.members m where m.event=ev and m.email=mail;
 if role is null then raise exception 'This closeout is private to the invited karaoke event team.'; end if;
 if p_action='load' then
  return jsonb_build_object('event',(select jsonb_build_object('id',id,'name',name,'sync_ready',sync_ready,'last_sync_at',last_sync_at) from closeout_private.events where id=ev),'reference',(select reference from closeout_private.events where id=ev),'role',role,'draft',(select jsonb_build_object('content',content,'revision',revision,'updated_at',updated_at) from closeout_private.drafts where event=ev and author=uid),'receipts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'mime',mime,'created_at',created_at,'drive_id',drive_id) order by created_at) from closeout_private.receipts where event=ev and author=uid and included),'[]'::jsonb),'submissions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'author_name',s.author_name,'content',s.content,'created_at',s.created_at,'drive_synced_at',s.drive_synced_at,'receipts',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'drive_id',r.drive_id)) from closeout_private.receipts r where r.id=any(s.receipt_ids)),'[]'::jsonb)) order by s.created_at desc) from closeout_private.submissions s where s.event=ev),'[]'::jsonb));
 elsif p_action in ('save','submit') then
  c:=p_payload->'content';
  if not coalesce(closeout_private.valid_content(c),false) then raise exception 'Add your name and a short note for answers marked I can answer. Check the amounts and dates.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(ev||uid::text,0));
  select * into d from closeout_private.drafts where event=ev and author=uid for update;
  if coalesce(d.revision,0)<>coalesce((p_payload->>'expected_revision')::integer,-1) then raise exception 'A newer version was saved on another tab. Reload before editing so it is not overwritten.'; end if;
  insert into closeout_private.drafts(event,author,content,revision) values(ev,uid,c,coalesce(d.revision,0)+1) on conflict(event,author) do update set content=excluded.content,revision=excluded.revision,updated_at=now() returning * into d;
  if p_action='submit' then
   insert into closeout_private.submissions(event,author,author_name,content,revision,receipt_ids) values(ev,uid,trim(c->>'name'),c,d.revision,array(select id from closeout_private.receipts where event=ev and author=uid and included)) returning id into sid;
  end if;
  return jsonb_build_object('revision',d.revision,'id',sid,'submitted_at',case when sid is not null then now() end);
 elsif p_action='receipt' then
  perform pg_advisory_xact_lock(hashtextextended(ev||uid::text,0));
  if coalesce(p_payload->>'mime','') not in ('application/pdf','image/jpeg','image/png') or coalesce(length(trim(p_payload->>'name')),0) not between 1 and 180 or length(p_payload->>'base64')>2796204 or coalesce(p_payload->>'base64','') !~ '^[A-Za-z0-9+/]+={0,2}$' then raise exception 'Choose a PDF, JPG, or PNG up to 2 MB.'; end if;
  if (select count(*) from closeout_private.receipts where event=ev and author=uid)>=20 then raise exception 'Twenty files are already saved. Contact the archive steward for more.'; end if;
  f.bytes:=decode(p_payload->>'base64','base64');
  if octet_length(f.bytes) not between 1 and 2097152 then raise exception 'Choose a file up to 2 MB.'; end if;
  if (p_payload->>'mime'='application/pdf' and substring(f.bytes from 1 for 5)<>decode('255044462d','hex')) or (p_payload->>'mime'='image/png' and substring(f.bytes from 1 for 8)<>decode('89504e470d0a1a0a','hex')) or (p_payload->>'mime'='image/jpeg' and substring(f.bytes from 1 for 3)<>decode('ffd8ff','hex')) then raise exception 'The file contents do not match its type.'; end if;
  insert into closeout_private.receipts(event,author,name,mime,bytes) values(ev,uid,regexp_replace(p_payload->>'name','[/\\\x00-\x1f]','_','g'),p_payload->>'mime',f.bytes) returning * into f;
  return jsonb_build_object('id',f.id,'name',f.name,'mime',f.mime,'created_at',f.created_at);
 elsif p_action='receipt_exclude' then
  update closeout_private.receipts set included=false where id=(p_payload->>'id')::uuid and event=ev and author=uid;
  if not found then raise exception 'File not available.'; end if;
  return jsonb_build_object('ok',true);
 elsif p_action='file' then
  select * into f from closeout_private.receipts r where r.id=(p_payload->>'id')::uuid and r.event=ev and (r.author=uid or exists(select 1 from closeout_private.submissions s where s.event=ev and r.id=any(s.receipt_ids)));
  if f.id is null then raise exception 'File not available.'; end if;
  return jsonb_build_object('name',f.name,'mime',f.mime,'base64',encode(f.bytes,'base64'));
 elsif p_action='setup_key' and role='lead' then
  key:=encode(extensions.gen_random_bytes(32),'hex');
  update closeout_private.events set sync_hash=encode(extensions.digest(key,'sha256'),'hex'),sync_ready=false where id=ev;
  return jsonb_build_object('key',key);
 end if;
 raise exception 'Action not available.';
end $$;
revoke all on function closeout_private.valid_content(jsonb) from public,anon,authenticated;
revoke all on function closeout_private.dispatch(text,jsonb) from public,anon;
grant execute on function closeout_private.dispatch(text,jsonb) to authenticated;
create function public.rcap_closeout(p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select closeout_private.dispatch(p_action,p_payload) $$;
revoke all on function public.rcap_closeout(text,jsonb) from public,anon;
grant execute on function public.rcap_closeout(text,jsonb) to authenticated;
-- Owner-authorized Google script is restricted to this event, never arbitrary Docs.
create function closeout_private.archive(p_action text,p_key text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare ev closeout_private.events; s closeout_private.submissions; f closeout_private.receipts;
begin
 if coalesce(p_key,'') !~ '^[a-f0-9]{64}$' then raise exception 'Archive authorization required.'; end if;
 select * into ev from closeout_private.events where id='karaoke-2026' and sync_hash=encode(extensions.digest(p_key,'sha256'),'hex');
 if ev.id is null then raise exception 'Archive authorization required.'; end if;
 if p_action='pull' then
  return jsonb_build_object('event',jsonb_build_object('id',ev.id,'doc_id',ev.doc_id,'folder_id',ev.folder_id,'reference',ev.reference),'submissions',coalesce((select jsonb_agg(to_jsonb(x)) from (select s.id,s.author_name,(select u.email from auth.users u where u.id=s.author) as author_email,s.content,s.revision,s.receipt_ids,s.created_at from closeout_private.submissions s where s.event=ev.id and s.drive_synced_at is null order by s.created_at limit 5) x),'[]'::jsonb));
 elsif p_action='file' then
  select * into f from closeout_private.receipts r where r.event=ev.id and r.id=(p_payload->>'id')::uuid and exists(select 1 from closeout_private.submissions s where s.event=ev.id and r.id=any(s.receipt_ids));
  if f.id is null then raise exception 'No submitted receipt.'; end if;
  return jsonb_build_object('id',f.id,'name',f.name,'mime',f.mime,'base64',encode(f.bytes,'base64'),'drive_id',f.drive_id);
 elsif p_action='ack_file' then
  if coalesce(p_payload->>'drive_id','') !~ '^[A-Za-z0-9_-]{15,150}$' then raise exception 'Invalid archive file ID.'; end if;
  update closeout_private.receipts set drive_id=p_payload->>'drive_id' where event=ev.id and id=(p_payload->>'id')::uuid;
  return jsonb_build_object('ok',true);
 elsif p_action='ack' then
  if coalesce(p_payload->>'archive_id','') !~ '^[A-Za-z0-9_-]{15,150}$' then raise exception 'Invalid archive ID.'; end if;
  update closeout_private.submissions set drive_synced_at=now(),drive_archive_id=p_payload->>'archive_id' where event=ev.id and id=(p_payload->>'id')::uuid;
  update closeout_private.events set last_sync_at=now(),sync_ready=true where id=ev.id;
  return jsonb_build_object('ok',true);
 elsif p_action='connected' then
  update closeout_private.events set sync_ready=true,last_sync_at=now() where id=ev.id;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Action not available.';
end $$;
revoke all on function closeout_private.archive(text,text,jsonb) from public;
grant usage on schema closeout_private to anon;
grant execute on function closeout_private.archive(text,text,jsonb) to anon,authenticated;
create function public.rcap_closeout_archive(p_action text,p_key text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select closeout_private.archive(p_action,p_key,p_payload) $$;
revoke all on function public.rcap_closeout_archive(text,text,jsonb) from public;
grant execute on function public.rcap_closeout_archive(text,text,jsonb) to anon,authenticated;
commit;
