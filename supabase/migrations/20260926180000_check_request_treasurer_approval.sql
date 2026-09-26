-- Treasurer-led approvals, board votes, and duplicates (Sept 26, 2026).
--
-- Board decision (Mose, Sept 26): the treasurer approves every request and is
-- the overseeing board member; nobody is "assigned" anymore. The treasurer can
-- send a request to the board for a vote; board members (role 'board', plus the
-- treasurer) vote in the app and a majority of eligible voters decides. Admins
-- (secretary, manager) watch and can send requests back or close duplicates but
-- do not approve or vote. A treasurer's own request goes to a board vote
-- automatically, since nobody reviews their own request.
--
-- Voters are counted by staff name, not login, because one person can hold two
-- logins (cellphone and email). The requester never counts as a voter.

alter table public.cr_staff drop constraint cr_staff_role_check;
alter table public.cr_staff add constraint cr_staff_role_check
  check (role = any (array['secretary','treasurer','approver','manager','board']));

alter table public.cr_requests drop constraint cr_requests_status_check;
alter table public.cr_requests add constraint cr_requests_status_check
  check (status = any (array['submitted','board_review','needs_changes','approved','declined','paid']));

create or replace function cr_private.can_read(p_id uuid)
 returns boolean language sql stable security definer set search_path to ''
as $function$
 select auth.uid() is not null and exists(select 1 from public.cr_requests where id=p_id and
  (owner_id=auth.uid() or approver_email=cr_private.email() or cr_private.role() in ('secretary','treasurer','manager','board')));
$function$;

-- Names of the people who may vote on a request: board members and the
-- treasurer, minus whoever submitted it.
create or replace function cr_private.voters(p_id uuid)
 returns text[] language sql stable security definer set search_path to ''
as $function$
 select coalesce(array_agg(distinct s.name order by s.name),'{}')
 from public.cr_staff s, public.cr_requests r
 where r.id=p_id and s.role in ('board','treasurer')
   and s.name not in (select name from public.cr_staff where email=r.email);
