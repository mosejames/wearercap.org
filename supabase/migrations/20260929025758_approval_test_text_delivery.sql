alter table cr_private.test_requests drop constraint test_requests_recipient_check;
alter table cr_private.test_requests add constraint test_requests_recipient_check check(recipient ~ '^\+1[0-9]{10}$' or recipient ~ '^[^[:space:]@,<>]+@[^[:space:]@,<>]+\.[^[:space:]@,<>]+$');
create or replace function cr_private.route_test_notice() returns trigger language plpgsql security definer set search_path='' as $$
declare fixture cr_private.test_requests; r public.cr_requests;
begin
 select * into fixture from cr_private.test_requests where request_id=new.request_id for update;
 if not found then return new; end if;
 -- Do not generate an archive or daily reminder for a one-off simulation.
 if new.archive_snapshot is not null or new.reminder_approver is not null then return null; end if;
 select * into strict r from public.cr_requests where id=new.request_id;
 if fixture.last_notice_version>=r.version then return null; end if;
 update cr_private.test_requests set last_notice_version=r.version where request_id=r.id;
 new.channel:=case when fixture.recipient like '+%' then 'sms' else 'email' end;
 new.recipient:=fixture.recipient; new.recipients:=case when new.channel='email' then array[fixture.recipient] else null end;
 new.reply_to:=null; new.notice_snapshot:=null;
 new.subject:='TEST: RCAP request #'||r.reference||': '||case r.status when 'submitted' then 'your approval is needed' else replace(r.status,'_',' ') end;
 new.body:='TEST ONLY. This is a simulated request, not a real reimbursement.'||E'\n\n'||
  'Payee: '||r.payee||E'\nSimulated amount: '||to_char(r.total_cents/100.0,'FM$999,999,990.00')||
  E'\nEvent: '||r.event_name||E'\nStatus: '||replace(r.status,'_',' ')||E'\n\n'||
  case when r.status='submitted' then 'Open the link, sign in with your board cellphone number, and review the TEST request. You can approve or request changes to see the workflow.' else 'Your test decision has been recorded. This email demonstrates the confirmation after a decision.' end||
  E'\n\nhttps://wearercap.org/check-requests/#request/'||r.id||
  E'\n\nOnly you receive emails for this test. No board emails, receipt archives, or payment records will be created. No money is transferred.';
 if new.channel='sms' then
  new.body:='TEST ONLY: RCAP #'||r.reference||', simulated $1.00. '||case when r.status='submitted' then 'Your approval is needed.' else 'Status: '||replace(r.status,'_',' ')||'.' end||' No real payment. Sign in with your board cellphone to review: https://wearercap.org/check-requests/#request/'||r.id;
 end if;
 return new;
end $$;
