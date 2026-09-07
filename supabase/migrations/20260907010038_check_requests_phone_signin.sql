alter table public.cr_requests drop constraint cr_requests_delivery_check;
alter table public.cr_requests add constraint cr_requests_delivery_check check(delivery in ('mail','pickup','zelle'));
alter table public.cr_requests add column zelle_contact text not null default '';
-- Legacy email columns now accept a verified contact identity (E.164 phone or email).
-- Keep existing email sessions and API clients compatible during rollout.
alter table public.cr_staff drop constraint cr_staff_email_check;
alter table public.cr_staff add constraint cr_staff_contact_check check(email ~ '^\+[1-9][0-9]{7,14}$' or (email=lower(email) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'));
alter table public.cr_notifications add column channel text not null default 'email' check(channel in ('email','sms'));
create or replace function cr_private.email() returns text language sql stable security definer set search_path='' as $$
 select case when phone_confirmed_at is not null and nullif(phone,'') is not null then '+'||ltrim(phone,'+')
 else case when email_confirmed_at is not null then lower(nullif(email,'')) end end
 from auth.users where id=auth.uid();
$$;
create or replace function cr_private.mutate(p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); who text:=cr_private.email(); staff_role text:=cr_private.role();
 rid uuid; r public.cr_requests; item jsonb; receipt jsonb; cents bigint:=0; value_cents bigint;
 item_date date; chosen text; note text; next_status text; result jsonb; action_label text;
begin
 if uid is null or who is null then raise exception 'Please verify your cellphone number to sign in.'; end if;
 if p_action='staff' then
  if staff_role not in ('secretary','manager') or staff_role is null then raise exception 'Secretary access is required.'; end if;
  chosen:=lower(trim(p_data->>'email'));
  if chosen !~ '^\+1[0-9]{10}$' then raise exception 'Enter a valid US cellphone number for board access.'; end if;
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
  if p_data->>'delivery' not in ('pickup','mail','zelle') or p_data->>'delivery' is null then raise exception 'Choose mail, pickup at school, or Zelle.'; end if;
  if p_data->>'delivery'='mail' and length(trim(coalesce(p_data->>'address',''))) not between 10 and 500 then raise exception 'Enter a complete mailing address.'; end if;
  if p_data->>'delivery'='zelle' and (length(coalesce(p_data->>'zelle_contact',''))>254 or
   (coalesce(p_data->>'zelle_contact','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and coalesce(p_data->>'zelle_contact','') !~ '^([+]1)?[0-9]{10}$')) then
   raise exception 'Enter the cellphone number or email registered with Zelle.';
  end if;
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
   insert into public.cr_requests(id,owner_id,requester_name,email,phone,payee,delivery,address,committee,purpose,items,total_cents,approver_email,zelle_contact)
   values(rid,uid,trim(p_data->>'requester_name'),who,p_data->>'phone',trim(p_data->>'payee'),p_data->>'delivery',coalesce(p_data->>'address',''),trim(p_data->>'committee'),trim(p_data->>'purpose'),p_data->'items',cents,chosen,case when p_data->>'delivery'='zelle' then trim(p_data->>'zelle_contact') else '' end);
   action_label:='submitted';
  else
   update public.cr_requests set requester_name=trim(p_data->>'requester_name'),phone=p_data->>'phone',payee=trim(p_data->>'payee'),delivery=p_data->>'delivery',address=coalesce(p_data->>'address',''),committee=trim(p_data->>'committee'),purpose=trim(p_data->>'purpose'),items=p_data->'items',total_cents=cents,
    zelle_contact=case when p_data->>'delivery'='zelle' then trim(p_data->>'zelle_contact') else '' end,status='submitted',version=version+1,updated_at=now() where id=rid;
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
create or replace function cr_private.queue_notice(p_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare r public.cr_requests; recipient text;
begin
 select * into r from public.cr_requests where id=p_id;
 for recipient in select distinct email from (
  select email from public.cr_staff where role in ('secretary','manager')
  union select r.approver_email
  union select r.email
  union select email from public.cr_staff where role='treasurer' and r.status in ('approved','paid')
 ) q where email is not null loop
 insert into public.cr_notifications(request_id,recipient,channel,subject,body) values
 (r.id,recipient,case when recipient like '+%' then 'sms' else 'email' end,'RCAP check request #'||r.reference||': '||replace(p_action,'_',' '),
 'Check request #'||r.reference||' has an update: '||replace(p_action,'_',' ')||E'.\n\nSign in to view the request, receipts, and approval history:\nhttps://wearercap.org/check-requests/#request/'||r.id);
 end loop;
end $$;

