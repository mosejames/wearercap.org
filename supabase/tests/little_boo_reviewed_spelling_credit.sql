begin;
do $$declare i int;u uuid;target uuid:='b6000000-0000-4000-8000-000000000001';begin
 for i in 1..27 loop
  u:=('a6000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  insert into auth.users(id,phone_confirmed_at,is_anonymous)values(u,now(),false);
  insert into boo_private.players(user_id,display,house,grade)values(u,'Fictional Review Player '||i,'Amistad','5th');
 end loop;
 update boo_private.settings set submissions_open_at=clock_timestamp()-interval '1 hour',submissions_close_at=clock_timestamp()+interval '1 hour',guesses_open_at=clock_timestamp()+interval '2 hours',closes_at=clock_timestamp()+interval '3 hours';
 perform set_config('request.jwt.claim.sub','a6000000-0000-4000-8000-000000000001',true);
 perform public.boo_game('upload',jsonb_build_object('id',target,'name','Fictional Review Student','house','Amistad','grade','5th','mode','children','consent',true,'hash',repeat('6',64),'key','little-boo/v1/'||target||'.bin','capsule','fictional','proofHash',repeat('6',64)));
 update boo_private.settings set submissions_open_at=clock_timestamp()-interval '3 hours',submissions_close_at=clock_timestamp()-interval '2 hours',guesses_open_at=clock_timestamp()-interval '1 hour',closes_at=clock_timestamp()+interval '1 hour';
 insert into boo_private.plays(user_id,photo,submitted,points,correct_at,pending_at,guess,hinted)select ('a6000000-0000-4000-8000-'||lpad(g.v::text,12,'0'))::uuid,target,true,case when g.v=2 then 5 else 0 end,case when g.v=2 then clock_timestamp()-interval '1 hour' end,clock_timestamp()-interval '2 minutes','Fictional misspelling',g.v=3 from generate_series(2,27)g(v);
 update boo_private.photos set first_correct='a6000000-0000-4000-8000-000000000002' where id=target;
 perform set_config('boo.reviewed_spelling_attempts',(select jsonb_agg(jsonb_build_object('user_id',user_id,'photo',photo,'guess_hash',encode(extensions.digest(guess,'sha256'),'hex'),'name_hash',encode(extensions.digest('Fictional Review Student','sha256'),'hex')))::text from boo_private.plays where photo=target and user_id not in('a6000000-0000-4000-8000-000000000002','a6000000-0000-4000-8000-000000000027')),true);
 perform set_config('boo.reviewed_alias_baseline',(select md5(aliases::text) from boo_private.people where name='Fictional Review Student'),true);
end $$;
-- APPLY_ACTUAL_REVIEWED_REPAIR

do $$begin
 if (select count(*) from boo_private.audit where action='reviewed_spelling_credit_v1')<>24 or (select sum(points) from boo_private.plays)<>75 then raise exception 'FAIL: reviewed credit scope or 1/3-point rules';end if;
 if (select points from boo_private.plays where user_id='a6000000-0000-4000-8000-000000000027')<>0 then raise exception 'FAIL: unreviewed attempt credited';end if;
 if (select first_correct from boo_private.photos where id='b6000000-0000-4000-8000-000000000001')<>'a6000000-0000-4000-8000-000000000002' then raise exception 'FAIL: existing winner replaced';end if;
 if (select md5(aliases::text) from boo_private.people where name='Fictional Review Student') is distinct from current_setting('boo.reviewed_alias_baseline') then raise exception 'FAIL: generic aliases expanded';end if;
end $$;
-- APPLY_ACTUAL_REVIEWED_REPAIR

do $$begin
 if (select count(*) from boo_private.audit where action='reviewed_spelling_credit_v1')<>24 or (select sum(points) from boo_private.plays)<>75 then raise exception 'FAIL: repeat credit';end if;
 if (select payload->>'creditedCount' from boo_private.audit where action='reviewed_spelling_batch_v1' order by id desc limit 1)<>'0' then raise exception 'FAIL: repeat credit batch';end if;
end $$;
rollback;
