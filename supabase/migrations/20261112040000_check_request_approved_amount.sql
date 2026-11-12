-- Adjustable approved amount for RCAP payment requests.
--
-- The requested total stays untouched. A separate approved amount records what
-- RCAP actually authorized:
--   * the assigned reviewer approves the full amount or a lower amount above
--     zero, with a reason when it is lower;
--   * a successful board vote approves the full requested amount;
--   * the treasurer and the committee's primary reviewer (the board liaison)
--     can correct it, with a reason, until payment is recorded;
--   * once payment is recorded the amount is locked.
-- Applies to reimbursements and direct vendor payments. Approval routing,
-- notification recipients and self-review restrictions are unchanged.
--
-- The live functions have drifted from the repository copies, so the function
-- changes are applied as exact, asserted text patches to the live definitions.
-- Any patch that does not match exactly once aborts the whole migration.

alter table public.cr_requests
  add column approved_cents bigint,
  add column approved_amount_reason text not null default '';

-- Backfill: every request already approved or paid was authorized for its full
-- requested total. Archived records are included, so the archive guard is
-- paused for this one statement. Version and updated_at are left alone.
alter table public.cr_requests disable trigger cr_guard_archived_request;
update public.cr_requests set approved_cents = total_cents
 where status in ('approved', 'paid') and approved_cents is null;
alter table public.cr_requests enable trigger cr_guard_archived_request;

alter table public.cr_requests
  add constraint cr_requests_approved_cents_check
    check (approved_cents is null or (approved_cents > 0 and approved_cents <= total_cents)),
  add constraint cr_requests_approved_amount_present
    check (status not in ('approved', 'paid') or approved_cents is not null),
  add constraint cr_requests_approved_reason_check
    check (length(approved_amount_reason) <= 500);

grant select (approved_cents, approved_amount_reason) on public.cr_requests to authenticated;

-- Hard lock, independent of the application path.
create function cr_private.lock_paid_amount() returns trigger
 language plpgsql set search_path to '' as $$
begin
 if old.status = 'paid' and (new.approved_cents is distinct from old.approved_cents
    or new.approved_amount_reason is distinct from old.approved_amount_reason) then
  raise exception 'Payment is recorded, so the approved amount is locked.';
 end if;
 return new;
end $$;
create trigger cr_lock_paid_amount before update on public.cr_requests
 for each row execute function cr_private.lock_paid_amount();

create function pg_temp.cr_patch(def text, old text, new text) returns text
 language plpgsql as $$
declare hits int := (length(def) - length(replace(def, old, ''))) / length(old);
begin
 if hits <> 1 then
  raise exception 'Patch expected exactly one match, found %: %', hits, left(old, 80);
 end if;
 return replace(def, old, new);
end $$;

