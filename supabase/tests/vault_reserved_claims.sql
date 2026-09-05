begin;
do $$
declare intended uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid(); token text:='reservation-fixture-'||gen_random_uuid(); legacy text; result jsonb;
begin
 legacy:=public.vault_hash(token);
 insert into public.vault_profiles(owner,display_name) values(legacy,'Reservation fixture');
 insert into vault_private.reserved_owners(owner,phone_hash) values(legacy,public.vault_hash('15550008401'));
 insert into auth.users(id,phone,phone_confirmed_at) values(intended,'15550008401',null),(stranger,'15550008402',now());
 perform set_config('request.jwt.claim.sub',stranger::text,true);
 perform public.vault_join(token);
 if exists(select 1 from vault_private.owner_links where owner=legacy) then raise exception 'Wrong phone claimed reservation'; end if;
 perform set_config('request.jwt.claim.sub',intended::text,true);
 begin perform public.vault_join(''); raise exception 'Unverified phone claimed reservation'; exception when others then if sqlerrm='Unverified phone claimed reservation' then raise; end if; end;
 update auth.users set phone_confirmed_at=now() where id=intended;
 result:=public.vault_join('');
 if not exists(select 1 from vault_private.owner_links where owner=legacy and user_id=intended) then raise exception 'Verified reservation not linked'; end if;
 if not exists(select 1 from public.vault_profiles where owner=result->>'owner' and display_name='Reservation fixture') then raise exception 'Profile not carried forward'; end if;
 perform public.vault_join('');
 if (select count(*) from vault_private.owner_links where owner=legacy)<>1 then raise exception 'Repeated join duplicated ownership'; end if;
end $$;
rollback;
