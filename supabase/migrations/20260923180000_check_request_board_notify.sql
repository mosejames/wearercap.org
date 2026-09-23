-- Check-request emails go to one board list, together, on one email.
--
-- Before: queue_notice() fanned out one private email per cr_staff member
-- (secretary, manager, and the treasurer role only after approval). Nobody
-- could see who else was told, and the Treasurer's own address was not on it.
--
-- After: every status change (submitted, resubmitted, assigned, approved,
-- declined, needs changes, paid) sends ONE email with every address in
-- cr_private.config.notify_to on the To line and Reply-To set to
-- cr_private.config.reply_to. Next year's board edits that row in the Supabase
-- table editor (schema cr_private, table config). No code change needed.
--
-- Unchanged: the requester's own notice (text or email, per their dashboard
-- preference), the assigned approver's notice when they are not on the list,
-- and the PDF archive to rcaparents+check-requests@.

create or replace function cr_private.valid_emails(p text[])
returns boolean language sql immutable set search_path to '' as $$
  select coalesce(bool_and(e ~ '^[^[:space:]@,<>]+@[^[:space:]@,<>]+\.[^[:space:]@,<>]+$'), true)
  from unnest(p) e;
$$;

alter table cr_private.config
  add column if not exists notify_to text[] not null default '{}',
  add column if not exists reply_to text;

alter table cr_private.config drop constraint if exists config_notify_to_valid;
alter table cr_private.config add constraint config_notify_to_valid
  check (cr_private.valid_emails(notify_to) and cardinality(notify_to) <= 20
         and (reply_to is null or cr_private.valid_emails(array[reply_to])));

comment on column cr_private.config.notify_to is
  'Everyone on the To line of every check-request email (one email, all addresses visible). Lowercase emails. Edit here to change who is notified.';
comment on column cr_private.config.reply_to is
  'Reply-To on board check-request emails, so replies land in the shared officers inbox.';

update cr_private.config set
  notify_to = array[
    'lemeri@abc-seniors.com',            -- Latasha Emeri, Treasurer
    'rcapfinance@ronclarkacademy.com',   -- RCAP Treasurer mailbox
    'rcaparents@ronclarkacademy.com',    -- RCAP Officers inbox
    'mose@mosejames.com'                 -- Mose James, Chair
  ],
  reply_to = 'rcaparents@ronclarkacademy.com'
where id;

alter table public.cr_notifications
  add column if not exists recipients text[],
  add column if not exists reply_to text,
  add column if not exists provider_id text,
  add column if not exists delivery_status text,
  add column if not exists delivery_checked_at timestamptz;

comment on column public.cr_notifications.recipients is
  'Set on board group emails: every address on the To line. recipient holds the same list as text.';
comment on column public.cr_notifications.provider_id is 'Resend email id.';
comment on column public.cr_notifications.delivery_status is
  'Resend last_event for group emails (delivered, bounced, ...), polled by check-request-notify.';

create or replace function cr_private.queue_notice(p_id uuid, p_action text)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare r public.cr_requests; target record; u auth.users; mode text; contact text;
 contacts text[]:='{}'; event jsonb; label text; board text[]; board_reply text; note text;
