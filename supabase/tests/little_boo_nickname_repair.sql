begin;
do $$ declare i int; actor uuid; photo uuid;begin
 -- Test actors join before the local synthetic round closes.
 update boo_private.settings cfg set closes_at=clock_timestamp()+interval '1 day' where cfg.id=true;
 for i in 1..8 loop
  actor:=('a3000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  insert into auth.users(id,phone,phone_confirmed_at,is_anonymous) values(actor,'+1555333'||lpad(i::text,4,'0'),now(),false);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform public.boo_game('profile',jsonb_build_object('display','Fictional Nickname Player '||i,'house','Amistad','grade','5th'));
 end loop;
 update boo_private.settings set submissions_open_at=clock_timestamp()-interval '1 hour',submissions_close_at=clock_timestamp()+interval '1 hour',guesses_open_at=clock_timestamp()+interval '2 hours',closes_at=clock_timestamp()+interval '3 hours';
 perform set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000001',true);
 for i in 1..2 loop
  photo:=('b3000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  perform public.boo_game('upload',jsonb_build_object('id',photo,'name',case when i=1 then 'Mosie Sample' else 'Mose Morgan' end,'house','Amistad','grade','5th','mode','children','consent',true,'hash',lpad((3300+i)::text,64,'0'),'key','little-boo/v1/'||photo||'.bin','capsule','fictional','proofHash',repeat('c',64)));
 end loop;
 update boo_private.settings set submissions_open_at=clock_timestamp()-interval '3 hours',submissions_close_at=clock_timestamp()-interval '2 hours',guesses_open_at=clock_timestamp()-interval '1 hour',closes_at=clock_timestamp()+interval '1 hour';
 insert into boo_private.plays(user_id,photo,submitted,points,correct_at,guess,pending_at)
 select ('a3000000-0000-4000-8000-'||lpad(x.actor::text,12,'0'))::uuid,('b3000000-0000-4000-8000-'||lpad(x.pic::text,12,'0'))::uuid,true,x.points,case when x.points>0 then clock_timestamp()-interval '3 minutes' end,x.guess,case when x.has_time then clock_timestamp()-x.actor*interval '1 minute' end
 from(values(2,1,5,'Mosie Sample',true),(3,1,0,'Mose',true),(4,1,0,'Mose Sample',true),(5,1,0,'Mosy',true),(1,1,0,'Mose',true),(7,1,0,'Mose',false),(3,2,0,'Mosie',true),(4,2,0,'Mosie Other',true))x(actor,pic,points,guess,has_time);
 update boo_private.photos set first_correct='a3000000-0000-4000-8000-000000000002' where id='b3000000-0000-4000-8000-000000000001';
end $$;
-- APPLY_ACTUAL_NICKNAME_MIGRATION

do $$declare r jsonb;begin
 if (select count(*) from boo_private.audit where action='nickname_credit_v1')<>3 then raise exception 'FAIL: nickname correction scope';end if;
 if (select count(*) from boo_private.audit where action='approved_nickname_alias_v1')<>2 then raise exception 'FAIL: bounded aliases';end if;
 if (select sum(points) from boo_private.plays)<>16 then raise exception 'FAIL: nickname score total';end if;
 if (select points from boo_private.plays where user_id='a3000000-0000-4000-8000-000000000002' and photo='b3000000-0000-4000-8000-000000000001')<>5 then raise exception 'FAIL: existing winner changed';end if;
 if exists(select 1 from boo_private.plays where user_id in('a3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000005','a3000000-0000-4000-8000-000000000007') and points>0) then raise exception 'FAIL: speculative, own-child or unrecorded time corrected';end if;
 perform set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000006',true);
 r:=public.boo_game('guess','{"id":"b3000000-0000-4000-8000-000000000001","guess":"Mose"}');if r->>'correct'<>'true' or r->>'points'<>'3' then raise exception 'FAIL: confirmed alias future guess';end if;
end $$;
-- APPLY_ACTUAL_NICKNAME_MIGRATION

do $$begin
 if (select count(*) from boo_private.audit where action='nickname_credit_v1')<>3 or (select count(*) from boo_private.audit where action='approved_nickname_alias_v1')<>2 or (select sum(points) from boo_private.plays)<>19 then raise exception 'FAIL: duplicate nickname award';end if;
 raise notice 'PASS: explicit Mose/Mosie and exact full alias correction, held fuzzy guesses, score preservation and idempotent rerun';
end $$;
rollback;
