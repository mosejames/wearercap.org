begin;
do $$declare i int;u uuid;photo uuid:='b9000000-0000-4000-8000-000000000001';labels text[]:=array['Fable Finch','Milo Moon','Piper Pumpkin','Fictional Organizer'];begin
 for i in 1..4 loop
  u:=('a9000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  insert into auth.users(id,phone,phone_confirmed_at,is_anonymous)values(u,'+1555999100'||i,now(),false);
  insert into boo_private.players(user_id,display,house,grade)values(u,labels[i],'Amistad','5th');
 end loop;
 insert into vault_private.staff(user_id,role)values('a9000000-0000-4000-8000-000000000004','owner');
 update boo_private.settings set submissions_open_at=clock_timestamp()-interval '1 hour',submissions_close_at=clock_timestamp()+interval '1 hour',guesses_open_at=clock_timestamp()+interval '2 hours',closes_at=clock_timestamp()+interval '3 hours',finalized_at=null,awards=null;
 perform set_config('request.jwt.claim.sub','a9000000-0000-4000-8000-000000000004',true);
 perform public.boo_game('upload',jsonb_build_object('id',photo,'name','Fictional Halloween Student','house','Amistad','grade','5th','mode','children','consent',true,'hash',repeat('9',64),'key','little-boo/v1/'||photo||'.bin','capsule','fictional','proofHash',repeat('9',64)));
 update boo_private.settings set submissions_close_at=clock_timestamp()-interval '2 hours',guesses_open_at=clock_timestamp()-interval '1 hour',closes_at=clock_timestamp()+interval '1 hour';
 insert into boo_private.plays(user_id,photo,submitted,points,correct_at,pending_at,guess)select ('a9000000-0000-4000-8000-'||lpad(g.i::text,12,'0'))::uuid,photo,true,case g.i when 1 then 5 when 2 then 3 else 1 end,clock_timestamp()-interval '30 minutes',clock_timestamp()-interval '30 minutes','Fictional answer'from generate_series(1,3)g(i);
 if public.boo_winners()->'winners'<>'[]'::jsonb then raise exception 'FAIL: public winners before freeze';end if;
 update boo_private.settings set closes_at=clock_timestamp()-interval '1 minute',results_on=(clock_timestamp()at time zone'America/New_York')::date-1,finalized_at=clock_timestamp(),awards=(select jsonb_agg(jsonb_build_object('playerId',r.user_id,'display',r.display,'rank',r.placement,'points',r.points,'drawingRequired',false))from boo_private.reveal_rankings()r where r.placement<=3);
 if public.boo_winners()->'winners'<>'[]'::jsonb then raise exception 'FAIL: public winners before reveal publication';end if;
 update boo_private.reveal_control set published_at=clock_timestamp(),portraits_cleared=true,publication_approved=true;
 if public.boo_winners()->'winners'<>'[]'::jsonb then raise exception 'FAIL: names without explicit public approval';end if;
 insert into boo_private.audit(actor,action,payload)select null,'confirmed_finalists_public_v1',jsonb_build_object('reference','little-boo-public-winners-2026-11-02-v1','winners',jsonb_agg(jsonb_build_object('userId',r.user_id,'place',r.placement,'name',r.display,'points',r.points)))from boo_private.reveal_rankings()r where r.placement<=3;
end $$;
-- CHECK_AS_ANON

do $$declare r jsonb;begin
 r:=public.boo_winners();
 if jsonb_array_length(r->'winners')<>3 or exists(select 1 from jsonb_array_elements(r->'winners')x where(select count(*)from jsonb_object_keys(x))<>3 or not(x ?& array['name','place','points']))or r::text like '%Fictional Halloween Student%'or r::text like '%1555%'or r::text like '%userId%'then raise exception 'FAIL: public winner whitelist';end if;
 update boo_private.players set display='Changed label'where user_id='a9000000-0000-4000-8000-000000000001';
 if public.boo_winners()->'winners'<>'[]'::jsonb then raise exception 'FAIL: unapproved live display change';end if;
 update boo_private.players set display='Fable Finch'where user_id='a9000000-0000-4000-8000-000000000001';
 update boo_private.settings set awards=jsonb_set(awards,'{0,display}','"Wrong frozen label"');
 if public.boo_winners()->'winners'<>'[]'::jsonb then raise exception 'FAIL: unverified frozen winner';end if;
 update boo_private.settings set awards=(select jsonb_agg(jsonb_build_object('playerId',r.user_id,'display',r.display,'rank',r.placement,'points',r.points,'drawingRequired',false))from boo_private.reveal_rankings()r where r.placement<=3);
 if jsonb_array_length(public.boo_winners()->'winners')<>3 then raise exception 'FAIL: restored approved winners';end if;
 update boo_private.reveal_control set published_at=null;
 if public.boo_winners()->'winners'<>'[]'::jsonb then raise exception 'FAIL: winners remain public after hiding';end if;
 if has_function_privilege('anon','boo_private.public_winners()','execute')or has_table_privilege('anon','boo_private.audit','select')then raise exception 'FAIL: direct private audit access';end if;
end $$;
rollback;