begin
 select * into strict r from public.cr_requests where id=p_id;
 select to_jsonb(h) into event from public.cr_history h where h.request_id=p_id order by h.created_at desc,h.id desc limit 1;
 select coalesce(notify_to,'{}'),reply_to into board,board_reply from cr_private.config where id;
 board:=coalesce(board,'{}');
 label:=case p_action when 'submitted' then 'received and awaiting review' when 'resubmitted' then 'updated and awaiting review' when 'assigned' then 'assigned to a board member for review' when 'approved' then 'reviewed and approved; payment is pending' when 'declined' then 'reviewed and declined' when 'needs_changes' then 'reviewed; changes are needed' when 'paid' then 'paid; payment has been recorded' else replace(p_action,'_',' ') end;

 -- 1. The board: one email, everyone on To.
 if cardinality(board)>0 then
  note:=nullif(trim(coalesce(event->>'note','')),'');
  insert into public.cr_notifications(request_id,recipient,recipients,reply_to,channel,subject,body)
  values(r.id,array_to_string(board,', '),board,board_reply,'email',
   'RCAP request #'||r.reference||': '||replace(p_action,'_',' '),
   'RCAP request #'||r.reference||' has been '||label||'.'||E'\n\n'||
   'Requester: '||r.requester_name||E'\n'||
   'Committee: '||r.committee||E'\n'||
   'Payable to: '||r.payee||E'\n'||
   'Total requested: '||to_char(r.total_cents/100.0,'FM$999,999,990.00')||E'\n'||
   'Purpose: '||r.purpose||E'\n'||
   case when p_action not in ('submitted','resubmitted') and note is not null then E'\nReviewer note: '||note||E'\n' else '' end||
   E'\nView details and reviewer notes: https://wearercap.org/check-requests/#request/'||r.id||E'\n\n'||
   'Sent to: '||array_to_string(board,', ')||'.'||
   case when board_reply is not null then E'\nReplies go to '||board_reply||'.' else '' end);
 end if;

 -- 2. The requester, the assigned approver, and the treasurer role after
 --    approval, each on their own channel. Staff already on the board list
 --    are skipped so nobody gets the same news twice.
 for target in
  select r.owner_id as uid, r.email as fallback, true as owner
  union select a.id,s.email,false from public.cr_staff s left join auth.users a on
   (a.phone_confirmed_at is not null and '+'||ltrim(a.phone,'+')=s.email) or (a.email_confirmed_at is not null and lower(a.email)=s.email)
   where (s.email=r.approver_email or (s.role='treasurer' and r.status in ('approved','paid')))
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
  -- The optional PDF email already provides a complete requester recap.
  if contact=r.archive_email and p_action<>'assigned' then continue; end if;
  insert into public.cr_notifications(request_id,recipient,channel,subject,body,notice_snapshot)
  values(r.id,contact,case when contact like '+%' then 'sms' else 'email' end,
   'RCAP request #'||r.reference||': '||replace(p_action,'_',' '),
   'RCAP request #'||r.reference||' has been '||label||E'.\nView details and reviewer notes: https://wearercap.org/check-requests/#request/'||r.id,
   case when contact not like '+%' and exists(select 1 from auth.users a where a.id=r.owner_id and lower(a.email)=contact and a.email_confirmed_at is not null)
   then jsonb_build_object('request',to_jsonb(r),'event',event,'history','[]'::jsonb) else null end);
 end loop;
end $function$;

-- Group emails Resend accepted in the last 3 days whose outcome is not final.
create or replace function public.cr_delivery_checks(p_secret text)
 returns table(id uuid, recipient text, provider_id text)
 language plpgsql security definer set search_path to ''
as $function$
begin
 if not exists(select 1 from cr_private.config c where c.dispatch_secret=p_secret) then raise exception 'Unauthorized'; end if;
 return query select n.id,n.recipient,n.provider_id from public.cr_notifications n
  where n.recipients is not null and n.state='sent' and n.provider_id is not null
    and n.sent_at>now()-interval '3 days'
    and coalesce(n.delivery_status,'') not in ('delivered','bounced','complained','failed','unavailable')
    and (n.delivery_checked_at is null or n.delivery_checked_at<now()-interval '4 minutes')
  order by n.sent_at limit 10;
end $function$;
revoke all on function public.cr_delivery_checks(text) from public, anon, authenticated;
grant execute on function public.cr_delivery_checks(text) to service_role;

-- Wake the sender for unsent rows, and for sent group emails still awaiting a
-- delivered/bounced verdict (the 2-minute cron already calls this).
create or replace function cr_private.dispatch()
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
 if exists(select 1 from public.cr_notifications where state<>'sent' and attempts<5)
  or exists(select 1 from public.cr_notifications where recipients is not null and state='sent' and provider_id is not null
     and sent_at>now()-interval '3 days' and coalesce(delivery_status,'') not in ('delivered','bounced','complained','failed','unavailable')
     and (delivery_checked_at is null or delivery_checked_at<now()-interval '4 minutes')) then
  perform net.http_post(url:='https://kcsrtwwpnekqdrfgcfys.supabase.co/functions/v1/check-request-notify',
   headers:=jsonb_build_object('Content-Type','application/json','x-cr-secret',(select dispatch_secret from cr_private.config where id)),body:='{}'::jsonb);
 end if;
end $function$;