do $mig$
declare def text;
begin
 ---------------------------------------------------------------- mutate
 def := pg_get_functiondef('cr_private.mutate(text,jsonb)'::regprocedure);

 def := pg_temp.cr_patch(def,
  $o$need int; owner_is_treasurer boolean;$o$,
  $n$need int; owner_is_treasurer boolean; new_cents bigint; reason text;$n$);

 -- A resubmitted request starts with no approved amount.
 def := pg_temp.cr_patch(def,
  $o$items=p_data->'items',total_cents=cents,$o$,
  $n$items=p_data->'items',total_cents=cents,approved_cents=null,approved_amount_reason='',$n$);

 -- Assigned reviewer: full amount by default, or lower with a reason.
 def := pg_temp.cr_patch(def,
  $o$update public.cr_requests set status=p_action,version=version+1,updated_at=now() where id=rid;$o$,
  $n$if p_action='approved' then
    new_cents:=r.total_cents; reason:='';
    if nullif(trim(coalesce(p_data->>'approved_cents','')),'') is not null then
     if p_data->>'approved_cents' !~ '^[0-9]{1,9}$' then raise exception 'Enter the approved amount in dollars and cents.'; end if;
     new_cents:=(p_data->>'approved_cents')::bigint;
    end if;
    if new_cents<=0 or new_cents>r.total_cents then raise exception 'The approved amount must be greater than zero and no more than the requested amount.'; end if;
    if new_cents<r.total_cents then
     reason:=trim(coalesce(p_data->>'amount_reason',''));
     if length(reason) not between 5 and 500 then raise exception 'Include a short reason for approving less than the requested amount.'; end if;
    end if;
   end if;
   update public.cr_requests set status=p_action,approved_cents=case when p_action='approved' then new_cents end,approved_amount_reason=case when p_action='approved' then reason else '' end,version=version+1,updated_at=now() where id=rid;$n$);

 def := pg_temp.cr_patch(def,
  $o$note:='Approved $'||to_char(r.total_cents::numeric/100,'FM999999990.00')||' payable to '||r.payee||'. '||note;$o$,
  $n$note:='Approved $'||to_char(new_cents::numeric/100,'FM999999990.00')||' payable to '||r.payee||'. '||case when new_cents<r.total_cents then 'Requested $'||to_char(r.total_cents::numeric/100,'FM999999990.00')||'. Reason for the lower amount: '||reason||case when right(reason,1) in ('.','!','?') then ' ' else '. ' end else '' end||note;$n$);

 -- A successful board vote approves the full requested amount.
 def := pg_temp.cr_patch(def,
  $o$update public.cr_requests set status=case when yes_votes>=need then 'approved' else 'declined' end,version=version+1,updated_at=now() where id=rid;$o$,
  $n$update public.cr_requests set status=case when yes_votes>=need then 'approved' else 'declined' end,approved_cents=case when yes_votes>=need then total_cents end,approved_amount_reason='',version=version+1,updated_at=now() where id=rid;$n$);

 -- Correction before payment: treasurer or the committee's primary reviewer.
 def := pg_temp.cr_patch(def,
  $o$elsif p_action='paid' then$o$,
  $n$elsif p_action='correct_amount' then
   if r.status='paid' then raise exception 'Payment is recorded, so the approved amount is locked.'; end if;
   if r.status<>'approved' then raise exception 'Only an approved, unpaid request can have its approved amount corrected.'; end if;
   -- The same person under another login is still the requester.
   if cr_private.is_contact(r.email) then raise exception 'You cannot review your own request.'; end if;
   if not (coalesce(staff_role,'')='treasurer' or exists(
     select 1 from public.cr_approval_routes ar
      where ar.committee=r.committee and ar.request_type=r.request_type
        and ar.approver_email is not null and cr_private.is_contact(ar.approver_email))) then
    raise exception 'Only the treasurer or the committee''s primary reviewer can correct the approved amount.'; end if;
   if coalesce(p_data->>'approved_cents','') !~ '^[0-9]{1,9}$' then raise exception 'Enter the approved amount in dollars and cents.'; end if;
   new_cents:=(p_data->>'approved_cents')::bigint;
   if new_cents<=0 or new_cents>r.total_cents then raise exception 'The approved amount must be greater than zero and no more than the requested amount.'; end if;
   if new_cents=r.approved_cents then raise exception 'Enter a different amount to correct the approved amount.'; end if;
   reason:=trim(coalesce(p_data->>'amount_reason',''));
   if length(reason) not between 5 and 500 then raise exception 'Include a short reason for the correction.'; end if;
   update public.cr_requests set approved_cents=new_cents,approved_amount_reason=reason,version=version+1,updated_at=now() where id=rid;
   action_label:='amount_corrected';
   note:='Approved amount corrected from $'||to_char(r.approved_cents::numeric/100,'FM999999990.00')||' to $'||to_char(new_cents::numeric/100,'FM999999990.00')||'. Requested $'||to_char(r.total_cents::numeric/100,'FM999999990.00')||'. Reason: '||reason;
  elsif p_action='paid' then$n$);

 execute def;

 ---------------------------------------------------------- queue_notice
 def := pg_get_functiondef('cr_private.queue_notice(uuid,text)'::regprocedure);

 -- A correction circulates to the same people who received the approval.
 def := pg_temp.cr_patch(def,
  $o$if p_action='approved' then$o$,
  $n$if p_action in ('approved','amount_corrected') then$n$);

 def := pg_temp.cr_patch(def,
  $o$when 'approved' then 'approved; payment is pending' when 'declined'$o$,
  $n$when 'approved' then case when r.approved_cents<r.total_cents then 'approved for '||to_char(r.approved_cents/100.0,'FM$999,999,990.00')||' of the '||to_char(r.total_cents/100.0,'FM$999,999,990.00')||' requested; payment is pending' else 'approved; payment is pending' end
  when 'amount_corrected' then 'updated. The approved amount is now '||to_char(r.approved_cents/100.0,'FM$999,999,990.00')||' of the '||to_char(r.total_cents/100.0,'FM$999,999,990.00')||' requested; payment is pending'
  when 'declined'$n$);

 def := pg_temp.cr_patch(def,
  $o$case when p_action='approved' then 'Approved amount: ' else 'Total requested: ' end||to_char(r.total_cents/100.0,'FM$999,999,990.00')||E'\n'||$o$,
  $n$case when r.status in ('approved','paid') then 'Approved amount: '||to_char(coalesce(r.approved_cents,r.total_cents)/100.0,'FM$999,999,990.00')||case when r.approved_cents<r.total_cents then E'\nRequested amount: '||to_char(r.total_cents/100.0,'FM$999,999,990.00')||case when r.approved_amount_reason<>'' then E'\nReason for the difference: '||r.approved_amount_reason else '' end else '' end else 'Total requested: '||to_char(r.total_cents/100.0,'FM$999,999,990.00') end||E'\n'||$n$);

 def := pg_temp.cr_patch(def,
  $o$case when p_action not in ('submitted','resubmitted','duplicate') and note is not null then$o$,
  $n$case when p_action='amount_corrected' then 'Corrected by: '||coalesce((select name from public.cr_staff where email=event->>'actor_email'),event->>'actor_email')||E'\nCorrected at: '||(event->>'created_at')||E'\nPayment has not been sent yet.\n' else '' end||
   case when p_action not in ('submitted','resubmitted','duplicate') and note is not null then$n$);

 def := pg_temp.cr_patch(def,
  $o$p_action in ('submitted','resubmitted','board_review','approved','withdrawn')$o$,
  $n$p_action in ('submitted','resubmitted','board_review','approved','amount_corrected','withdrawn')$n$);

 def := pg_temp.cr_patch(def,
  $o$(p_action='approved' and contact=any(board))$o$,
  $n$(p_action in ('approved','amount_corrected') and contact=any(board))$n$);

 -- The requester's text or short email carries the amount (in the label) and
 -- the reason whenever the approved amount differs or was corrected.
 def := pg_temp.cr_patch(def,
  $o$' has been '||label||E'.\nView details and notes: https://wearercap.org/check-requests/#request/'||r.id,$o$,
  $n$' has been '||label||'.'||case when (p_action='amount_corrected' or (p_action='approved' and r.approved_cents<r.total_cents)) and coalesce(r.approved_amount_reason,'')<>'' then E'\nReason: '||r.approved_amount_reason else '' end||E'\nView details and notes: https://wearercap.org/check-requests/#request/'||r.id,$n$);

 execute def;

 --------------------------------------------------------- queue_archive
 -- A corrected amount produces a fresh permanent record.
 def := pg_get_functiondef('cr_private.queue_archive()'::regprocedure);
 def := pg_temp.cr_patch(def,
  $o$('submitted','resubmitted','approved','declined','paid','needs_changes','duplicate','withdrawn')$o$,
  $n$('submitted','resubmitted','approved','amount_corrected','declined','paid','needs_changes','duplicate','withdrawn')$n$);
 execute def;

 ----------------------------------------------------- route_test_notice
 def := pg_get_functiondef('cr_private.route_test_notice()'::regprocedure);
 def := pg_temp.cr_patch(def,
  $o$E'\nSimulated amount: '||to_char(r.total_cents/100.0,'FM$999,999,990.00')||$o$,
  $n$E'\nSimulated amount: '||to_char(r.total_cents/100.0,'FM$999,999,990.00')||case when r.approved_cents is not null and r.approved_cents<r.total_cents then E'\nSimulated approved amount: '||to_char(r.approved_cents/100.0,'FM$999,999,990.00')||case when r.approved_amount_reason<>'' then E'\nReason: '||r.approved_amount_reason else '' end else '' end||$n$);
 execute def;

 ------------------------------------------------------- ledger_snapshot
 def := pg_get_functiondef('cr_private.ledger_snapshot(text)'::regprocedure);
 def := pg_temp.cr_patch(def,
  $o$'total_cents', r.total_cents, 'approver_email'$o$,
  $n$'total_cents', r.total_cents, 'approved_cents', r.approved_cents,
        'approved_amount_reason', r.approved_amount_reason, 'approver_email'$n$);
 execute def;
end $mig$;

drop function pg_temp.cr_patch(text, text, text);
