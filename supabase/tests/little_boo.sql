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
-- Synthetic identities only. This entire suite runs inside the caller's rollback transaction.
do $$
declare i int; u uuid; id uuid; r jsonb; pend text; proof text:='synthetic-proof-only'; first_id uuid:='b0000000-0000-4000-8000-000000000001';
begin
 for i in 1..16 loop
  u:=('a0000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  insert into auth.users(id,phone,phone_confirmed_at,is_anonymous) values(u,'+1555000'||lpad(i::text,4,'0'),now(),false);
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform pg_temp.boo_scoring_game('profile',jsonb_build_object('display','Fictional Player '||i,'house','Amistad','grade','5th','ownNames','[]'::jsonb));
 end loop;
 perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
 for i in 1..9 loop
  id:=('b0000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  perform pg_temp.boo_scoring_game('upload',jsonb_build_object('id',id,'name','Fictional Child '||i,'aliases',jsonb_build_array('Nickname '||i),'house','Amistad','grade','5th','mode','children','consent',true,'hash',lpad(i::text,64,'0'),'key','little-boo/v1/'||id||'.bin','capsule','encrypted-fictional-test','proofHash',encode(extensions.digest(proof,'sha256'),'hex')));
 end loop;
 perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
 if (select count(*) from boo_private.photos where mode='children' and state='active')<10 then
 begin perform pg_temp.boo_scoring_game('hint',jsonb_build_object('id',first_id));raise exception 'FAIL: hint before ten';exception when raise_exception then if sqlerrm='FAIL: hint before ten' then raise;end if;end;
 end if;
 r:=pg_temp.boo_scoring_game('guess',jsonb_build_object('id',first_id,'guess','NICK-name 1'));
 if (r->>'points')::int<>5 then raise exception 'FAIL: first normalized alias %',r;end if;
 r:=pg_temp.boo_scoring_game('guess',jsonb_build_object('id',first_id,'guess','wrong'));
 if (r->>'points')::int<>5 or r->>'alreadyScored'<>'true' then raise exception 'FAIL: repeat points %',r;end if;
 perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);
 r:=pg_temp.boo_scoring_game('guess',jsonb_build_object('id',first_id,'guess','fictional child 1'));
 if (r->>'points')::int<>3 then raise exception 'FAIL: later points %',r;end if;
 perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
 begin perform pg_temp.boo_scoring_game('guess',jsonb_build_object('id',first_id,'guess','fictional child 1'));raise exception 'FAIL: own child';exception when raise_exception then if sqlerrm='FAIL: own child' then raise;end if;end;
 id:='b0000000-0000-4000-8000-000000000010';
 perform pg_temp.boo_scoring_game('upload',jsonb_build_object('id',id,'name','Fictional Child 10','aliases','[]'::jsonb,'house','Reveur','grade','6th','mode','children','consent',true,'hash',lpad('10',64,'0'),'key','little-boo/v1/'||id||'.bin','capsule','test','proofHash',encode(extensions.digest(proof,'sha256'),'hex')));
 perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000004',true);
 r:=pg_temp.boo_scoring_game('hint',jsonb_build_object('id',first_id));if jsonb_array_length(r->'choices')<>4 then raise exception 'FAIL: choices';end if;
 if r<>pg_temp.boo_scoring_game('hint',jsonb_build_object('id',first_id)) then raise exception 'FAIL: hint choices changed';end if;
 r:=pg_temp.boo_scoring_game('guess',jsonb_build_object('id',first_id,'guess','Fictional Child 1'));
 if (r->>'points')::int<>1 then raise exception 'FAIL: hinted points %',r;end if;
 perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000005',true);
 r:=pg_temp.boo_scoring_game('guess',jsonb_build_object('id',first_id,'guess','Some Other Person'));pend:=r->>'pending';
 if pend is null or not (r ? 'capsule') then raise exception 'FAIL: spelling reservation %',r;end if;
 begin perform pg_temp.boo_scoring_game('judged',jsonb_build_object('id',first_id,'pending',pend,'proof','forged','correct',true));raise exception 'FAIL: forged adjudication';exception when insufficient_privilege then null;end;
 r:=pg_temp.boo_scoring_game('judged',jsonb_build_object('id',first_id,'pending',pend,'proof',proof,'correct',false));
 if r->>'correct'<>'false' then raise exception 'FAIL: wrong result %',r;end if;
 r:=pg_temp.boo_scoring_game('guess',jsonb_build_object('id',first_id,'guess','Fictional Child 1'));
 if r->>'correct'<>'false' then raise exception 'FAIL: retry after wrong %',r;end if;
 r:=pg_temp.boo_scoring_game('hint',jsonb_build_object('id',first_id));if r ? 'choices' then raise exception 'FAIL: hint after wrong';end if;
 perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000006',true);
 r:=pg_temp.boo_scoring_game('guess',jsonb_build_object('id',first_id,'guess','Fictional Chlid 1'));pend:=r->>'pending';
 perform pg_temp.boo_scoring_game('cancel-judge',jsonb_build_object('id',first_id,'pending',pend,'proof',proof));
 r:=pg_temp.boo_scoring_game('guess',jsonb_build_object('id',first_id,'guess','Fictional Child 1'));if (r->>'points')::int<>3 then raise exception 'FAIL: retry after timeout %',r;end if;
 perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000007',true);
 r:=pg_temp.boo_scoring_game('get','{}');
 if r::text like '%Fictional Child%' or r::text like '%Nickname%' or r::text like '%proof_hash%' then raise exception 'FAIL: answer secrecy';end if;
 perform pg_temp.boo_scoring_game('profile',jsonb_build_object('display','Fictional Player 7','house','Amistad','grade','5th','ownNames',jsonb_build_array('Fictional Child 1')));
 begin perform pg_temp.boo_scoring_game('guess',jsonb_build_object('id',first_id,'guess','Fictional Child 1'));raise exception 'FAIL: declared own child';exception when raise_exception then if sqlerrm='FAIL: declared own child' then raise;end if;end;
 perform pg_temp.boo_scoring_game('report',jsonb_build_object('id',first_id,'reason','Fictional test report'));
 begin perform pg_temp.boo_scoring_game('remove',jsonb_build_object('id',first_id));raise exception 'FAIL: unauthorized remove';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
 perform pg_temp.boo_scoring_game('remove',jsonb_build_object('id',first_id));
 begin perform pg_temp.boo_scoring_game('media',jsonb_build_object('id',first_id));raise exception 'FAIL: removed media';exception when no_data_found then null;end;
 if exists(select 1 from jsonb_array_elements(pg_temp.boo_scoring_game('get','{}')->'board'->'individual')x where (x->>'guessPoints')::int>0 and x->>'id' like 'a0000000-%') then raise exception 'FAIL: removed guessing points';end if;

 -- Restore ten distinct active children and award a non-tied podium.
 id:='b0000000-0000-4000-8000-000000000011';
 perform pg_temp.boo_scoring_game('upload',jsonb_build_object('id',id,'name','Fictional Child 11','aliases','[]'::jsonb,'house','Reveur','grade','6th','mode','children','consent',true,'hash',lpad('11',64,'0'),'key','little-boo/v1/'||id||'.bin','capsule','test','proofHash',encode(extensions.digest(proof,'sha256'),'hex')));
 perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000008',true);
 r:=pg_temp.boo_scoring_game('guess',jsonb_build_object('id','b0000000-0000-4000-8000-000000000002','guess','Fictional Child 2'));
 if (r->>'points')::int<>5 then raise exception 'FAIL: new podium first';end if;
 begin perform pg_temp.boo_scoring_game('profile',jsonb_build_object('display','Fictional Player 8','house','Reveur','grade','5th','ownNames','[]'::jsonb));raise exception 'FAIL: affiliation changed';exception when raise_exception then if sqlerrm='FAIL: affiliation changed' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000009',true);
 perform pg_temp.boo_scoring_game('guess',jsonb_build_object('id','b0000000-0000-4000-8000-000000000002','guess','Fictional Child 2'));
 perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000010',true);
 perform pg_temp.boo_scoring_game('hint',jsonb_build_object('id','b0000000-0000-4000-8000-000000000002'));
 perform pg_temp.boo_scoring_game('guess',jsonb_build_object('id','b0000000-0000-4000-8000-000000000002','guess','Fictional Child 2'));
 perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000011',true);
 insert into boo_private.limits(user_id,bucket,used) values('a0000000-0000-4000-8000-000000000011',date_trunc('minute',now()),12);
 r:=pg_temp.boo_scoring_game('guess',jsonb_build_object('id','b0000000-0000-4000-8000-000000000002','guess','Fictional Child 2'));
 if r->>'rateLimited'<>'true' then raise exception 'FAIL: brute force limit';end if;
 perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);

 -- Adults remain a separate bonus board and cannot change children's awards.
 id:='b0000000-0000-4000-8000-000000000012';
 perform pg_temp.boo_scoring_game('upload',jsonb_build_object('id',id,'name','Fictional Grownup','aliases','[]'::jsonb,'house','Reveur','grade','Other / alumni','mode','adults','consent',true,'hash',lpad('12',64,'0'),'key','little-boo/v1/'||id||'.bin','capsule','test','proofHash',encode(extensions.digest(proof,'sha256'),'hex')));
 perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000009',true);
 r:=pg_temp.boo_scoring_game('guess',jsonb_build_object('id',id,'guess','Fictional Grownup'));
 if (r->>'points')::int<>5 then raise exception 'FAIL: adult first';end if;
 if (pg_temp.boo_scoring_game('get',jsonb_build_object('mode','adults'))->'board'->'individual'->0->>'points')<>'5' then raise exception 'FAIL: adult board';end if;
 if not exists(select 1 from jsonb_array_elements(pg_temp.boo_scoring_game('get','{}')->'board'->'individual')x where x->>'id'='a0000000-0000-4000-8000-000000000009' and x->>'guessPoints'='3') then raise exception 'FAIL: child board polluted';end if;
 perform set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
 -- Owner controls reuse the existing owner role; no access changes persist.
 insert into vault_private.staff(user_id,role) values('a0000000-0000-4000-8000-000000000001','owner');
 perform pg_temp.boo_scoring_game('admin','{}');
 perform pg_temp.boo_scoring_game('settings',jsonb_build_object('closesAt',now()-interval '1 second','timezone','America/New_York','tieRule','shared-rank'));
 r:=pg_temp.boo_scoring_game('finalize','{}');if r->'awards'->0->>'tickets'<>'25' or r->'awards'->1->>'tickets'<>'15' or r->'awards'->2->>'tickets'<>'10' then raise exception 'FAIL: final prize report %',r;end if;
 raise notice 'PASS: aliases, 10 distinct children, 5/3/1, once-only, own-child, fixed hints, wrong lockout, timeout recovery, forgery, secrecy, reports/removal, owner settings and awards';
end $$;
-- Direct client roles cannot enumerate answers or call internal helpers.
set local role authenticated;
do $$ begin
 begin perform name from boo_private.people;raise exception 'FAIL: private answers readable';exception when insufficient_privilege then null;end;
 begin perform boo_private.board('children');raise exception 'FAIL: private helper callable';exception when insufficient_privilege then null;end;
end $$;
reset role;

rollback;
