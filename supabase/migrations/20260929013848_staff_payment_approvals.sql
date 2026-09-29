-- Keep the preparer accountable without confusing them with the payment recipient.
alter table public.cr_requests add column on_behalf boolean not null default false;
alter table public.cr_requests add column payee_contact text not null default '';
alter table public.cr_requests add column event_name text not null default '';
create function cr_private.is_contact(p_contact text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=auth.uid() and
 ((email_confirmed_at is not null and lower(email)=p_contact) or
 (phone_confirmed_at is not null and '+'||ltrim(phone,'+')=p_contact)))
 or exists(select 1 from public.cr_staff a join public.cr_staff b on a.name=b.name where a.email=cr_private.email() and b.email=p_contact);
$$;
revoke all on function cr_private.is_contact(text) from public,anon,authenticated;
alter table public.cr_requests add column approval_recipients text[] not null default '{}';
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
   if coalesce(staff_role,'') not in ('secretary','treasurer','manager') then raise exception 'Staff access is required to prepare a request for someone else.'; end if;
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
  -- Personal requests retain treasurer review and the existing board-vote path.
  -- Staff preparing someone else's request must explicitly assign independent approval.
  chosen:=case when coalesce((p_data->>'on_behalf')::boolean,false) then nullif(lower(trim(p_data->>'approver_email')),'') else null end;
  if chosen is not null and (cr_private.is_contact(chosen) or chosen=lower(trim(p_data->>'payee_contact')) or not exists(select 1 from public.cr_staff where email=chosen)) then raise exception 'Choose an independent board member to approve this request.'; end if;
  owner_is_treasurer:=coalesce(staff_role='treasurer',false) and chosen is null;
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
  update public.cr_requests set approver_email=chosen,on_behalf=coalesce((p_data->>'on_behalf')::boolean,false),payee_contact=case when coalesce((p_data->>'on_behalf')::boolean,false) then lower(trim(p_data->>'payee_contact')) else '' end,event_name=trim(coalesce(p_data->>'event_name','')) where id=rid;
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
   if r.on_behalf and r.approver_email is not null then
    if who is distinct from r.approver_email then raise exception 'Only the assigned board member can approve or decline.'; end if;
   elsif staff_role is distinct from 'treasurer' then raise exception 'Only the treasurer can approve or decline.'; end if;
   if p_action='declined' and length(note)<5 then raise exception 'Include a reason so the requester knows what to do.'; end if;
   update public.cr_requests set status=p_action,version=version+1,updated_at=now() where id=rid;
   action_label:=p_action;
   if p_action='approved' then note:='Approved $'||to_char(r.total_cents::numeric/100,'FM999999990.00')||' payable to '||r.payee||'. '||note; end if;
  elsif p_action='needs_changes' then
   if r.status not in ('submitted','board_review') then raise exception 'Only an open request can be sent back.'; end if;
   if (not r.on_behalf or who is distinct from r.approver_email) and coalesce(staff_role,'') not in ('treasurer','secretary','manager') then raise exception 'Treasurer or admin access is required.'; end if;
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

create or replace function cr_private.queue_notice(p_id uuid, p_action text)
 returns void language plpgsql security definer set search_path to ''
as $function$
declare r public.cr_requests; target record; u auth.users; mode text; contact text;
 contacts text[]:='{}'; event jsonb; label text; board text[]; board_reply text; note text;
