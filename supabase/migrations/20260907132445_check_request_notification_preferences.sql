create table public.cr_notification_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 channel text not null check(channel in ('sms','email','both')),
 updated_at timestamptz not null default now()
);
alter table public.cr_notification_preferences enable row level security;
revoke all on public.cr_notification_preferences from anon,authenticated;
grant select on public.cr_notification_preferences to authenticated;
create policy cr_preferences_read on public.cr_notification_preferences for select to authenticated using(user_id=(select auth.uid()));
create function public.cr_notification_preference(p_channel text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare u auth.users; mode text;
begin
 if auth.uid() is null then raise exception 'Sign in first.'; end if;
 select * into strict u from auth.users where id=auth.uid();
 if p_channel is not null then
  if p_channel not in ('sms','email','both') then raise exception 'Choose text, email, or both.'; end if;
  if p_channel in ('sms','both') and (u.phone_confirmed_at is null or nullif(u.phone,'') is null) then raise exception 'Verify a cellphone number before choosing text updates.'; end if;
  if p_channel in ('email','both') and (u.email_confirmed_at is null or nullif(u.email,'') is null) then raise exception 'Add and verify your backup email before choosing email updates.'; end if;
  insert into public.cr_notification_preferences(user_id,channel) values(u.id,p_channel) on conflict(user_id) do update set channel=excluded.channel,updated_at=now();
 end if;
 select channel into mode from public.cr_notification_preferences where user_id=u.id;
 return jsonb_build_object('channel',coalesce(mode,case when u.phone_confirmed_at is not null and nullif(u.phone,'') is not null then 'sms' else 'email' end));
end $$;
revoke all on function public.cr_notification_preference(text) from public,anon;
grant execute on function public.cr_notification_preference(text) to authenticated;
alter table public.cr_notifications add column notice_snapshot jsonb;
create or replace function cr_private.queue_notice(p_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare r public.cr_requests; target record; u auth.users; mode text; contact text; contacts text[]:='{}'; event jsonb; label text;
begin
 select * into strict r from public.cr_requests where id=p_id;
 select to_jsonb(h) into event from public.cr_history h where h.request_id=p_id order by h.created_at desc,h.id desc limit 1;
 label:=case p_action when 'submitted' then 'received and awaiting review' when 'resubmitted' then 'updated and awaiting review' when 'assigned' then 'assigned to a board member for review' when 'approved' then 'reviewed and approved; payment is pending' when 'declined' then 'reviewed and declined' when 'needs_changes' then 'reviewed; changes are needed' when 'paid' then 'paid; payment has been recorded' else replace(p_action,'_',' ') end;
 for target in
  select r.owner_id as uid, r.email as fallback
  union select a.id,s.email from public.cr_staff s left join auth.users a on
   (a.phone_confirmed_at is not null and '+'||ltrim(a.phone,'+')=s.email) or (a.email_confirmed_at is not null and lower(a.email)=s.email)
   where s.role in ('secretary','manager') or s.email=r.approver_email or (s.role='treasurer' and r.status in ('approved','paid'))
 loop
  select * into u from auth.users where id=target.uid;
  select channel into mode from public.cr_notification_preferences where user_id=target.uid;
  mode:=coalesce(mode,case when u.phone_confirmed_at is not null and nullif(u.phone,'') is not null then 'sms' else 'email' end);
  if u.id is null then contacts:=array_append(contacts,target.fallback);
  else
   if mode in ('sms','both') and u.phone_confirmed_at is not null and nullif(u.phone,'') is not null then contacts:=array_append(contacts,'+'||ltrim(u.phone,'+')); end if;
   if mode in ('email','both') and u.email_confirmed_at is not null and nullif(u.email,'') is not null then contacts:=array_append(contacts,lower(u.email)); end if;
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
end $$;
drop policy cr_notification_read on public.cr_notifications;
create policy cr_notification_read on public.cr_notifications for select to authenticated
using(cr_private.can_read(request_id) and (archive_snapshot is not null or notice_snapshot is not null or recipient=cr_private.email() or cr_private.role() in ('secretary','treasurer','manager')));
