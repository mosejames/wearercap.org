-- Correct the reviewer on a submitted request without changing future routing.
-- Keep the correction and both notifications in one transaction.
create function cr_private.queue_reviewer_message(p_id uuid, p_contact text, p_subject text, p_body text)
returns void language plpgsql security definer set search_path='' as $$
declare u auth.users; mode text; destination text; destinations text[]:='{}';
begin
 if p_contact is null then return; end if;
 select * into u from auth.users where
  (email_confirmed_at is not null and lower(email)=p_contact) or
  (phone_confirmed_at is not null and '+'||ltrim(phone,'+')=p_contact)
 order by created_at limit 1;
 if u.id is null then
  destinations:=array[p_contact];
 else
  select channel into mode from public.cr_notification_preferences where user_id=u.id;
  mode:=coalesce(mode,case when u.phone_confirmed_at is not null and nullif(u.phone,'') is not null then 'sms' else 'email' end);
  if mode in ('sms','both') and u.phone_confirmed_at is not null and nullif(u.phone,'') is not null then
   destinations:=array_append(destinations,'+'||ltrim(u.phone,'+'));
  end if;
  if mode in ('email','both') and u.email_confirmed_at is not null and nullif(u.email,'') is not null then
   destinations:=array_append(destinations,lower(u.email));
  end if;
 end if;
 for destination in select distinct unnest(destinations) loop
  insert into public.cr_notifications(request_id,recipient,channel,subject,body)
  values(p_id,destination,case when destination like '+%' then 'sms' else 'email' end,p_subject,p_body);
 end loop;
end $$;
revoke all on function cr_private.queue_reviewer_message(uuid,text,text,text) from public,anon,authenticated;

create function cr_private.reassign_approver(p_id uuid,p_version integer,p_approver text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); who text:=cr_private.email(); staff_role text:=cr_private.role();
 r public.cr_requests; chosen text:=nullif(lower(trim(coalesce(p_approver,''))),'');
 old_contact text; old_name text; new_name text; owner_name text; payee_name text;
 reason text:=trim(coalesce(p_reason,'')); old_label text; new_label text; prior_contact text;
begin
 if uid is null or who is null then raise exception 'Sign in to change an approver.'; end if;
 if coalesce(staff_role,'') not in ('treasurer','secretary','manager') then raise exception 'Finance admin access is required.'; end if;
 if length(reason) not between 5 and 500 then raise exception 'Give a short reason for changing the approver.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into r from public.cr_requests where id=p_id for update;
 if r.id is null or not cr_private.can_read(p_id) then raise exception 'Request not found.'; end if;
 if r.version is distinct from p_version then raise exception 'This request changed. Refresh and try again.'; end if;
 if r.status<>'submitted' or r.archived_at is not null then raise exception 'Only an open request awaiting approval can be reassigned.'; end if;
 old_contact:=case when r.on_behalf or r.routed_approval then r.approver_email else null end;
 if chosen is not distinct from old_contact then raise exception 'Choose a different approver.'; end if;
 select name into owner_name from public.cr_staff where email=r.email;
 select name into payee_name from public.cr_staff where email=r.payee_contact;
 if chosen is null then
  if r.on_behalf or exists(select 1 from public.cr_staff s where s.role='treasurer' and s.name=owner_name) then
   raise exception 'This request needs an independent named reviewer.';
  end if;
 else
  select name into new_name from public.cr_staff where email=chosen and role in ('board','treasurer','secretary','manager');
  if new_name is null then raise exception 'Choose a board reviewer with access.'; end if;
  if chosen=r.email or chosen=r.payee_contact or new_name=owner_name or (r.on_behalf and new_name=payee_name) or
   exists(select 1 from auth.users u where u.id=r.owner_id and
     ((u.email_confirmed_at is not null and lower(u.email)=chosen) or
      (u.phone_confirmed_at is not null and '+'||ltrim(u.phone,'+')=chosen))) then
   raise exception 'The requester or payee cannot approve this request.';
  end if;
 end if;
 select name into old_name from public.cr_staff where email=old_contact;
 if old_name is not null and old_name=new_name then raise exception 'This person is already the approver.'; end if;
 if old_contact is null and exists(select 1 from public.cr_staff where role='treasurer' and name=new_name) then
  raise exception 'This request is already awaiting the treasurer.';
 end if;
 old_label:=coalesce(old_name,'the treasurer');
 new_label:=coalesce(new_name,'the treasurer');
 update public.cr_requests set approver_email=chosen,
  routed_approval=(chosen is not null and not on_behalf),version=version+1,updated_at=now() where id=p_id;
 insert into public.cr_history(request_id,actor_email,action,note)
 values(p_id,who,'reassigned','Approver changed from '||old_label||' to '||new_label||'. Reason: '||reason);
 -- A stale reminder for the former reviewer must not be dispatched later.
 update public.cr_notifications set state='cancelled' where request_id=p_id
  and reminder_approver=old_contact and state in ('pending','failed');
 if old_contact is null then
  for prior_contact in select distinct on (name) email from public.cr_staff where role='treasurer'
    order by name,(email like '+%') desc,email loop
   perform cr_private.queue_reviewer_message(p_id,prior_contact,
   'RCAP #'||r.reference||': approval reassigned',
    'RCAP request #'||r.reference||' is now assigned to '||new_label||'. You no longer need to approve it.');
  end loop;
 else
  perform cr_private.queue_reviewer_message(p_id,old_contact,
   'RCAP #'||r.reference||': approval reassigned',
   'RCAP request #'||r.reference||' is now assigned to '||new_label||'. You no longer need to approve it.');
 end if;
 if chosen is not null then
  perform cr_private.queue_reviewer_message(p_id,chosen,
   'Approval requested: RCAP #'||r.reference,
   'RCAP request #'||r.reference||' is now assigned to you. Review the amount and receipts, then approve or request changes.'||E'\nView request: https://wearercap.org/check-requests/#request/'||p_id);
 else
  for prior_contact in select distinct on (name) email from public.cr_staff where role='treasurer'
    order by name,(email like '+%') desc,email loop
   perform cr_private.queue_reviewer_message(p_id,prior_contact,
    'Approval requested: RCAP #'||r.reference,
    'RCAP request #'||r.reference||' is awaiting your treasurer review.'||E'\nView request: https://wearercap.org/check-requests/#request/'||p_id);
  end loop;
 end if;
 return (select to_jsonb(q) from public.cr_requests q where q.id=p_id);
end $$;
revoke all on function cr_private.reassign_approver(uuid,integer,text,text) from public,anon,authenticated;

create function public.cr_reassign_approver(p_id uuid,p_version integer,p_approver text,p_reason text)
returns jsonb language sql security invoker set search_path='' as $$
 select cr_private.reassign_approver(p_id,p_version,p_approver,p_reason);
$$;
revoke all on function public.cr_reassign_approver(uuid,integer,text,text) from public,anon;
grant execute on function public.cr_reassign_approver(uuid,integer,text,text) to authenticated;
grant execute on function cr_private.reassign_approver(uuid,integer,text,text) to authenticated;
