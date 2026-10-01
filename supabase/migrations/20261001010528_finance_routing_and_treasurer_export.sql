-- Treasurer-controlled routing. Every submission still starts with its requester.
alter table public.cr_requests add column routed_approval boolean not null default false;
create table public.cr_approval_routes (
 committee text not null check(length(trim(committee)) between 2 and 100),
 request_type text not null check(request_type in ('reimbursement','vendor')),
 approver_email text not null references public.cr_staff(email),
 updated_by text not null,
 updated_at timestamptz not null default now(),
 primary key(committee,request_type)
);
alter table public.cr_approval_routes enable row level security;
revoke all on public.cr_approval_routes from public,anon,authenticated;
grant select on public.cr_approval_routes to authenticated;
create policy cr_approval_routes_read on public.cr_approval_routes for select to authenticated
 using(cr_private.role() in ('treasurer','secretary','manager','board'));
create table public.cr_approval_route_history (
 id uuid primary key default gen_random_uuid(),
 committee text not null,
 request_type text not null,
 old_approver text,
 new_approver text,
 actor_email text not null,
 created_at timestamptz not null default now()
);
alter table public.cr_approval_route_history enable row level security;
revoke all on public.cr_approval_route_history from public,anon,authenticated;
grant select on public.cr_approval_route_history to authenticated;
create policy cr_approval_route_history_read on public.cr_approval_route_history for select to authenticated
 using(cr_private.role() in ('treasurer','secretary','manager','board'));

create or replace function cr_private.mutate(p_action text, p_data jsonb)
 returns jsonb language plpgsql security definer set search_path to ''
as $function$
declare
 uid uuid:=auth.uid(); who text:=cr_private.email(); staff_role text:=cr_private.role();
 my_name text; rid uuid; r public.cr_requests; item jsonb; receipt jsonb; cents bigint:=0; value_cents bigint;
 item_date date; chosen text; note text; result jsonb; action_label text;
 dup public.cr_requests; eligible text[]; yes_votes int; no_votes int; need int; owner_is_treasurer boolean;