begin
 select * into strict r from public.cr_requests where id=p_id;
 select to_jsonb(h) into event from public.cr_history h where h.request_id=p_id order by h.created_at desc,h.id desc limit 1;
 select coalesce(notify_to,'{}'),reply_to into board,board_reply from cr_private.config where id;
 board:=coalesce(board,'{}');
 -- Approval circulation includes the configured board, verified requester email,
 -- and staff-selected committee contacts. No receipt or payment credentials are attached.
 if p_action='approved' then
  board:=board||r.approval_recipients||array(select lower(email) from auth.users where id=r.owner_id and email_confirmed_at is not null and nullif(email,'') is not null);
  if r.on_behalf and r.payee_contact like '%@%' then board:=array_append(board,r.payee_contact); end if;
 end if;
 board:=array(select distinct lower(trim(e)) from unnest(board) e where nullif(trim(e),'') is not null order by 1);
 note:=nullif(trim(coalesce(event->>'note','')),'');
 label:=case p_action when 'submitted' then case when r.status='board_review' then 'received and sent to a board vote' when r.approver_email is not null then 'received and awaiting the assigned board member''s approval' else 'received and awaiting the treasurer''s review' end
  when 'resubmitted' then 'updated and awaiting review'
  when 'board_review' then 'sent to the board for a vote'
  when 'approved' then 'approved; payment is pending' when 'declined' then 'reviewed and declined'
  when 'needs_changes' then 'reviewed; changes are needed' when 'paid' then 'paid; payment has been recorded'
  when 'duplicate' then 'closed as a duplicate. '||coalesce(note,'')||' Nothing more is needed on this one'
  else replace(p_action,'_',' ') end;

 if cardinality(board)>0 then
  insert into public.cr_notifications(request_id,recipient,recipients,reply_to,channel,subject,body)
  values(r.id,array_to_string(board,', '),board,board_reply,'email',
   case when r.approver_email is not null and p_action in ('submitted','resubmitted') then 'Approval requested: RCAP #'||r.reference else 'RCAP request #'||r.reference||': '||replace(p_action,'_',' ') end,
   'RCAP request #'||r.reference||' has been '||label||'.'||E'\n\n'||
   case when r.on_behalf then 'Prepared by: ' else 'Requester: ' end||r.requester_name||E'\n'||
   case when r.event_name<>'' then 'Event: '||r.event_name||E'\n' else '' end||
   'Committee: '||r.committee||E'\n'||
   'Payable to: '||r.payee||E'\n'||
   case when p_action='approved' then 'Approved amount: ' else 'Total requested: ' end||to_char(r.total_cents/100.0,'FM$999,999,990.00')||E'\n'||
   'Purpose: '||r.purpose||E'\n'||
   case when p_action='approved' then 'Approved by: '||case when note like 'Board vote:%' then 'Board vote' else coalesce((select name from public.cr_staff where email=event->>'actor_email'),event->>'actor_email') end||E'\nApproved at: '||(event->>'created_at')||E'\nApproval authorizes payment. It does not mean payment has been sent.\n' else '' end||
   case when p_action not in ('submitted','resubmitted','duplicate') and note is not null then E'\nNote: '||note||E'\n' else '' end||
   E'\nView record (authorized accounts only): https://wearercap.org/check-requests/#request/'||r.id||E'\n\n'||
   'Sent to: '||array_to_string(board,', ')||'.'||
   case when board_reply is not null then E'\nReplies go to '||board_reply||'.' else '' end);
 end if;

 for target in
  select r.owner_id as uid, r.email as fallback, true as owner
  union select a.id,s.email,false from public.cr_staff s left join auth.users a on
   (a.phone_confirmed_at is not null and '+'||ltrim(a.phone,'+')=s.email) or (a.email_confirmed_at is not null and lower(a.email)=s.email)
   where (s.email=r.approver_email or (s.role='treasurer' and p_action in ('submitted','resubmitted','board_review','approved'))
          or (s.role in ('board','treasurer') and r.status='board_review'))
     and s.email<>r.email and s.name not in (select name from public.cr_staff where email=r.email)
     and not (s.email = any(board))
 loop
  select * into u from auth.users where id=target.uid;
  select channel into mode from public.cr_notification_preferences where user_id=target.uid;
  mode:=coalesce(mode,case when u.phone_confirmed_at is not null and nullif(u.phone,'') is not null then 'sms' else 'email' end);
  if u.id is null then
   if target.owner or not (target.fallback = any(board)) then contacts:=array_append(contacts,target.fallback); end if;
  else
   if mode in ('sms','both') and u.phone_confirmed_at is not null and nullif(u.phone,'') is not null then contacts:=array_append(contacts,'+'||ltrim(u.phone,'+')); end if;
   if mode in ('email','both') and u.email_confirmed_at is not null and nullif(u.email,'') is not null
      and (target.owner or not (lower(u.email) = any(board))) then contacts:=array_append(contacts,lower(u.email)); end if;
  end if;
 end loop;
 for contact in select distinct unnest(contacts) loop
  if contact=r.archive_email or (p_action='approved' and contact=any(board)) then continue; end if;
  insert into public.cr_notifications(request_id,recipient,channel,subject,body,notice_snapshot)
  values(r.id,contact,case when contact like '+%' then 'sms' else 'email' end,
   case when r.approver_email is not null and p_action in ('submitted','resubmitted') then 'Approval requested: RCAP #'||r.reference else 'RCAP request #'||r.reference||': '||replace(p_action,'_',' ') end,
   'RCAP request #'||r.reference||' has been '||label||E'.\nView details and notes: https://wearercap.org/check-requests/#request/'||r.id,
   case when contact not like '+%' and exists(select 1 from auth.users a where a.id=r.owner_id and lower(a.email)=contact and a.email_confirmed_at is not null)
   then jsonb_build_object('request',to_jsonb(r),'event',event,'history','[]'::jsonb) else null end);
 end loop;
