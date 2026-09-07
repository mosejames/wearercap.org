-- Separate finance records and permissions from existing RCAP applications.
create schema if not exists cr_private;
revoke all on schema cr_private from public, anon;
grant usage on schema cr_private to authenticated;
create table public.cr_staff (
 email text primary key check(email=lower(email) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 name text not null check(length(trim(name)) between 2 and 100),
 role text not null check(role in ('secretary','treasurer','approver','manager'))
);
create table public.cr_requests (
 id uuid primary key,
 owner_id uuid not null references auth.users(id),
 reference bigint generated always as identity unique,
 requester_name text not null,
 email text not null,
 phone text not null check(phone ~ '^[0-9]{10}$'),
 payee text not null,
 delivery text not null check(delivery in ('pickup','mail')),
 address text not null default '',
 committee text not null,
 purpose text not null,
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 20),
 total_cents bigint not null check(total_cents>0 and total_cents<=100000000),
 approver_email text references public.cr_staff(email),
 status text not null default 'submitted' check(status in ('submitted','needs_changes','approved','declined','paid')),
 payment_reference text,
 payment_date date,
 version integer not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index cr_requests_owner on public.cr_requests(owner_id,created_at desc);
create index cr_requests_approver on public.cr_requests(approver_email,status);
create table public.cr_history (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.cr_requests(id),
 actor_email text not null,
 action text not null,
 note text not null default '',
 created_at timestamptz not null default now()
);
create index cr_history_request on public.cr_history(request_id,created_at);
create table public.cr_notifications (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.cr_requests(id),
 recipient text not null, subject text not null, body text not null,
 state text not null default 'pending' check(state in ('pending','sending','sent','failed')),
 attempts integer not null default 0, last_error text, sent_at timestamptz,
 created_at timestamptz not null default now(), locked_at timestamptz
);
create index cr_notifications_pending on public.cr_notifications(state,created_at);
create table cr_private.config (id boolean primary key default true check(id), dispatch_secret text not null default encode(extensions.gen_random_bytes(32),'hex'));
insert into cr_private.config(id) values(true);
alter table cr_private.config enable row level security;

create function cr_private.email() returns text language sql stable security definer set search_path='' as $$
 select lower(email) from auth.users where id=auth.uid() and email_confirmed_at is not null;
$$;
create function cr_private.role() returns text language sql stable security definer set search_path='' as $$
 select role from public.cr_staff where email=cr_private.email();
$$;
create function cr_private.can_read(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.cr_requests where id=p_id and
 (owner_id=auth.uid() or approver_email=cr_private.email() or cr_private.role() in ('secretary','treasurer','manager')));
$$;
revoke all on all functions in schema cr_private from public,anon;
grant execute on function cr_private.email(),cr_private.role(),cr_private.can_read(uuid) to authenticated;
alter table public.cr_staff enable row level security;
alter table public.cr_requests enable row level security;
alter table public.cr_history enable row level security;
alter table public.cr_notifications enable row level security;
revoke all on public.cr_staff,public.cr_requests,public.cr_history,public.cr_notifications from anon,authenticated;
grant select on public.cr_staff,public.cr_requests,public.cr_history,public.cr_notifications to authenticated;
create policy cr_staff_read on public.cr_staff for select to authenticated using(cr_private.email() is not null);
create policy cr_request_read on public.cr_requests for select to authenticated using(cr_private.can_read(id));
create policy cr_history_read on public.cr_history for select to authenticated using(cr_private.can_read(request_id));
create policy cr_notification_read on public.cr_notifications for select to authenticated using(cr_private.can_read(request_id) and (recipient=cr_private.email() or cr_private.role() in ('secretary','treasurer','manager')));

insert into public.cr_staff(email,name,role) values
 ('rcaparents@ronclarkacademy.com','RCAP Secretary','secretary'),
 ('rcapfinance@ronclarkacademy.com','RCAP Treasurer','treasurer'),
 ('mose@mosejames.com','Mose James','manager');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('check-receipts','check-receipts',false,10485760,array['image/jpeg','image/png','application/pdf']);
create policy cr_receipt_upload on storage.objects for insert to authenticated with check(
 bucket_id='check-receipts' and (storage.foldername(name))[1]=auth.uid()::text and cr_private.email() is not null
 and not exists(select 1 from public.cr_requests where id::text=(storage.foldername(name))[2] and status<>'needs_changes')
);
create policy cr_receipt_read on storage.objects for select to authenticated using(
 bucket_id='check-receipts' and ((storage.foldername(name))[1]=auth.uid()::text or
 exists(select 1 from public.cr_requests where id::text=(storage.foldername(name))[2] and cr_private.can_read(id)))
);
-- Receipts become immutable evidence once submitted; replacing requires a new object.

create function cr_private.queue_notice(p_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare r public.cr_requests; recipient text;
begin
 select * into r from public.cr_requests where id=p_id;
 for recipient in select distinct email from (
  select email from public.cr_staff where role in ('secretary','manager')
  union select r.approver_email
  union select r.email
  union select email from public.cr_staff where role='treasurer' and r.status in ('approved','paid')
 ) q where email is not null loop
 insert into public.cr_notifications(request_id,recipient,subject,body) values
 (r.id,recipient,'RCAP check request #'||r.reference||': '||replace(p_action,'_',' '),
 'Check request #'||r.reference||' has an update: '||replace(p_action,'_',' ')||E'.\n\nSign in to view the request, receipts, and approval history:\nhttps://wearercap.org/check-requests/#request/'||r.id);
 end loop;
end $$;
revoke all on function cr_private.queue_notice(uuid,text) from public,anon,authenticated;

create function cr_private.mutate(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); who text:=cr_private.email(); staff_role text:=cr_private.role();
 rid uuid; r public.cr_requests; item jsonb; receipt jsonb; cents bigint:=0; value_cents bigint;
 item_date date; chosen text; note text; next_status text; result jsonb; action_label text;
begin
 if uid is null or who is null then raise exception 'Please sign in with a verified email.'; end if;
 if p_action='staff' then
  if staff_role not in ('secretary','manager') or staff_role is null then raise exception 'Secretary access is required.'; end if;
  chosen:=lower(trim(p_data->>'email'));
  if chosen=who then raise exception 'You cannot change your own access.'; end if;
  if p_data->>'role' not in ('secretary','treasurer','approver') or p_data->>'role' is null then raise exception 'Choose a valid board role.'; end if;
  insert into public.cr_staff(email,name,role) values(chosen,trim(p_data->>'name'),p_data->>'role')
  on conflict(email) do update set name=excluded.name,role=excluded.role;
  return jsonb_build_object('saved',true);
 end if;
 rid:=(p_data->>'id')::uuid;
 if rid is null then raise exception 'A request ID is required.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(rid::text,0));
 select * into r from public.cr_requests where id=rid for update;
 if p_action='submit' then
  if r.id is not null then
   if r.owner_id<>uid then raise exception 'This request is not yours.'; end if;
   if r.status<>'needs_changes' then return to_jsonb(r); end if;
   if (p_data->>'version')::integer is distinct from r.version then raise exception 'This request changed. Refresh and try again.'; end if;
  end if;
  if length(trim(coalesce(p_data->>'requester_name',''))) not between 2 and 100 or
     length(trim(coalesce(p_data->>'payee',''))) not between 2 and 150 or
     length(trim(coalesce(p_data->>'purpose',''))) not between 10 and 2000 or
     length(trim(coalesce(p_data->>'committee',''))) not between 2 and 100 then raise exception 'Complete your name, payee, committee, and expense purpose.'; end if;
  if coalesce(p_data->>'phone','') !~ '^[0-9]{10}$' then raise exception 'Enter a 10-digit phone number.'; end if;
  if p_data->>'delivery' not in ('pickup','mail') or p_data->>'delivery' is null then raise exception 'Choose pickup or mail.'; end if;
  if p_data->>'delivery'='mail' and length(trim(coalesce(p_data->>'address',''))) not between 10 and 500 then raise exception 'Enter a complete mailing address.'; end if;
  if coalesce((p_data->>'acknowledged')::boolean,false)=false then raise exception 'Confirm the reimbursement statement.'; end if;
  if jsonb_typeof(p_data->'items') is distinct from 'array' then raise exception 'Add at least one expense.'; end if;
  if jsonb_array_length(p_data->'items') not between 1 and 20 then raise exception 'Include between 1 and 20 expenses.'; end if;
  for item in select value from jsonb_array_elements(p_data->'items') loop
   if length(trim(coalesce(item->>'description',''))) not between 2 and 300 then raise exception 'Describe every expense.'; end if;
   if coalesce(item->>'amount_cents','') !~ '^[0-9]{1,9}$' then raise exception 'Use valid dollar amounts with at most two decimal places.'; end if;
   value_cents:=(item->>'amount_cents')::bigint;
   if value_cents<=0 or value_cents>100000000 then raise exception 'Enter a positive expense amount.'; end if;
   cents:=cents+value_cents;
   item_date:=(item->>'date')::date;
   if item_date is null or item_date>current_date then raise exception 'Expense dates cannot be in the future.'; end if;
   if jsonb_typeof(item->'receipts') is distinct from 'array' then raise exception 'Every expense needs a receipt.'; end if;
   if jsonb_array_length(item->'receipts') not between 1 and 5 then raise exception 'Attach 1 to 5 receipts per expense.'; end if;
   for receipt in select value from jsonb_array_elements(item->'receipts') loop
    if not exists(select 1 from storage.objects where bucket_id='check-receipts' and name=receipt->>'path' and name like uid::text||'/'||rid::text||'/%'
     and coalesce((metadata->>'size')::bigint,0)>0 and (metadata->>'size')::bigint<=10485760
     and metadata->>'mimetype' in ('image/jpeg','image/png','application/pdf')) then raise exception 'A receipt has not finished uploading. Try again.'; end if;
   end loop;
  end loop;
  chosen:=nullif(lower(trim(p_data->>'approver_email')),'');
  if chosen is not null and (chosen=who or not exists(select 1 from public.cr_staff where email=chosen)) then raise exception 'Select another board member to approve your request.'; end if;
  if r.id is null then
   insert into public.cr_requests(id,owner_id,requester_name,email,phone,payee,delivery,address,committee,purpose,items,total_cents,approver_email)
   values(rid,uid,trim(p_data->>'requester_name'),who,p_data->>'phone',trim(p_data->>'payee'),p_data->>'delivery',coalesce(p_data->>'address',''),trim(p_data->>'committee'),trim(p_data->>'purpose'),p_data->'items',cents,chosen);
   action_label:='submitted';
  else
   update public.cr_requests set requester_name=trim(p_data->>'requester_name'),phone=p_data->>'phone',payee=trim(p_data->>'payee'),delivery=p_data->>'delivery',address=coalesce(p_data->>'address',''),committee=trim(p_data->>'committee'),purpose=trim(p_data->>'purpose'),items=p_data->'items',total_cents=cents,
    status='submitted',version=version+1,updated_at=now() where id=rid;
   action_label:='resubmitted';
  end if;
  insert into public.cr_history(request_id,actor_email,action,note) values(rid,who,action_label,'Receipts attached; requester certified the expenses.');
 else
  if r.id is null or not cr_private.can_read(rid) then raise exception 'Request not found.'; end if;
  if (p_data->>'version')::integer is distinct from r.version then raise exception 'This request changed. Refresh and try again.'; end if;
  note:=trim(coalesce(p_data->>'note',''));
  if length(note)>2000 then raise exception 'Keep the note under 2,000 characters.'; end if;
  if p_action='assign' then
   if staff_role not in ('secretary','manager') or staff_role is null then raise exception 'Secretary access is required.'; end if;
   if r.status not in ('submitted','needs_changes') then raise exception 'Only an open request can be assigned.'; end if;
   chosen:=lower(trim(p_data->>'approver_email'));
   if chosen=r.email or not exists(select 1 from public.cr_staff where email=chosen) then raise exception 'Choose a board member other than the requester.'; end if;
   update public.cr_requests set approver_email=chosen,version=version+1,updated_at=now() where id=rid;
   action_label:='assigned'; note:='Assigned to '||chosen||case when note<>'' then '. '||note else '' end;
  elsif p_action in ('approved','declined','needs_changes') then
   if r.status<>'submitted' then raise exception 'Only a submitted request can be reviewed.'; end if;
   if r.owner_id=uid then raise exception 'You cannot review your own request.'; end if;
   if p_action='needs_changes' then
    if who is distinct from r.approver_email and coalesce(staff_role,'') not in ('secretary','manager') then raise exception 'Reviewer access is required.'; end if;
   elsif who is distinct from r.approver_email then raise exception 'Only the assigned board member can approve or decline.'; end if;
   if p_action in ('declined','needs_changes') and length(note)<5 then raise exception 'Include a reason so the requester knows what to do.'; end if;
   update public.cr_requests set status=p_action,version=version+1,updated_at=now() where id=rid;
   action_label:=p_action;
  elsif p_action='paid' then
   if staff_role is distinct from 'treasurer' then raise exception 'Treasurer access is required to record payment.'; end if;
   if r.status<>'approved' then raise exception 'Board approval is required before payment.'; end if;
   if r.owner_id=uid then raise exception 'You cannot record your own payment.'; end if;
   if length(trim(coalesce(p_data->>'payment_reference',''))) not between 1 and 100 then raise exception 'Enter the check or payment reference.'; end if;
   item_date:=(p_data->>'payment_date')::date;
   if item_date is null or item_date>current_date then raise exception 'Choose a valid payment date.'; end if;
   update public.cr_requests set status='paid',payment_reference=trim(p_data->>'payment_reference'),payment_date=item_date,version=version+1,updated_at=now() where id=rid;
   action_label:='paid';
  else raise exception 'Unknown request action.';
  end if;
  insert into public.cr_history(request_id,actor_email,action,note) values(rid,who,action_label,note);
 end if;
 perform cr_private.queue_notice(rid,action_label);
 select to_jsonb(q) into result from public.cr_requests q where id=rid;
 return result;
end $$;
revoke all on function cr_private.mutate(text,jsonb) from public,anon;
grant execute on function cr_private.mutate(text,jsonb) to authenticated;
create function public.cr_action(p_action text,p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$ select cr_private.mutate(p_action,p_data); $$;
revoke all on function public.cr_action(text,jsonb) from public,anon;
grant execute on function public.cr_action(text,jsonb) to authenticated;

-- A random database-held key gates the independent notification worker.
create function public.cr_claim_notifications(p_secret text) returns setof public.cr_notifications language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from cr_private.config where dispatch_secret=p_secret) then raise exception 'Unauthorized'; end if;
 return query update public.cr_notifications set state='sending',locked_at=now(),attempts=attempts+1 where id in (
  select id from public.cr_notifications where attempts<5 and (state in ('pending','failed') or (state='sending' and locked_at<now()-interval '5 minutes'))
  order by created_at for update skip locked limit 20
 ) returning *;
end $$;
revoke all on function public.cr_claim_notifications(text) from public,anon,authenticated;
grant execute on function public.cr_claim_notifications(text) to service_role;
grant all on public.cr_notifications to service_role;
create function cr_private.dispatch() returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.cr_notifications where state<>'sent' and attempts<5) then
  perform net.http_post(url:='https://kcsrtwwpnekqdrfgcfys.supabase.co/functions/v1/check-request-notify',
   headers:=jsonb_build_object('Content-Type','application/json','x-cr-secret',(select dispatch_secret from cr_private.config where id)),body:='{}'::jsonb);
 end if;
end $$;
revoke all on function cr_private.dispatch() from public,anon,authenticated;
create function cr_private.notify_trigger() returns trigger language plpgsql security definer set search_path='' as $$ begin perform cr_private.dispatch(); return new; end $$;
revoke all on function cr_private.notify_trigger() from public,anon,authenticated;
create trigger cr_notify after insert on public.cr_notifications for each statement execute function cr_private.notify_trigger();

-- Scheduled retries also recover a missed trigger invocation.
create extension if not exists pg_cron;
select cron.schedule('rcap-check-request-email-retry','*/2 * * * *','select cr_private.dispatch()');
