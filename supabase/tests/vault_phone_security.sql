-- Run after the migration inside a transaction. All fixtures roll back.
insert into auth.users(id,phone,phone_confirmed_at) values
 ('10000000-0000-4000-8000-000000000001','15555550101',now()),
 ('10000000-0000-4000-8000-000000000002','15555550102',now()),
 ('10000000-0000-4000-8000-000000000003','15555550103',null);
insert into public.vault_events(id,house,slug,title,kind,starts_on,open) values('20000000-0000-4000-8000-000000000001','amistad','security-test','Security test','house','2026-09-01',true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$begin
 begin perform public.vault_join(); raise exception 'TEST FAILED: unverified join'; exception when others then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
end$$;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select public.vault_join();
select public.vault_save_profile('','Test family');
select public.vault_reserve_uploads('security-test',array['30000000-0000-4000-8000-000000000001'::uuid]);
insert into public.vault_photos(id,event_id,owner,storage,key,web_key,thumb_key)
values('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',public.vault_actor(),'supabase',
'amistad/2026-27/10000000-0000-4000-8000-000000000001/security-test/30000000-0000-4000-8000-000000000001/orig.jpg',
'amistad/2026-27/10000000-0000-4000-8000-000000000001/security-test/30000000-0000-4000-8000-000000000001/web.jpg',
'amistad/2026-27/10000000-0000-4000-8000-000000000001/security-test/30000000-0000-4000-8000-000000000001/thumb.jpg');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select public.vault_join();
do $$begin
 begin perform public.vault_remove_upload('30000000-0000-4000-8000-000000000001'); raise exception 'TEST FAILED: foreign removal'; exception when others then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
 begin perform public.vault_review_reports('wrong'); raise exception 'TEST FAILED: report privacy'; exception when others then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
 begin insert into public.vault_comments(photo_id,owner,body) values('30000000-0000-4000-8000-000000000001',public.vault_hash('10000000-0000-4000-8000-000000000001'),'spoof'); raise exception 'TEST FAILED: forged owner'; exception when others then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
end$$;
select public.vault_report('30000000-0000-4000-8000-000000000001','privacy','Test report');
select public.vault_report('30000000-0000-4000-8000-000000000001','spam','Duplicate');
reset role;
do $$begin
 if (select count(*) from vault_private.reports where photo_id='30000000-0000-4000-8000-000000000001')<>1 then raise exception 'TEST FAILED: report deduplication'; end if;
 if (select hidden from public.vault_photos where id='30000000-0000-4000-8000-000000000001') then raise exception 'TEST FAILED: report hid photo'; end if;
end$$;
-- Use the existing admin secret without returning it in output.
do $$declare pass text;begin
 select admin_pass into pass from public.vault_settings where house='amistad';
 perform public.vault_ban_uploader(pass,'30000000-0000-4000-8000-000000000001','test',false);
end$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$begin
 if public.vault_actor() is not null then raise exception 'TEST FAILED: banned session still active'; end if;
 begin insert into public.vault_comments(photo_id,owner,body) values('30000000-0000-4000-8000-000000000001',public.vault_hash('10000000-0000-4000-8000-000000000001'),'blocked'); raise exception 'TEST FAILED: banned comment'; exception when others then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
 begin perform public.vault_report('30000000-0000-4000-8000-000000000001','spam'); raise exception 'TEST FAILED: banned report'; exception when others then if sqlerrm like 'TEST FAILED:%' then raise; end if; end;
end$$;
select public.vault_remove_upload('30000000-0000-4000-8000-000000000001');
do $$begin
 if exists(select 1 from public.vault_photos where id='30000000-0000-4000-8000-000000000001') then raise exception 'TEST FAILED: removed public visibility'; end if;
 if not vault_private.can_delete_object('amistad/2026-27/10000000-0000-4000-8000-000000000001/security-test/30000000-0000-4000-8000-000000000001/orig.jpg') then raise exception 'TEST FAILED: owner cleanup'; end if;
end$$;
reset role;
select 'Phone ownership, reporting privacy, duplicate reports, immediate bans, and removal checks passed' as result;