end $function$;

-- A single daily reminder per assigned reviewer and destination, not per expense.
alter table public.cr_notifications add column reminder_approver text;
alter table public.cr_notifications add column reminder_day date;
alter table public.cr_notifications drop constraint cr_notifications_state_check;
alter table public.cr_notifications add constraint cr_notifications_state_check check(state in ('pending','sending','sent','failed','cancelled'));
create unique index cr_daily_reminder_once on public.cr_notifications(reminder_approver,reminder_day,recipient) where reminder_approver is not null;
create function cr_private.queue_approval_reminders() returns void language plpgsql security definer set search_path='' as $$
declare reviewer record; u auth.users; mode text; contact text; contacts text[];
begin
 perform pg_advisory_xact_lock(hashtextextended('cr_daily_approval_reminders',0));
 for reviewer in
  select approver_email, (array_agg(id order by created_at))[1] as request_id
  from public.cr_requests where status='submitted' and on_behalf and approver_email is not null and updated_at<now()-interval '24 hours'
  group by approver_email
 loop
  contacts:='{}';
  select * into u from auth.users where
   (email_confirmed_at is not null and lower(email)=reviewer.approver_email) or
   (phone_confirmed_at is not null and '+'||ltrim(phone,'+')=reviewer.approver_email)
   order by created_at limit 1;
  select channel into mode from public.cr_notification_preferences where user_id=u.id;
  mode:=coalesce(mode,case when u.phone_confirmed_at is not null and nullif(u.phone,'') is not null then 'sms' else 'email' end);
  if u.id is null then contacts:=array_append(contacts,reviewer.approver_email);
  else
   if mode in ('sms','both') and u.phone_confirmed_at is not null and nullif(u.phone,'') is not null then contacts:=array_append(contacts,'+'||ltrim(u.phone,'+')); end if;
   if mode in ('email','both') and u.email_confirmed_at is not null and nullif(u.email,'') is not null then contacts:=array_append(contacts,lower(u.email)); end if;
  end if;
  for contact in select distinct unnest(contacts) loop
   insert into public.cr_notifications(request_id,recipient,channel,subject,body,reminder_approver,reminder_day)
   values(reviewer.request_id,contact,case when contact like '+%' then 'sms' else 'email' end,
    'RCAP: your approval is needed',
    'You have RCAP payment requests awaiting your approval. Review receipts and approve or request changes: https://wearercap.org/check-requests/#approvals',
    reviewer.approver_email,(now() at time zone 'America/New_York')::date)
   on conflict do nothing;
  end loop;
 end loop;
end $$;
revoke all on function cr_private.queue_approval_reminders() from public,anon,authenticated;
-- Check local time so daylight saving changes do not move the reminder hour.
select cron.schedule('rcap-daily-approval-reminder','0 * * * *',
 $job$do $run$ begin if extract(hour from now() at time zone 'America/New_York')=10 then perform cr_private.queue_approval_reminders(); end if; end $run$;$job$);
create or replace function public.cr_claim_notifications(p_secret text) returns setof public.cr_notifications language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from cr_private.config where dispatch_secret=p_secret) then raise exception 'Unauthorized'; end if;
 -- A decision or reassignment made before a retry must stop the old reminder.
 update public.cr_notifications n set state='cancelled' where reminder_approver is not null
 and (state in ('pending','failed') or (state='sending' and locked_at<now()-interval '5 minutes'))
 and (reminder_day<(now() at time zone 'America/New_York')::date or not exists(
  select 1 from public.cr_requests r where r.status='submitted' and r.on_behalf and r.approver_email=n.reminder_approver));
 return query update public.cr_notifications set state='sending',locked_at=now(),attempts=attempts+1 where id in (
  select id from public.cr_notifications where attempts<5 and (state in ('pending','failed') or (state='sending' and locked_at<now()-interval '5 minutes'))
  order by created_at for update skip locked limit 3
 ) returning *;
end $$;
