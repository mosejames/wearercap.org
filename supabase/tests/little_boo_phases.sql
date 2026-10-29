begin;
-- Real PostgreSQL clock/transaction boundaries and synthetic rollback-only actors.
do $$
declare u uuid; i int; r jsonb; args jsonb; stamp timestamptz; awards jsonb; placements jsonb;
 owner_id uuid:='90000000-0000-4000-8000-000000000001';
 user_two uuid:='90000000-0000-4000-8000-000000000002';
 user_three uuid:='90000000-0000-4000-8000-000000000003';
 user_four uuid:='90000000-0000-4000-8000-000000000004';
 v_photo uuid:='91000000-0000-4000-8000-000000000001';
begin
 -- Exact confirmed Eastern boundaries; Sunday midnight is still EDT before fallback.
 if boo_private.phase_at('2026-10-29T23:59:59.999-04:00')->>'phase'<>'submissions' or boo_private.phase_at('2026-10-30T00:00:00-04:00')->>'phase'<>'waiting' or boo_private.phase_at('2026-10-30T11:59:59.999-04:00')->>'phase'<>'waiting' or boo_private.phase_at('2026-10-30T12:00:00-04:00')->>'phase'<>'guessing' or boo_private.phase_at('2026-10-31T23:58:59.999-04:00')->>'phase'<>'guessing' or boo_private.phase_at('2026-10-31T23:59:00-04:00')->>'phase'<>'closed' or boo_private.phase_at('2026-11-01T00:00:00-04:00')->>'phase'<>'results' then raise exception 'FAIL: exact Eastern phase boundaries';end if;
 for i in 1..4 loop
  u:=('90000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  insert into auth.users(id,phone,phone_confirmed_at,is_anonymous) values(u,'+1555999'||lpad(i::text,4,'0'),now(),false);
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform public.boo_game('profile',jsonb_build_object('display','Fictional Phase Player '||i,'house','Amistad','grade','5th'));
 end loop;
 insert into vault_private.staff(user_id,role) values(owner_id,'owner');
 update boo_private.settings set submissions_open_at=clock_timestamp()-interval '1 hour',submissions_close_at=clock_timestamp()+interval '1 hour',guesses_open_at=clock_timestamp()+interval '2 hours',closes_at=clock_timestamp()+interval '3 hours',results_on=(clock_timestamp() at time zone 'America/New_York')::date+1;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 args:=jsonb_build_object('id',v_photo,'name','Fictional Phase Student','house','Amistad','grade','5th','mode','children','consent',true,'hash',repeat('9',64),'key','little-boo/v1/'||v_photo||'.bin','capsule','fictional','proofHash',repeat('a',64));
 r:=public.boo_game('upload',args);if r->>'uploadBonus'<>'3' then raise exception 'FAIL: submission bonus';end if;
 r:=public.boo_game('media',jsonb_build_object('id',v_photo));if not(r ? 'key') then raise exception 'FAIL: owner pre-open media';end if;
 perform set_config('request.jwt.claim.sub',user_two::text,true);
 r:=public.boo_game('get','{}');if exists(select 1 from jsonb_array_elements(r->'photos')x where x->>'id'=v_photo::text) then raise exception 'FAIL: board visible before opening';end if;
 begin perform public.boo_game('media',jsonb_build_object('id',v_photo));raise exception 'FAIL: media visible before opening';exception when insufficient_privilege then null;end;
 begin perform public.boo_game('guess',jsonb_build_object('id',v_photo,'guess','Fictional Phase Student','serverNow','2099-01-01','phase','guessing'));raise exception 'FAIL: client bypassed opening';exception when raise_exception then if sqlerrm='FAIL: client bypassed opening' then raise;end if;end;
 if exists(select 1 from boo_private.plays play where play.user_id=user_two and play.photo=v_photo) then raise exception 'FAIL: early attempt consumed';end if;
 -- A bounded, revocable preference does not schedule or send anything.
 r:=public.boo_game('opening-notice',jsonb_build_object('optedIn',true,'userId',owner_id));
 if r->>'deliveryState'<>'not_scheduled' or not exists(select 1 from boo_private.opening_notice_consents where user_id=user_two and opted_in) or exists(select 1 from boo_private.opening_notice_consents where user_id=owner_id) then raise exception 'FAIL: notice scope';end if;
 select consented_at into stamp from boo_private.opening_notice_consents where user_id=user_two;
 perform public.boo_game('opening-notice',jsonb_build_object('optedIn',true));
 if (select consented_at from boo_private.opening_notice_consents where user_id=user_two)<>stamp then raise exception 'FAIL: duplicate consent timestamp';end if;
 perform public.boo_game('opening-notice',jsonb_build_object('optedIn',false));
 if (select opted_in from boo_private.opening_notice_consents where user_id=user_two) then raise exception 'FAIL: withdrawal';end if;
 -- A transaction begun while open must still reject an upload after the cutoff.
 update boo_private.settings set submissions_close_at=clock_timestamp()+interval '0.15 seconds',guesses_open_at=clock_timestamp()+interval '1 hour';
 perform pg_sleep(0.25);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 begin perform public.boo_game('upload',args||jsonb_build_object('id','91000000-0000-4000-8000-000000000002','name','Fictional Late Student','hash',repeat('8',64),'key','little-boo/v1/91000000-0000-4000-8000-000000000002.bin'));raise exception 'FAIL: stale transaction upload accepted';exception when raise_exception then if sqlerrm='FAIL: stale transaction upload accepted' then raise;end if;end;
 if exists(select 1 from boo_private.photos where id='91000000-0000-4000-8000-000000000002') then raise exception 'FAIL: late v_photo persisted';end if;
 if public.boo_phase()->>'phase'<>'waiting' then raise exception 'FAIL: waiting gap';end if;
 update boo_private.settings set guesses_open_at=clock_timestamp()+interval '0.15 seconds',closes_at=clock_timestamp()+interval '1 hour';
 perform set_config('request.jwt.claim.sub',user_two::text,true);
 begin perform public.boo_game('guess',jsonb_build_object('id',v_photo,'guess','Fictional Phase Student'));raise exception 'FAIL: early guess accepted';exception when raise_exception then if sqlerrm='FAIL: early guess accepted' then raise;end if;end;
 perform pg_sleep(0.25);
 r:=public.boo_game('guess',jsonb_build_object('id',v_photo,'guess','Fictional Phase Student'));if r->>'points'<>'5' then raise exception 'FAIL: first post-open correct';end if;
 r:=public.boo_game('get','{}');if not exists(select 1 from jsonb_array_elements(r->'photos')x where x->>'id'=v_photo::text) then raise exception 'FAIL: board stayed locked';end if;
 update boo_private.settings set closes_at=clock_timestamp()+interval '0.15 seconds';
 perform pg_sleep(0.25);
 perform set_config('request.jwt.claim.sub',user_three::text,true);
 begin perform public.boo_game('guess',jsonb_build_object('id',v_photo,'guess','Fictional Phase Student'));raise exception 'FAIL: late guess accepted';exception when raise_exception then if sqlerrm='FAIL: late guess accepted' then raise;end if;end;
 if exists(select 1 from boo_private.plays p where p.user_id=user_three and p.photo=v_photo and p.points>0) then raise exception 'FAIL: late points';end if;
 begin insert into boo_private.plays(user_id,photo,points,submitted,correct_at) values(user_three,v_photo,5,true,clock_timestamp());raise exception 'FAIL: direct late points';exception when raise_exception then if sqlerrm='FAIL: direct late points' then raise;end if;end;
 begin perform public.boo_game('opening-notice',jsonb_build_object('optedIn',true));raise exception 'FAIL: expired opening request';exception when raise_exception then if sqlerrm='FAIL: expired opening request' then raise;end if;end;
 perform public.boo_game('opening-notice',jsonb_build_object('optedIn',false));
 -- Controlled tied score fixtures exercise report/drawing handling, never a random draw.
 update boo_private.settings set closes_at=clock_timestamp()+interval '1 hour';
 insert into boo_private.plays(user_id,photo,points,correct_at,submitted) values(user_three,v_photo,5,clock_timestamp(),true),(user_four,v_photo,5,clock_timestamp(),true);
 update boo_private.settings set closes_at=clock_timestamp()-interval '1 second';
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.boo_game('finalize','{}');
 select s.awards into awards from boo_private.settings s;
 if (select count(*) from jsonb_array_elements(awards)x where coalesce((x->>'drawingRequired')::boolean,false))<>3 or exists(select 1 from jsonb_array_elements(awards)x where coalesce((x->>'drawingRequired')::boolean,false) and x->>'tickets' is not null) then raise exception 'FAIL: tied prizes assigned automatically';end if;
 placements:=jsonb_build_array(jsonb_build_object('place',1,'playerId',user_four),jsonb_build_object('place',2,'playerId',user_two),jsonb_build_object('place',3,'playerId',user_three));
 begin perform public.boo_game('drawing-results',jsonb_build_object('placements',placements));raise exception 'FAIL: unconfirmed drawing';exception when raise_exception then if sqlerrm='FAIL: unconfirmed drawing' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',user_two::text,true);
 begin perform public.boo_game('drawing-results',jsonb_build_object('placements',placements,'confirmed',true));raise exception 'FAIL: non-owner drawing';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 begin perform public.boo_game('drawing-results',jsonb_build_object('placements',jsonb_build_array(placements->0,placements->0,placements->2),'confirmed',true));raise exception 'FAIL: duplicate drawing place';exception when raise_exception then if sqlerrm='FAIL: duplicate drawing place' then raise;end if;end;
 perform public.boo_game('drawing-results',jsonb_build_object('placements',placements,'confirmed',true));
 select s.awards into awards from boo_private.settings s;
 if not exists(select 1 from jsonb_array_elements(awards)x where x->>'playerId'=user_four::text and x->>'tickets'='25') or not exists(select 1 from jsonb_array_elements(awards)x where x->>'playerId'=user_two::text and x->>'tickets'='15') or not exists(select 1 from jsonb_array_elements(awards)x where x->>'playerId'=user_three::text and x->>'tickets'='10') then raise exception 'FAIL: recorded drawing';end if;
 if (boo_private.phase_at((select results_on::timestamp at time zone timezone from boo_private.settings))->>'resultsPublished')::boolean is not true then raise exception 'FAIL: reviewed Sunday release';end if;
 if public.boo_game('get','{}')->'awards'<>'null'::jsonb then raise exception 'FAIL: official results published before Sunday';end if;
 raise notice 'PASS: server phase boundaries, stale transactions, protected board/media, accepted-only rewards, bounded consent, manual tie decisions and Sunday review';
end $$;
set local role anon;
do $$ declare schedule jsonb;begin
 schedule:=public.boo_phase();if schedule ? 'photos' or schedule ? 'phone' or schedule ? 'board' then raise exception 'FAIL: public phase leak';end if;
 begin perform public.boo_game('get','{}');raise exception 'FAIL: anonymous gameplay';exception when insufficient_privilege then null;end;
 begin perform * from boo_private.opening_notice_consents;raise exception 'FAIL: public consent list';exception when insufficient_privilege then null;end;
 begin perform boo_private.phase_at(now());raise exception 'FAIL: client clock override';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