begin
 if uid is null or who is null then raise exception 'Please verify your cellphone number to sign in.'; end if;
 select name into my_name from public.cr_staff where email=who;
 if p_action='staff' then
  if staff_role not in ('secretary','manager') or staff_role is null then raise exception 'Admin access is required.'; end if;
  chosen:=lower(trim(p_data->>'email'));
  if chosen !~ '^\+1[0-9]{10}$' then raise exception 'Enter a valid US cellphone number for board access.'; end if;
  if chosen=who then raise exception 'You cannot change your own access.'; end if;
  if p_data->>'role' not in ('secretary','treasurer','board') or p_data->>'role' is null then raise exception 'Choose a valid board role.'; end if;
  insert into public.cr_staff(email,name,role) values(chosen,trim(p_data->>'name'),p_data->>'role')
  on conflict(email) do update set name=excluded.name,role=excluded.role;
  return jsonb_build_object('saved',true);
 end if;
 if p_action='route' then
  if coalesce(staff_role,'') not in ('treasurer','secretary','manager') then raise exception 'Finance admin access is required.'; end if;
  if length(trim(coalesce(p_data->>'committee',''))) not between 2 and 100 then raise exception 'Choose a committee.'; end if;
  if p_data->>'request_type' not in ('reimbursement','vendor') then raise exception 'Choose a request type.'; end if;
  chosen:=nullif(lower(trim(p_data->>'approver_email')),'');
  select approver_email into note from public.cr_approval_routes where committee=trim(p_data->>'committee') and request_type=p_data->>'request_type';
  if chosen is null then
   delete from public.cr_approval_routes where committee=trim(p_data->>'committee') and request_type=p_data->>'request_type';
  else
   if not exists(select 1 from public.cr_staff where email=chosen and role in ('board','treasurer','manager','secretary')) then raise exception 'Choose a board reviewer with access.'; end if;
   insert into public.cr_approval_routes(committee,request_type,approver_email,updated_by)
   values(trim(p_data->>'committee'),p_data->>'request_type',chosen,who)
   on conflict(committee,request_type) do update set approver_email=excluded.approver_email,updated_by=excluded.updated_by,updated_at=now();
  end if;
  if note is distinct from chosen then
   insert into public.cr_approval_route_history(committee,request_type,old_approver,new_approver,actor_email)
   values(trim(p_data->>'committee'),p_data->>'request_type',note,chosen,who);
  end if;
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
  if coalesce((p_data->>'on_behalf')::boolean,false) then
   if r.id is null or not r.on_behalf then raise exception 'The person requesting payment must submit their own request.'; end if;
   if coalesce(staff_role,'') not in ('secretary','treasurer','manager') then raise exception 'Staff access is required to correct this existing request.'; end if;
   if coalesce(p_data->>'payee_contact','') !~ '^\+1[0-9]{10}$' and coalesce(p_data->>'payee_contact','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter the payee email or cellphone.'; end if;
   if length(p_data->>'payee_contact')>254 or cr_private.is_contact(lower(trim(p_data->>'payee_contact'))) then raise exception 'For your own reimbursement, submit a personal request.'; end if;
   if nullif(trim(p_data->>'approver_email'),'') is null then raise exception 'Choose a board member to approve this request.'; end if;
  end if;
  if length(coalesce(p_data->>'event_name',''))>150 then raise exception 'Keep the event name under 150 characters.'; end if;
  if p_data->>'request_type' is null or p_data->>'request_type' not in ('reimbursement','vendor') then raise exception 'Choose reimbursement or direct vendor payment.'; end if;
  if coalesce((p_data->>'budget_confirmed')::boolean,false)=false then raise exception 'Confirm this expense is within budget.'; end if;
  if coalesce(p_data->>'phone','') !~ '^[0-9]{10}$' then raise exception 'Enter a 10-digit phone number.'; end if;
  if (p_data->>'delivery'<>'zelle' and not (p_data->>'request_type'='vendor' and p_data->>'delivery'='debit_card')) or p_data->>'delivery' is null then raise exception 'Reimbursements must use Zelle. Vendor payments may use debit card when Zelle is unavailable.'; end if;
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
   -- Reimbursements name the store or vendor on each expense; for a direct
   -- vendor payment the payee already is the vendor.
   if p_data->>'request_type'='reimbursement' and length(trim(coalesce(item->>'vendor',''))) not between 2 and 150 then raise exception 'Enter the store or vendor for every expense.'; end if;
   if coalesce(item->>'amount_cents','') !~ '^[0-9]{1,9}$' then raise exception 'Use valid dollar amounts with at most two decimal places.'; end if;
   value_cents:=(item->>'amount_cents')::bigint;
   if value_cents<=0 or value_cents>100000000 then raise exception 'Enter a positive expense amount.'; end if;
   if coalesce(item->>'document_total_cents','') !~ '^[0-9]{1,9}$' or (item->>'document_total_cents')::bigint<value_cents then raise exception 'Requested amount must not exceed the receipt or invoice total.'; end if;
   if (item->>'document_total_cents')::bigint>value_cents and length(trim(coalesce(item->>'coverage_note',''))) not between 10 and 1000 then raise exception 'Explain who covers the difference for each partial reimbursement.'; end if;
   if length(coalesce(item->>'coverage_note',''))>1000 then raise exception 'Keep the coverage explanation under 1,000 characters.'; end if;
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
  -- Existing staff-prepared records keep their reviewer. New submissions use
  -- the committee and request-type route. Unconfigured routes go to the treasurer.
  if r.id is not null and r.on_behalf then
   chosen:=r.approver_email;
  else
   select approver_email into chosen from public.cr_approval_routes
    where committee=trim(p_data->>'committee') and request_type=p_data->>'request_type';
  end if;
  if chosen is not null and cr_private.is_contact(chosen) then chosen:=null; owner_is_treasurer:=true;
  else owner_is_treasurer:=coalesce(staff_role='treasurer',false) and chosen is null; end if;
  if r.id is null then
   insert into public.cr_requests(id,owner_id,requester_name,email,phone,payee,delivery,address,committee,purpose,items,total_cents,approver_email,zelle_contact,status)
   values(rid,uid,trim(p_data->>'requester_name'),who,p_data->>'phone',trim(p_data->>'payee'),p_data->>'delivery',coalesce(p_data->>'address',''),trim(p_data->>'committee'),trim(p_data->>'purpose'),p_data->'items',cents,null,case when p_data->>'delivery'='zelle' then trim(p_data->>'zelle_contact') else '' end,
    case when owner_is_treasurer then 'board_review' else 'submitted' end);
   action_label:='submitted';
  else
   update public.cr_requests set requester_name=trim(p_data->>'requester_name'),phone=p_data->>'phone',payee=trim(p_data->>'payee'),delivery=p_data->>'delivery',address=coalesce(p_data->>'address',''),committee=trim(p_data->>'committee'),purpose=trim(p_data->>'purpose'),items=p_data->'items',total_cents=cents,
    zelle_contact=case when p_data->>'delivery'='zelle' then trim(p_data->>'zelle_contact') else '' end,
    status=case when owner_is_treasurer then 'board_review' else 'submitted' end,version=version+1,updated_at=now() where id=rid;
   action_label:='resubmitted';
  end if;
  if length(coalesce(p_data->>'archive_email',''))>254 or (coalesce(p_data->>'archive_email','')<>'' and p_data->>'archive_email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Enter a valid email for your PDF copy.'; end if;
  update public.cr_requests set approver_email=chosen,routed_approval=(chosen is not null and not coalesce((p_data->>'on_behalf')::boolean,false)),on_behalf=coalesce((p_data->>'on_behalf')::boolean,false),payee_contact=case when coalesce((p_data->>'on_behalf')::boolean,false) then lower(trim(p_data->>'payee_contact')) else '' end,event_name=trim(coalesce(p_data->>'event_name','')) where id=rid;
  update public.cr_requests set request_type=p_data->>'request_type',budget_confirmed=true where id=rid;
  update public.cr_requests set archive_email=lower(trim(coalesce(p_data->>'archive_email',''))) where id=rid;
  if p_data ? 'approval_recipients' then
   if coalesce(staff_role,'') not in ('secretary','treasurer','manager','board','approver') then raise exception 'Board access is required to choose approval email recipients.'; end if;
   if jsonb_typeof(p_data->'approval_recipients') is distinct from 'array' then raise exception 'Use a list of email addresses.'; end if;
   if jsonb_array_length(p_data->'approval_recipients')>20 or exists(select 1 from jsonb_array_elements_text(p_data->'approval_recipients') e where e is null or length(e)>254 or e !~ '^[^[:space:]@,<>]+@[^[:space:]@,<>]+\.[^[:space:]@,<>]+$') then raise exception 'Enter up to 20 valid approval email addresses.'; end if;
   update public.cr_requests set approval_recipients=array(select distinct lower(trim(e)) from jsonb_array_elements_text(p_data->'approval_recipients') e) where id=rid;
  end if;
  insert into public.cr_history(request_id,actor_email,action,note) values(rid,who,action_label,
   case when p_data->>'request_type'='vendor' then 'Invoice attached; requester confirmed expense is within budget and invoice remains unpaid.'
   else 'Paid receipts attached; requester confirmed expense is within budget, reimbursable items are identified, and payment is complete.' end
   ||case when chosen is not null then ' Assigned board member approval required.' when owner_is_treasurer then ' Submitted by the treasurer, so it goes to a board vote.' else ' Treasurer approval required.' end);
 else
  if r.id is null or not cr_private.can_read(rid) then raise exception 'Request not found.'; end if;
  if (p_data->>'version')::integer is distinct from r.version then raise exception 'This request changed. Refresh and try again.'; end if;
  note:=trim(coalesce(p_data->>'note',''));
  if length(note)>2000 then raise exception 'Keep the note under 2,000 characters.'; end if;
  if ((r.owner_id=uid and not (p_action='paid' and r.on_behalf)) or (r.on_behalf and cr_private.is_contact(r.payee_contact))) and p_action<>'duplicate' then raise exception 'You cannot review your own request.'; end if;
  if p_data ? 'approval_recipients' then
   if coalesce(staff_role,'') not in ('secretary','treasurer','manager','board','approver') then raise exception 'Board access is required to choose approval email recipients.'; end if;
   if jsonb_typeof(p_data->'approval_recipients') is distinct from 'array' then raise exception 'Use a list of email addresses.'; end if;
   if jsonb_array_length(p_data->'approval_recipients')>20 or exists(select 1 from jsonb_array_elements_text(p_data->'approval_recipients') e where e is null or length(e)>254 or e !~ '^[^[:space:]@,<>]+@[^[:space:]@,<>]+\.[^[:space:]@,<>]+$') then raise exception 'Enter up to 20 valid approval email addresses.'; end if;
   update public.cr_requests set approval_recipients=array(select distinct lower(trim(e)) from jsonb_array_elements_text(p_data->'approval_recipients') e) where id=rid;
  end if;
  if p_action in ('approved','declined') then
   if r.status<>'submitted' then raise exception 'Only a request awaiting the treasurer can be approved or declined here.'; end if;
   if (r.on_behalf or r.routed_approval) and r.approver_email is not null then
    if who is distinct from r.approver_email then raise exception 'Only the assigned board member can approve or decline.'; end if;
   elsif staff_role is distinct from 'treasurer' then raise exception 'Only the treasurer can approve or decline.'; end if;
   if p_action='declined' and length(note)<5 then raise exception 'Include a reason so the requester knows what to do.'; end if;
   update public.cr_requests set status=p_action,version=version+1,updated_at=now() where id=rid;
   action_label:=p_action;
   if p_action='approved' then note:='Approved $'||to_char(r.total_cents::numeric/100,'FM999999990.00')||' payable to '||r.payee||'. '||note; end if;
  elsif p_action='needs_changes' then
   if r.status not in ('submitted','board_review') then raise exception 'Only an open request can be sent back.'; end if;
   if (not (r.on_behalf or r.routed_approval) or r.approver_email is null or who is distinct from r.approver_email) and coalesce(staff_role,'') not in ('treasurer','secretary','manager') then raise exception 'Treasurer or admin access is required.'; end if;
   if length(note)<5 then raise exception 'Include a reason so the requester knows what to do.'; end if;
   update public.cr_requests set status='needs_changes',version=version+1,updated_at=now() where id=rid;
   action_label:='needs_changes';
  elsif p_action='board_review' then
   if r.status<>'submitted' then raise exception 'Only a request awaiting the treasurer can go to the board.'; end if;
   if staff_role is distinct from 'treasurer' then raise exception 'Only the treasurer can send a request to the board.'; end if;
   update public.cr_requests set status='board_review',version=version+1,updated_at=now() where id=rid;
   action_label:='board_review';
  elsif p_action in ('vote_approve','vote_decline') then
   if r.status<>'board_review' then raise exception 'This request is not up for a board vote.'; end if;
   eligible:=cr_private.voters(rid);
   if my_name is null or coalesce(staff_role,'') not in ('board','treasurer') or not (my_name = any(eligible)) then raise exception 'Only voting board members can vote.'; end if;
   if p_action='vote_decline' and length(note)<5 then raise exception 'Include a reason with a no vote.'; end if;
   action_label:=p_action;
   insert into public.cr_history(request_id,actor_email,action,note) values(rid,who,action_label,note);
   -- Each person's latest vote counts, whichever of their logins cast it.
   -- Only votes since the request last went up for a vote are counted, so a
   -- resubmitted request starts fresh.
   select count(*) filter (where v.action='vote_approve'), count(*) filter (where v.action='vote_decline') into yes_votes,no_votes
   from (select distinct on (s.name) h.action from public.cr_history h join public.cr_staff s on s.email=h.actor_email
         where h.request_id=rid and h.action in ('vote_approve','vote_decline') and s.name = any(eligible)
           and h.created_at >= (select max(created_at) from public.cr_history
                                where request_id=rid and action in ('board_review','submitted','resubmitted'))
         order by s.name,h.created_at desc,h.id desc) v;
   need:=cardinality(eligible)/2+1;
   if yes_votes>=need or no_votes>=need then
    update public.cr_requests set status=case when yes_votes>=need then 'approved' else 'declined' end,version=version+1,updated_at=now() where id=rid;
    action_label:=case when yes_votes>=need then 'approved' else 'declined' end;
    note:='Board vote: '||yes_votes||' yes, '||no_votes||' no, of '||cardinality(eligible)||' voting members.';
    insert into public.cr_history(request_id,actor_email,action,note) values(rid,who,action_label,note);
   else
    update public.cr_requests set version=version+1,updated_at=now() where id=rid;
    select to_jsonb(q) into result from public.cr_requests q where id=rid;
    return result;
   end if;
   perform cr_private.queue_notice(rid,action_label);
   select to_jsonb(q) into result from public.cr_requests q where id=rid;
   return result;
  elsif p_action='duplicate' then
   if r.status not in ('submitted','board_review','needs_changes') then raise exception 'Only an open request can be closed as a duplicate.'; end if;
   if coalesce(staff_role,'') not in ('treasurer','secretary','manager','board') and r.owner_id<>uid then raise exception 'Board or admin access is required.'; end if;
   select * into dup from public.cr_requests where reference=(p_data->>'duplicate_of')::bigint;
   if dup.id is null or dup.id=rid then raise exception 'Enter the number of the request this one duplicates.'; end if;
   update public.cr_requests set status='declined',version=version+1,updated_at=now() where id=rid;
   action_label:='duplicate';
   note:='Duplicate of request #'||dup.reference||'.'||case when note<>'' then ' '||note else '' end;
  elsif p_action='paid' then
   if r.status<>'approved' then raise exception 'Approval is required before payment.'; end if;
   -- Nobody records their own payment. When the treasurer is the payee, an
   -- admin records it.
   if not (staff_role='treasurer' or (coalesce(staff_role,'') in ('secretary','manager') and exists(select 1 from public.cr_staff where email=r.email and role='treasurer'))) then
    raise exception 'Treasurer access is required to record payment.'; end if;
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
end $function$;


do $block$
declare definition text;
begin
 definition:=pg_get_functiondef('cr_private.queue_approval_reminders()'::regprocedure);
 definition:=replace(definition,'status=''submitted'' and on_behalf and approver_email is not null','status=''submitted'' and (on_behalf or routed_approval) and approver_email is not null');
 definition:=replace(definition,'status=''submitted'' and r.on_behalf and r.approver_email is not null','status=''submitted'' and (r.on_behalf or r.routed_approval) and r.approver_email is not null');
 if definition=pg_get_functiondef('cr_private.queue_approval_reminders()'::regprocedure) then
  raise exception 'Reminder query did not change';
 end if;
 execute definition;
end $block$;

do $block$
declare definition text;
begin
 definition:=pg_get_functiondef('public.cr_claim_notifications(text)'::regprocedure);
 definition:=replace(definition,'r.status = ''submitted''::text AND r.on_behalf AND r.approver_email = n.reminder_approver',
                                  'r.status = ''submitted''::text AND (r.on_behalf OR r.routed_approval) AND r.approver_email = n.reminder_approver');
 definition:=replace(definition,'r.status=''submitted'' and r.on_behalf and r.approver_email=n.reminder_approver',
                                  'r.status=''submitted'' and (r.on_behalf or r.routed_approval) and r.approver_email=n.reminder_approver');
 if definition=pg_get_functiondef('public.cr_claim_notifications(text)'::regprocedure) then
  raise exception 'Notification claim query did not change';
 end if;
 execute definition;
end $block$;
