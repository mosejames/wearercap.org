begin;
-- Test-only clock control inside the surrounding rollback transaction. This lets
-- the legacy score cases exercise both exclusive phases without changing real time.
create function pg_temp.boo_scoring_game(a text,b jsonb default '{}') returns jsonb language plpgsql as $$
begin
 if a='upload' then
  update boo_private.settings set submissions_open_at=clock_timestamp()-interval '1 hour',submissions_close_at=clock_timestamp()+interval '1 hour',guesses_open_at=clock_timestamp()+interval '2 hours',closes_at=clock_timestamp()+interval '3 hours';
 elsif a in ('guess','hint') then
  update boo_private.settings set submissions_open_at=clock_timestamp()-interval '3 hours',submissions_close_at=clock_timestamp()-interval '2 hours',guesses_open_at=clock_timestamp()-interval '1 hour',closes_at=clock_timestamp()+interval '1 hour';
 end if;
 return public.boo_game(a,b);
end $$;
-- Synthetic, rollback-only fixtures. No SMS, photos in R2, or permanent users.
do $$
declare i int; u uuid; response jsonb; args jsonb; points_before int; house_before int; count_before int;
 owner_id uuid:='c0000000-0000-4000-8000-000000000001';
 guesser uuid:='c0000000-0000-4000-8000-000000000002';
 photo_one uuid:='d0000000-0000-4000-8000-000000000001';
 photo_two uuid:='d0000000-0000-4000-8000-000000000002';
 person_two uuid; original_hash text:=repeat('d',63)||'2';
