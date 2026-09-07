begin;
do $$
declare uid uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid(); got jsonb; n int;
begin
 insert into auth.users(id,phone,phone_confirmed_at,email) values(uid,'+15005550189',now(),'prefs@example.test'),(other_id,'+15005550190',now(),'otherprefs@example.test');
 perform set_config('request.jwt.claim.sub',uid::text,true);
 got:=public.cr_notification_preference();
 if got->>'channel'<>'sms' then raise exception 'Default should be text';end if;
 begin perform public.cr_notification_preference('both');raise exception 'Unverified email allowed';exception when others then if sqlerrm not like '%verify your backup email%' then raise;end if;end;
 update auth.users set email_confirmed_at=now() where id=uid;
 perform public.cr_notification_preference('both');
 insert into public.cr_requests(id,owner_id,requester_name,email,phone,payee,delivery,committee,purpose,items,total_cents) values(rid,uid,'Test Parent','+15005550189','5005550189','Test Parent','pickup','General','Test preferences','[{"description":"test","date":"2026-09-07","amount_cents":100,"receipts":[]}]',100);
 insert into public.cr_history(request_id,actor_email,action,note) values(rid,'+15005550189','approved','Test review');
 perform cr_private.queue_notice(rid,'approved');
 if not exists(select 1 from public.cr_notifications where request_id=rid and recipient='+15005550189' and channel='sms' and body like '%reviewed and approved%') then raise exception 'Text approval missing';end if;
 if not exists(select 1 from public.cr_notifications where request_id=rid and recipient='prefs@example.test' and channel='email' and notice_snapshot is not null) then raise exception 'Email approval missing';end if;
 perform public.cr_notification_preference('email');
 select count(*) into n from public.cr_notifications where request_id=rid and recipient='+15005550189';
 perform cr_private.queue_notice(rid,'declined');
 if n<>(select count(*) from public.cr_notifications where request_id=rid and recipient='+15005550189') then raise exception 'Email-only sent SMS';end if;
 perform set_config('request.jwt.claim.sub',other_id::text,true);
 set local role authenticated;
 if exists(select 1 from public.cr_notification_preferences where user_id=uid) then raise exception 'Preferences leaked';end if;
 begin insert into public.cr_notification_preferences(user_id,channel) values(uid,'sms');raise exception 'Direct writes allowed';exception when insufficient_privilege then null;end;
 reset role;
end $$;
rollback;
select 'PASS: verified contacts, default text, both channels, email-only routing, and preference isolation; test data rolled back.' as result;
