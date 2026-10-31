begin;
-- Only fictional rollback fixtures. Harness executes the actual migration's
-- repair block at both markers, rather than a duplicated repair implementation.
do $$
declare i int; actor uuid; photo uuid; names text[]:=array['Fable Finch','Milo Moon','Piper Pumpkin','Rowan Rocket','Sunny Star','Quinn Quartz'];
begin
 for i in 1..8 loop
  actor:=('d1000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  insert into auth.users(id,phone,phone_confirmed_at,is_anonymous) values(actor,'+1555666'||lpad(i::text,4,'0'),now(),false);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform public.boo_game('profile',jsonb_build_object('display','Fictional Repair Player '||i,'house','Amistad','grade','5th'));
 end loop;
 update boo_private.settings set submissions_open_at=clock_timestamp()-interval '1 hour',submissions_close_at=clock_timestamp()+interval '1 hour',guesses_open_at=clock_timestamp()+interval '2 hours',closes_at=clock_timestamp()+interval '3 hours';
 perform set_config('request.jwt.claim.sub','d1000000-0000-4000-8000-000000000001',true);
 for i in 1..6 loop
  photo:=('e1000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  perform public.boo_game('upload',jsonb_build_object('id',photo,'name',names[i],'house','Amistad','grade','5th','mode',case when i=6 then 'adults' else 'children' end,'consent',true,'hash',lpad((1200+i)::text,64,'0'),'key','little-boo/v1/'||photo||'.bin','capsule','fictional','proofHash',repeat('a',64)));
 end loop;
 update boo_private.settings set submissions_open_at=clock_timestamp()-interval '3 hours',submissions_close_at=clock_timestamp()-interval '2 hours',guesses_open_at=clock_timestamp()-interval '1 hour',closes_at=clock_timestamp()+interval '1 hour';
 update boo_private.players set own_names=array['rowanrocket'] where user_id='d1000000-0000-4000-8000-000000000005';
 insert into boo_private.plays(user_id,photo,submitted,points,correct_at,guess,pending_at,hinted,pending)
 select ('d1000000-0000-4000-8000-'||lpad(x.actor::text,12,'0'))::uuid,
 ('e1000000-0000-4000-8000-'||lpad(x.photo::text,12,'0'))::uuid,x.submitted,x.points,
 case when x.points>0 then clock_timestamp()-interval '10 minutes' end,x.guess,
 case when x.minutes is not null then clock_timestamp()-x.minutes*interval '1 minute' end,x.hinted,
 case when x.is_pending then gen_random_uuid() end
 from (values
 (2,1,true,5,'Fable Finch',10,false,false),
 (3,1,true,0,'Fable',20,false,false),
 (3,2,true,0,'Milo',5,false,false),(4,2,true,0,'Milo',4,false,false),
 (3,3,true,0,'Piper',7,true,false),(4,3,true,0,'Piper',6,false,false),
 (7,3,true,0,'Other',3,false,false),
 (1,4,true,0,'Rowan',4,false,false),(5,4,true,0,'Rowan',4,false,false),
 (6,4,false,0,'Rowan',4,false,false),(7,4,false,0,'Rowan',4,false,true),
 (3,5,true,0,'Sunny',4,false,false),(3,6,true,0,'Quinn',4,false,false),
 (8,1,true,0,'Fable',null,false,false),(6,1,true,0,'Fab',4,false,false)
 )x(actor,photo,submitted,points,guess,minutes,hinted,is_pending);
 update boo_private.photos set first_correct='d1000000-0000-4000-8000-000000000002' where id='e1000000-0000-4000-8000-000000000001';
 update boo_private.photos set state='removed' where id='e1000000-0000-4000-8000-000000000005';
end $$;
-- APPLY_ACTUAL_REPAIR

do $$ declare total int;begin
 select count(*) into total from boo_private.audit where action='first_name_credit_v1';if total<>5 then raise exception 'FAIL: wrong repair count %',total;end if;
 if (select points from boo_private.plays where user_id='d1000000-0000-4000-8000-000000000002' and photo='e1000000-0000-4000-8000-000000000001')<>5 or (select first_correct from boo_private.photos where id='e1000000-0000-4000-8000-000000000001')<>'d1000000-0000-4000-8000-000000000002' then raise exception 'FAIL: original winner changed';end if;
 if (select points from boo_private.plays where user_id='d1000000-0000-4000-8000-000000000003' and photo='e1000000-0000-4000-8000-000000000001')<>3 then raise exception 'FAIL: later repaired score';end if;
 if (select points from boo_private.plays where user_id='d1000000-0000-4000-8000-000000000003' and photo='e1000000-0000-4000-8000-000000000002')<>5 or (select points from boo_private.plays where user_id='d1000000-0000-4000-8000-000000000004' and photo='e1000000-0000-4000-8000-000000000002')<>3 then raise exception 'FAIL: new first ordering';end if;
 if (select points from boo_private.plays where user_id='d1000000-0000-4000-8000-000000000003' and photo='e1000000-0000-4000-8000-000000000003')<>1 or (select points from boo_private.plays where user_id='d1000000-0000-4000-8000-000000000004' and photo='e1000000-0000-4000-8000-000000000003')<>5 then raise exception 'FAIL: hinted/unaided repair';end if;
 if exists(select 1 from boo_private.plays where points>0 and (photo in ('e1000000-0000-4000-8000-000000000004','e1000000-0000-4000-8000-000000000005','e1000000-0000-4000-8000-000000000006') or user_id in ('d1000000-0000-4000-8000-000000000006','d1000000-0000-4000-8000-000000000007','d1000000-0000-4000-8000-000000000008'))) then raise exception 'FAIL: ineligible repair';end if;
 if (select sum(points) from boo_private.plays)<>22 then raise exception 'FAIL: total repaired points';end if;
 if exists(select 1 from boo_private.plays where points>0 and user_id<>'d1000000-0000-4000-8000-000000000002' and correct_at is distinct from pending_at) then raise exception 'FAIL: timestamp evidence not preserved';end if;
 if (select count(*) from boo_private.notifications where message like 'A previously rejected first-name guess%')<>5 then raise exception 'FAIL: repair notifications';end if;
end $$;
-- APPLY_ACTUAL_REPAIR

do $$begin
 if (select count(*) from boo_private.audit where action='first_name_credit_v1')<>5 or (select sum(points) from boo_private.plays)<>22 or (select count(*) from boo_private.notifications where message like 'A previously rejected first-name guess%')<>5 then raise exception 'FAIL: duplicate repair award';end if;
 raise notice 'PASS: audited first-name repair, existing winner preserved, 5/3/1, exclusions, timestamp evidence, and idempotent rerun';
end $$;
rollback;
