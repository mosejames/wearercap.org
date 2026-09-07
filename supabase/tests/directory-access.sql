-- Transaction-only checks. No test listings survive this file.
begin;
do $$
declare owners uuid[];
begin
 select array_agg(id) into owners from (select id from auth.users where is_anonymous is not true limit 2) u;
 if cardinality(owners) < 2 then raise exception 'Two existing auth users are needed for ownership checks'; end if;
 perform set_config('request.jwt.claims', json_build_object('sub', owners[1], 'role', 'authenticated')::text, true);
 perform set_config('directory.test_other', owners[2]::text, true);
end;
$$;
set local role authenticated;
insert into public.directory_listings (id, owner_id, name, category) values ('712aa9ea-4e6f-4434-bf8e-deaf94309b23', auth.uid(), 'Transaction-only directory test', 'Other');
do $$ begin
 if (select count(*) from public.directory_listings where id = '712aa9ea-4e6f-4434-bf8e-deaf94309b23') <> 1 then raise exception 'Owner cannot read draft'; end if;
 begin
  update public.directory_listings set owner_id = current_setting('directory.test_other')::uuid where id = '712aa9ea-4e6f-4434-bf8e-deaf94309b23';
  raise exception 'Owner reassignment was allowed';
 exception when insufficient_privilege then null; end;
 begin
  update public.directory_listings set photos = array['another-owner/photo.jpg'] where id = '712aa9ea-4e6f-4434-bf8e-deaf94309b23';
  raise exception 'Foreign photos were allowed';
 exception when raise_exception then
  if sqlerrm <> 'Listing photos must belong to this owner and listing' then raise; end if;
 end;
end $$;
set local role anon;
do $$ begin
 if exists(select 1 from public.directory_listings where id = '712aa9ea-4e6f-4434-bf8e-deaf94309b23') then raise exception 'Anonymous visitor can read draft'; end if;
end $$;
set local role authenticated;
update public.directory_listings set bio = 'Test only', website = 'https://example.com', published = true where id = '712aa9ea-4e6f-4434-bf8e-deaf94309b23';
select set_config('request.jwt.claims', json_build_object('sub', current_setting('directory.test_other'), 'role', 'authenticated')::text, true) is not null as switched_test_identity;
do $$ declare affected integer; begin
 update public.directory_listings set name = 'Unauthorized' where id = '712aa9ea-4e6f-4434-bf8e-deaf94309b23';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Another user can edit the listing'; end if;
 delete from public.directory_listings where id = '712aa9ea-4e6f-4434-bf8e-deaf94309b23';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Another user can delete the listing'; end if;
end $$;
set local role anon;
do $$ begin
 if (select count(*) from public.directory_listings where id = '712aa9ea-4e6f-4434-bf8e-deaf94309b23') <> 1 then raise exception 'Published listing is not public'; end if;
end $$;
rollback;
