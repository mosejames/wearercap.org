begin;
do $$
declare owner uuid:=gen_random_uuid(); reviewer uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid(); r jsonb;
begin
 insert into auth.users(id,phone,phone_confirmed_at) values(owner,'+15005550301',now()),(reviewer,'+15005550302',now());
 insert into public.cr_staff(email,name,role) values('+15005550302','TEST Approver','manager');
 insert into public.cr_requests(id,owner_id,requester_name,email,phone,payee,delivery,committee,purpose,items,total_cents,approver_email,on_behalf,payee_contact,event_name)
 values(rid,owner,'TEST Simulation','test@example.test','5005550301','TEST Payee','zelle','General RCAP','TEST workflow simulation','[{"date":"2026-09-28","description":"TEST expense","amount_cents":100,"document_total_cents":100,"receipts":[]}]',100,'+15005550302',true,'test-payee@example.test','TEST event');
 insert into cr_private.test_requests(request_id,recipient) values(rid,'test-only@example.test');
 insert into public.cr_history(request_id,actor_email,action,note) values(rid,'TEST simulator','submitted','TEST only');
 perform cr_private.queue_notice(rid,'submitted');
 perform cr_private.queue_notice(rid,'submitted');
 if (select count(*) from public.cr_notifications where request_id=rid)<>1 then raise exception 'TEST initial notice not deduplicated';end if;
 if exists(select 1 from public.cr_notifications where request_id=rid and (recipient<>'test-only@example.test' or recipients<>array['test-only@example.test'] or subject not like 'TEST:%' or archive_snapshot is not null or notice_snapshot is not null)) then raise exception 'TEST isolation failed';end if;
 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 r:=public.cr_action('approved',jsonb_build_object('id',rid,'version',1));
 if r->>'status'<>'approved' then raise exception 'TEST review failed';end if;
 if (select count(*) from public.cr_notifications where request_id=rid)<>2 then raise exception 'TEST decision notice missing';end if;
 if exists(select 1 from public.cr_notifications where request_id=rid and recipient<>'test-only@example.test') then raise exception 'TEST decision leaked';end if;
 begin update public.cr_requests set status='paid' where id=rid;raise exception 'TEST payment allowed';exception when others then if sqlerrm not like '%recording a payment is disabled%' then raise;end if;end;
end $$;
rollback;
select 'Isolated approval simulation passed; no messages sent.' as result;