$function$;

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
  -- The treasurer reviews every request, so there is no reviewer to choose.
  owner_is_treasurer:=coalesce(staff_role='treasurer',false);
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
  update public.cr_requests set request_type=p_data->>'request_type',budget_confirmed=true where id=rid;
  update public.cr_requests set archive_email=lower(trim(coalesce(p_data->>'archive_email',''))) where id=rid;
  insert into public.cr_history(request_id,actor_email,action,note) values(rid,who,action_label,
   case when p_data->>'request_type'='vendor' then 'Invoice attached; requester confirmed expense is within budget and invoice remains unpaid.'
   else 'Paid receipts attached; requester confirmed expense is within budget, reimbursable items are identified, and payment is complete.' end
   ||case when owner_is_treasurer then ' Submitted by the treasurer, so it goes to a board vote.' else ' Treasurer approval required.' end);
 else
  if r.id is null or not cr_private.can_read(rid) then raise exception 'Request not found.'; end if;
  if (p_data->>'version')::integer is distinct from r.version then raise exception 'This request changed. Refresh and try again.'; end if;
  note:=trim(coalesce(p_data->>'note',''));
  if length(note)>2000 then raise exception 'Keep the note under 2,000 characters.'; end if;
  if r.owner_id=uid and p_action<>'duplicate' then raise exception 'You cannot review your own request.'; end if;
  if p_action in ('approved','declined') then
   if r.status<>'submitted' then raise exception 'Only a request awaiting the treasurer can be approved or declined here.'; end if;
   if staff_role is distinct from 'treasurer' then raise exception 'Only the treasurer can approve or decline.'; end if;
   if p_action='declined' and length(note)<5 then raise exception 'Include a reason so the requester knows what to do.'; end if;
   update public.cr_requests set status=p_action,version=version+1,updated_at=now() where id=rid;
   action_label:=p_action;
  elsif p_action='needs_changes' then
   if r.status not in ('submitted','board_review') then raise exception 'Only an open request can be sent back.'; end if;
   if coalesce(staff_role,'') not in ('treasurer','secretary','manager') then raise exception 'Treasurer or admin access is required.'; end if;
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
 note:=nullif(trim(coalesce(event->>'note','')),'');
 label:=case p_action when 'submitted' then case when r.status='board_review' then 'received and sent to a board vote' else 'received and awaiting the treasurer''s review' end
  when 'resubmitted' then 'updated and awaiting review'
  when 'board_review' then 'sent to the board for a vote'
  when 'approved' then 'approved; payment is pending' when 'declined' then 'reviewed and declined'
  when 'needs_changes' then 'reviewed; changes are needed' when 'paid' then 'paid; payment has been recorded'
  when 'duplicate' then 'closed as a duplicate. '||coalesce(note,'')||' Nothing more is needed on this one'
  else replace(p_action,'_',' ') end;

 if cardinality(board)>0 then
  insert into public.cr_notifications(request_id,recipient,recipients,reply_to,channel,subject,body)
  values(r.id,array_to_string(board,', '),board,board_reply,'email',
   'RCAP request #'||r.reference||': '||replace(p_action,'_',' '),
   'RCAP request #'||r.reference||' has been '||label||'.'||E'\n\n'||
   'Requester: '||r.requester_name||E'\n'||
   'Committee: '||r.committee||E'\n'||
   'Payable to: '||r.payee||E'\n'||
   'Total requested: '||to_char(r.total_cents/100.0,'FM$999,999,990.00')||E'\n'||
   'Purpose: '||r.purpose||E'\n'||
   case when p_action not in ('submitted','resubmitted','duplicate') and note is not null then E'\nNote: '||note||E'\n' else '' end||
   E'\nView details and receipts: https://wearercap.org/check-requests/#request/'||r.id||E'\n\n'||
   'Sent to: '||array_to_string(board,', ')||'.'||
   case when board_reply is not null then E'\nReplies go to '||board_reply||'.' else '' end);
 end if;

 for target in
  select r.owner_id as uid, r.email as fallback, true as owner
  union select a.id,s.email,false from public.cr_staff s left join auth.users a on
   (a.phone_confirmed_at is not null and '+'||ltrim(a.phone,'+')=s.email) or (a.email_confirmed_at is not null and lower(a.email)=s.email)
   where ((s.role='treasurer' and p_action in ('submitted','resubmitted','board_review','approved'))
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
  if contact=r.archive_email then continue; end if;
  insert into public.cr_notifications(request_id,recipient,channel,subject,body,notice_snapshot)
  values(r.id,contact,case when contact like '+%' then 'sms' else 'email' end,
   'RCAP request #'||r.reference||': '||replace(p_action,'_',' '),
   'RCAP request #'||r.reference||' has been '||label||E'.\nView details and notes: https://wearercap.org/check-requests/#request/'||r.id,
   case when contact not like '+%' and exists(select 1 from auth.users a where a.id=r.owner_id and lower(a.email)=contact and a.email_confirmed_at is not null)
   then jsonb_build_object('request',to_jsonb(r),'event',event,'history','[]'::jsonb) else null end);
 end loop;
end $function$;

create or replace function cr_private.queue_archive()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
declare r public.cr_requests; snapshot jsonb;
begin
 if new.action not in ('submitted','resubmitted','approved','declined','paid','needs_changes','duplicate') then return new; end if;
 select * into strict r from public.cr_requests where id=new.request_id;
 snapshot := jsonb_build_object('request',to_jsonb(r),'event',to_jsonb(new),'history',
  (select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at,h.id),'[]'::jsonb) from public.cr_history h where h.request_id=r.id));
 insert into public.cr_notifications(request_id,recipient,channel,subject,body,archive_snapshot)
 values(r.id,'rcaparents+check-requests@ronclarkacademy.com','email',
 'RCAP archive #'||r.reference||': '||replace(new.action,'_',' '),
 'Attached is the permanent request record and its receipts. Save all numbered parts to the RCAP Google Drive archive. This email does not mean payment has been issued; see the status in the PDF.',snapshot);
 if r.archive_email <> '' and r.archive_email <> 'rcaparents+check-requests@ronclarkacademy.com' then
 insert into public.cr_notifications(request_id,recipient,channel,subject,body,archive_snapshot)
 values(r.id,r.archive_email,'email','Your RCAP request #'||r.reference||': '||replace(new.action,'_',' '),
 'Attached is your request record and receipts. Keep all numbered parts for your records.',snapshot);
 end if;
 return new;
end $function$;

drop policy cr_notification_read on public.cr_notifications;
create policy cr_notification_read on public.cr_notifications for select to authenticated using(
 cr_private.can_read(request_id) and (archive_snapshot is not null or notice_snapshot is not null or recipient=cr_private.email()
  or cr_private.role() in ('secretary','treasurer','manager','board')));

revoke all on function cr_private.voters(uuid) from public, anon, authenticated;
