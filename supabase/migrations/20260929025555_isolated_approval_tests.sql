-- An operator-created simulation follows the real review path, but never
-- broadcasts to the board, archives fake receipts, or records a payment.
create table cr_private.test_requests (
 request_id uuid primary key references public.cr_requests(id),
 recipient text not null check(recipient ~ '^[^[:space:]@,<>]+@[^[:space:]@,<>]+\.[^[:space:]@,<>]+$'),
 last_notice_version integer not null default 0
);
alter table cr_private.test_requests enable row level security;
revoke all on cr_private.test_requests from public,anon,authenticated;
create function cr_private.route_test_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare fixture cr_private.test_requests; r public.cr_requests;
begin
 select * into fixture from cr_private.test_requests where request_id=new.request_id for update;
 if not found then return new; end if;
 -- Do not generate an archive or daily reminder for a one-off simulation.
 if new.archive_snapshot is not null or new.reminder_approver is not null then return null; end if;
 select * into strict r from public.cr_requests where id=new.request_id;
 if fixture.last_notice_version>=r.version then return null; end if;
 update cr_private.test_requests set last_notice_version=r.version where request_id=r.id;
 new.channel:='email'; new.recipient:=fixture.recipient; new.recipients:=array[fixture.recipient];
 new.reply_to:=null; new.notice_snapshot:=null;
 new.subject:='TEST: RCAP request #'||r.reference||': '||case r.status when 'submitted' then 'your approval is needed' else replace(r.status,'_',' ') end;
 new.body:='TEST ONLY. This is a simulated request, not a real reimbursement.'||E'\n\n'||
  'Payee: '||r.payee||E'\nSimulated amount: '||to_char(r.total_cents/100.0,'FM$999,999,990.00')||
  E'\nEvent: '||r.event_name||E'\nStatus: '||replace(r.status,'_',' ')||E'\n\n'||
  case when r.status='submitted' then 'Open the link, sign in with your board cellphone number, and review the TEST request. You can approve or request changes to see the workflow.' else 'Your test decision has been recorded. This email demonstrates the confirmation after a decision.' end||
  E'\n\nhttps://wearercap.org/check-requests/#request/'||r.id||
  E'\n\nOnly you receive emails for this test. No board emails, receipt archives, or payment records will be created. No money is transferred.';
 return new;
end $$;
revoke all on function cr_private.route_test_notice() from public,anon,authenticated;
create trigger cr_route_test_notice before insert on public.cr_notifications for each row execute function cr_private.route_test_notice();
create function cr_private.block_test_payment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='paid' and exists(select 1 from cr_private.test_requests where request_id=new.id) then
  raise exception 'TEST request: recording a payment is disabled.';
 end if;
 return new;
end $$;
revoke all on function cr_private.block_test_payment() from public,anon,authenticated;
create trigger cr_block_test_payment before update on public.cr_requests for each row execute function cr_private.block_test_payment();
