-- Run AFTER approved migration, in a transaction that always rolls back.
begin;
-- Assert no raw metadata access and no anonymous writes.
do $$begin
 if has_table_privilege('anon','trip_private.photos','select') or has_table_privilege('authenticated','trip_private.photos','insert') then raise exception 'Raw table privilege leaked'; end if;
 if has_function_privilege('anon','public.trip_add_photo(uuid,text,text,text,text,text,text,integer,integer,bigint,timestamptz)','execute') then raise exception 'Anonymous insertion privilege leaked'; end if;
 if has_function_privilege('anon','public.trip_hide_photo(text,uuid)','execute') then raise exception 'Anonymous removal privilege leaked'; end if;
 if public.trip_gallery('london-2028') <> '[]'::jsonb then raise exception 'Cross-vault gallery leak'; end if;
end $$;
-- Fixtures simulate two verified accounts; no authentication message is sent.
insert into auth.users(id,phone_confirmed_at) values('88888888-1111-4111-8111-111111111111',now()),('99999999-1111-4111-8111-111111111111',now());
select set_config('request.jwt.claim.sub','88888888-1111-4111-8111-111111111111',true);
select public.trip_upload_allowed('nyc-2026','send-off',repeat('a',64));
select public.trip_add_photo('aaaaaaaa-1111-4111-8111-111111111111','nyc-2026','send-off',repeat('a',64),'jpg','Synthetic test','Test',1200,630,1000,now());
do $$begin
 if jsonb_array_length(public.trip_gallery('nyc-2026','send-off','aaaaaaaa-1111-4111-8111-111111111111'))<>1 then raise exception 'Send-off photo missing'; end if;
 if jsonb_array_length(public.trip_gallery('nyc-2026',null,'aaaaaaaa-1111-4111-8111-111111111111'))<>1 then raise exception 'Shared photo missing'; end if;
 if public.trip_add_photo('bbbbbbbb-1111-4111-8111-111111111111','nyc-2026','send-off',repeat('a',64),'jpg','Synthetic test','Test',1200,630,1000,now()) then raise exception 'Duplicate inserted'; end if;
 begin perform public.trip_upload_allowed('london-2028','send-off',repeat('b',64));raise exception 'Cross-vault request permitted';exception when raise_exception then if sqlerrm='Cross-vault request permitted' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','99999999-1111-4111-8111-111111111111',true);
do $$begin
 begin perform public.trip_hide_photo('nyc-2026','aaaaaaaa-1111-4111-8111-111111111111');raise exception 'Other account removed photo';exception when raise_exception then if sqlerrm='Other account removed photo' then raise;end if;end;
end $$;
select set_config('request.jwt.claim.sub','88888888-1111-4111-8111-111111111111',true);
select public.trip_hide_photo('nyc-2026','aaaaaaaa-1111-4111-8111-111111111111');
do $$begin if public.trip_gallery('nyc-2026',null,'aaaaaaaa-1111-4111-8111-111111111111')<>'[]'::jsonb then raise exception 'Hidden photo visible';end if;end $$;
rollback;