begin
 select coalesce((select (x->>'points')::int from jsonb_array_elements(boo_private.board('children')->'house')x where x->>'label'='Amistad'),0) into house_before;
 select count(*) into count_before from boo_private.contributions;
 for i in 1..3 loop
  u:=('c0000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  insert into auth.users(id,phone,phone_confirmed_at,is_anonymous) values(u,'+1555777'||lpad(i::text,4,'0'),now(),false);
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform pg_temp.boo_scoring_game('profile',jsonb_build_object('display','Fictional Bonus Player '||i,'house',case when i=1 then 'Amistad' else 'Reveur' end,'grade',case when i=1 then '5th' else '6th' end,'ownNames','[]'::jsonb));
 end loop;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 args:=jsonb_build_object('id',photo_one,'name','Fictional Bonus Student One','aliases','[]'::jsonb,'house','Amistad','grade','5th','mode','children','consent',true,'hash',repeat('d',63)||'1','key','little-boo/v1/'||photo_one||'.bin','capsule','fictional-encrypted-capsule','proofHash',repeat('a',64));
 -- Unauthenticated/local selection and unconsented attempts do not earn points.
 perform set_config('request.jwt.claim.sub','',true);
 begin perform pg_temp.boo_scoring_game('upload',args);raise exception 'FAIL: anonymous bonus';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 begin perform pg_temp.boo_scoring_game('upload',args||jsonb_build_object('consent',false));raise exception 'FAIL: unconsented bonus';exception when raise_exception then if sqlerrm='FAIL: unconsented bonus' then raise;end if;end;
 if (select count(*) from boo_private.contributions)<>count_before then raise exception 'FAIL: reward before accepted upload';end if;
 response:=pg_temp.boo_scoring_game('upload',args);
 if response->>'uploadBonus'<>'3' then raise exception 'FAIL: first bonus %',response;end if;
 response:=boo_private.board('children');
 if not exists(select 1 from jsonb_array_elements(response->'individual')x where x->>'id'=owner_id::text and x->>'points'='3' and x->>'guessPoints'='0' and x->>'uploadPoints'='3' and x->>'identified'='0' and x->>'contributions'='1') then raise exception 'FAIL: separate individual bonus %',response;end if;
 if (select (x->>'points')::int from jsonb_array_elements(response->'house')x where x->>'label'='Amistad')<>house_before+3 then raise exception 'FAIL: house bonus';end if;
 -- Retrying the same accepted payload or a second parent cannot double-award.
 begin perform pg_temp.boo_scoring_game('upload',args);raise exception 'FAIL: duplicate submission accepted';exception when raise_exception then if sqlerrm='FAIL: duplicate submission accepted' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',guesser::text,true);
 begin perform pg_temp.boo_scoring_game('upload',args||jsonb_build_object('id','d0000000-0000-4000-8000-000000000003','key','little-boo/v1/d0000000-0000-4000-8000-000000000003.bin','hash',repeat('d',63)||'3'));raise exception 'FAIL: second-parent bonus';exception when raise_exception then if sqlerrm='FAIL: second-parent bonus' then raise;end if;end;
 if (select count(*) from boo_private.contributions where student_key=boo_private.normalize('Fictional Bonus Student One'))<>1 then raise exception 'FAIL: duplicate receipt';end if;
 -- A sibling legitimately receives a distinct +3; the established player team applies.
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 args:=args||jsonb_build_object('id',photo_two,'name','Fictional Bonus Student Two','house','Reveur','grade','6th','hash',original_hash,'key','little-boo/v1/'||photo_two||'.bin');
 response:=pg_temp.boo_scoring_game('upload',args);
 if response->>'uploadBonus'<>'3' or (select count(*) from boo_private.contributions where user_id=owner_id)<>2 then raise exception 'FAIL: sibling receipt';end if;
 if not exists(select 1 from jsonb_array_elements(boo_private.board('children')->'individual')x where x->>'id'=owner_id::text and x->>'points'='6' and x->>'uploadPoints'='6' and x->>'guessPoints'='0') then raise exception 'FAIL: sibling total';end if;
 if (select (x->>'points')::int from jsonb_array_elements(boo_private.board('children')->'house')x where x->>'label'='Amistad')<>house_before+6 then raise exception 'FAIL: sibling team attribution';end if;
 begin perform pg_temp.boo_scoring_game('profile',jsonb_build_object('display','Fictional Bonus Player 1','house','Reveur','grade','6th'));raise exception 'FAIL: affiliation changed after contribution';exception when raise_exception then if sqlerrm='FAIL: affiliation changed after contribution' then raise;end if;end;
 -- Adult submissions get no student bonus and do not change either board's guessing total.
 response:=pg_temp.boo_scoring_game('upload',args||jsonb_build_object('id','d0000000-0000-4000-8000-000000000004','name','Fictional Bonus Grownup','mode','adults','hash',repeat('d',63)||'4','key','little-boo/v1/d0000000-0000-4000-8000-000000000004.bin'));
 if response->>'uploadBonus'<>'0' or (select count(*) from boo_private.contributions where user_id=owner_id)<>2 or boo_private.board('adults')->'individual'<>'[]'::jsonb then raise exception 'FAIL: adult upload bonus';end if;
 begin perform pg_temp.boo_scoring_game('guess',jsonb_build_object('id',photo_one,'guess','Fictional Bonus Student One'));raise exception 'FAIL: own-child guessing';exception when raise_exception then if sqlerrm='FAIL: own-child guessing' then raise;end if;end;
 perform set_config('request.jwt.claim.sub',guesser::text,true);
 response:=pg_temp.boo_scoring_game('guess',jsonb_build_object('id',photo_one,'guess','Fictional Bonus Student One'));
 if response->>'points'<>'5' then raise exception 'FAIL: guess scoring changed';end if;
 if not exists(select 1 from jsonb_array_elements(boo_private.board('children')->'individual')x where x->>'id'=guesser::text and x->>'guessPoints'='5' and x->>'uploadPoints'='0') then raise exception 'FAIL: separated guess ledger';end if;
 -- Soft removal forfeits the active bonus, but the permanent receipt stays consumed.
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform pg_temp.boo_scoring_game('remove',jsonb_build_object('id',photo_one));
 perform pg_temp.boo_scoring_game('remove',jsonb_build_object('id',photo_one));
 if (select count(*) from boo_private.contributions where user_id=owner_id)<>2 or (select count(*) from boo_private.contributions where user_id=owner_id and voided_at is null)<>1 then raise exception 'FAIL: removal receipts';end if;
 if not exists(select 1 from jsonb_array_elements(boo_private.board('children')->'individual')x where x->>'id'=owner_id::text and x->>'points'='3') then raise exception 'FAIL: removal total';end if;
 begin perform pg_temp.boo_scoring_game('upload',args||jsonb_build_object('id','d0000000-0000-4000-8000-000000000005','name','Fictional Bonus Student One','hash',repeat('d',63)||'5','key','little-boo/v1/d0000000-0000-4000-8000-000000000005.bin'));raise exception 'FAIL: removed student re-entry';exception when raise_exception then if sqlerrm='FAIL: removed student re-entry' then raise;end if;end;
 -- Simulate future replacement and genuine record deletion, in this rollback only.
 update boo_private.photos set content_hash=repeat('e',64) where id=photo_two;
 if (select count(*) from boo_private.contributions where user_id=owner_id)<>2 then raise exception 'FAIL: replacement reward';end if;
 select person into person_two from boo_private.photos where id=photo_two;
 delete from boo_private.photos where id=photo_two;
 delete from boo_private.people where id=person_two;
 if exists(select 1 from boo_private.contributions where user_id=owner_id and voided_at is null) then raise exception 'FAIL: physical removal retains points';end if;
 response:=pg_temp.boo_scoring_game('upload',args||jsonb_build_object('id','d0000000-0000-4000-8000-000000000006','hash',repeat('d',63)||'6','key','little-boo/v1/d0000000-0000-4000-8000-000000000006.bin'));
 if response->>'uploadBonus'<>'0' or (select count(*) from boo_private.contributions where user_id=owner_id)<>2 then raise exception 'FAIL: recreated student awarded again';end if;
 -- A renamed recreation with identical original photo bytes also cannot collect again.
 response:=pg_temp.boo_scoring_game('upload',args||jsonb_build_object('id','d0000000-0000-4000-8000-000000000007','name','Fictional Alternate Label','hash',original_hash,'key','little-boo/v1/d0000000-0000-4000-8000-000000000007.bin'));
 if response->>'uploadBonus'<>'0' then raise exception 'FAIL: same image rewarded again';end if;
 if exists(select 1 from jsonb_array_elements(boo_private.board('children')->'individual')x where x->>'id'=owner_id::text) then raise exception 'FAIL: voided rewards still count';end if;
 response:=pg_temp.boo_scoring_game('get','{}');
 if response::text like '%Fictional Bonus Student%' or response::text like '%student_key%' then raise exception 'FAIL: student identity leaked';end if;
 raise notice 'PASS: accepted-only +3, siblings, retry/duplicate/second-parent, removal, replacement, hard deletion/recreation, image reuse, separate guess/bonus boards and private identity';
end $$;
set local role authenticated;
do $$ begin
 begin perform * from boo_private.contributions;raise exception 'FAIL: contribution identity readable';exception when insufficient_privilege then null;end;
 begin perform * from boo_private.score_events('children');raise exception 'FAIL: internal scoring callable';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
