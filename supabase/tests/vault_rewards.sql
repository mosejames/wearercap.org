-- Real database regression checks; fixtures are always rolled back.
begin;
do $$
declare u uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); o text; q text; e uuid:=gen_random_uuid(); e2 uuid:=gen_random_uuid(); p uuid; row jsonb; awards jsonb;
begin
 insert into auth.users(id,phone,phone_confirmed_at) values(u,'15550008101',now()),(v,'15550008102',now());
 perform set_config('request.jwt.claim.sub',u::text,true);
 o:=public.vault_join('')->>'owner';
 perform public.vault_save_member_profile('Rewards fixture A','',false);
 insert into public.vault_events(id,slug,title,starts_on) values(e,'rewards-fixture-'||e,'Rewards fixture',current_date),(e2,'rewards-fixture-'||e2,'Second fixture',current_date);
 insert into public.vault_photos(event_id,owner,storage,key,web_key,thumb_key)
 select e,o,'supabase','fixture','fixture','fixture' from generate_series(1,10);
 select id into p from public.vault_photos where event_id=e limit 1;
 -- Calendar boundary is Eastern, not UTC. This upload belongs to August.
 update public.vault_photos set created_at='2026-09-01 03:59:59+00' where id=p;
 select r into row from jsonb_array_elements(public.vault_contributors('2026-08-01',e)) r where r->>'owner'=o;
 if (row->>'uploads')::int<>1 then raise exception 'Month boundary failed'; end if;
 select r into row from jsonb_array_elements(public.vault_contributors(null,e)) r where r->>'owner'=o;
 if (row->>'score')::int<>60 then raise exception 'Upload score failed'; end if;
 awards:=public.vault_claim_badges();
 if awards<>'[10]'::jsonb or public.vault_claim_badges()<>'[]'::jsonb then raise exception 'Badge threshold/idempotency failed'; end if;
 insert into public.vault_likes(photo_id,owner) values(p,o);
 select r into row from jsonb_array_elements(public.vault_contributors(null,e)) r where r->>'owner'=o;
 if (row->>'score')::int<>60 then raise exception 'Self-like counted'; end if;
 perform set_config('request.jwt.claim.sub',v::text,true);
 q:=public.vault_join('')->>'owner';
 perform public.vault_save_member_profile('Rewards fixture B','',false);
 insert into public.vault_likes(photo_id,owner) values(p,q);
 insert into public.vault_comments(photo_id,owner,body) values(p,q,'Lovely memory'),(p,q,'Another comment');
 select r into row from jsonb_array_elements(public.vault_contributors(null,e)) r where r->>'owner'=q;
 if (row->>'score')::int<>3 or (row->>'interactions')::int<>2 then raise exception 'Duplicate engagement counted'; end if;
 if exists(select 1 from jsonb_array_elements(public.vault_contributors(null,e2)) r where r->>'owner' in(o,q)) then raise exception 'Event filter failed'; end if;
 update public.vault_photos set hidden=true where id=p;
 if exists(select 1 from jsonb_array_elements(public.vault_contributors(null,e)) r where r->>'owner'=q) then raise exception 'Hidden photo engagement counted'; end if;
 insert into vault_private.bans(phone_hash) values(public.vault_hash('15550008101'));
 if exists(select 1 from jsonb_array_elements(public.vault_contributors(null,e)) r where r->>'owner'=o) then raise exception 'Banned contributor counted'; end if;
 -- A profile cannot point at a file that was never uploaded.
 begin perform public.vault_avatar(false); raise exception 'Missing avatar accepted'; exception when others then if sqlerrm='Missing avatar accepted' then raise; end if; end;
end $$;
rollback;

-- Storage policies are exercised as a signed-in member, not as postgres.
begin;
do $$
declare u uuid:=gen_random_uuid(); o text;
begin
 insert into auth.users(id,phone,phone_confirmed_at) values(u,'15550008203',now());
 perform set_config('request.jwt.claim.sub',u::text,true);
 o:=public.vault_join('')->>'owner';
 perform public.vault_save_member_profile('Avatar fixture','',false);
 execute 'set local role authenticated';
 begin
  insert into storage.objects(bucket_id,name) values('vault-avatars','someone-else/profile.jpg');
  raise exception 'Cross-account upload accepted';
 exception when insufficient_privilege then null;
 end;
 insert into storage.objects(bucket_id,name) values('vault-avatars',o||'/profile.jpg');
 update storage.objects set metadata='{}'::jsonb where bucket_id='vault-avatars' and name=o||'/profile.jpg';
 if public.vault_avatar(false)<>o||'/profile.jpg' then raise exception 'Avatar reference failed'; end if;
 perform public.vault_avatar(true);
 execute 'reset role';
end $$;
rollback;
