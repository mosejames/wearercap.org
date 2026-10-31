begin;
-- Fictional local actors only. No production identities, sessions or guesses.
create function pg_temp.first_name_attempt(actor uuid,photo uuid,guess text) returns jsonb language plpgsql as $$
declare r jsonb;
begin
 perform set_config('request.jwt.claim.sub',actor::text,true);
 r:=public.boo_game('guess',jsonb_build_object('id',photo,'guess',guess));
 if r ? 'pending' then
  -- Simulate a definitive nonmatch, without calling any external provider.
  r:=public.boo_game('judged',jsonb_build_object('id',photo,'pending',r->>'pending','proof','fictional-first-name-proof','correct',false));
 end if;
 return r;
end $$;
do $$
declare i int; actor uuid; photo uuid; r jsonb; item jsonb; expected int;
 names text[]:=array['Fable Finch','Fable Fern','Milo Moon','Anne-Marie Moss','Mary Jane Cloud','Fable','D''Andre Dawn','Élise Echo','Rowan Rocket','Sunny Star'];
 aliases jsonb; owner_id uuid:='b1000000-0000-4000-8000-000000000001';
begin
 if boo_private.first_name_key(E' \t Anne - Marie  Moss ')<>'annemarie'
 or boo_private.first_name_key('Jean‑Luc Fictional')<>'jeanluc'
 or boo_private.first_name_key(chr(160)||'Élise'||chr(160)||'Echo')<>'elise'
 or boo_private.first_name_key('Mary Jane Cloud')<>'mary'
 or boo_private.first_name_key('D''Andre Dawn')<>'dandre' then raise exception 'FAIL: first-name components';end if;
 for i in 1..24 loop
  actor:=('b1000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  insert into auth.users(id,phone,phone_confirmed_at,is_anonymous) values(actor,'+1555777'||lpad(i::text,4,'0'),now(),false);
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform public.boo_game('profile',jsonb_build_object('display','Fictional First Player '||i,'house','Amistad','grade','5th'));
 end loop;
 update boo_private.settings set submissions_open_at=clock_timestamp()-interval '1 hour',submissions_close_at=clock_timestamp()+interval '1 hour',guesses_open_at=clock_timestamp()+interval '2 hours',closes_at=clock_timestamp()+interval '3 hours';
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 for i in 1..10 loop
  photo:=('c1000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  aliases:=case i when 1 then '["Fae"]'::jsonb when 5 then '["Mary Jane"]'::jsonb when 7 then '["Fable Finch"]'::jsonb else '[]'::jsonb end;
  perform public.boo_game('upload',jsonb_build_object('id',photo,'name',names[i],'aliases',aliases,'house','Amistad','grade','5th','mode','children','consent',true,'hash',lpad((900+i)::text,64,'0'),'key','little-boo/v1/'||photo||'.bin','capsule','fictional-test-only','proofHash',encode(extensions.digest('fictional-first-name-proof','sha256'),'hex')));
 end loop;
 update boo_private.settings set submissions_close_at=clock_timestamp()-interval '2 hours',submissions_open_at=clock_timestamp()-interval '3 hours',guesses_open_at=clock_timestamp()-interval '1 hour',closes_at=clock_timestamp()+interval '1 hour';
 -- Correct first name is per pictured identity: another student also has Fable
 -- as a first name, and a third has the full mononym Fable. Both pictures work.
 for item in select * from jsonb_array_elements('[
  [2,1,"Fable",5],[3,1,"  fABle  fiNch! ",3],[4,1,"FAE!",3],
  [5,1,"Milo",0],[6,1,"Milo Moon",0],[7,1,"Fab",0],[8,1,"Finch",0],
  [9,1,"FableFincherson",0],[10,1,"Fable Smith",0],[2,2,"Fable",5],
  [11,4,"anne marie",5],[12,4,"Anne",0],[13,4,"ANNE-MARIE MOSS",3],
  [14,5,"Mary",5],[15,5,"Mary Jane",3],[16,5,"Mary Jane Cloud",3],
  [17,7,"dandre",5],[18,8,"ELISE",5],[19,9,"Rowan",5],[20,9,"Row",0]
 ]'::jsonb) loop
  actor:=('b1000000-0000-4000-8000-'||lpad((item->>0),12,'0'))::uuid;
  photo:=('c1000000-0000-4000-8000-'||lpad((item->>1),12,'0'))::uuid;
  r:=pg_temp.first_name_attempt(actor,photo,item->>2);expected:=(item->>3)::int;
  if coalesce((r->>'points')::int,0)<>expected or (r->>'correct')::boolean<>(expected>0) then raise exception 'FAIL: name case % got %',item,r;end if;
 end loop;
 -- Hints remain one point; a previous failed attempt stays failed.
 actor:='b1000000-0000-4000-8000-000000000021';photo:='c1000000-0000-4000-8000-000000000001';
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform public.boo_game('hint',jsonb_build_object('id',photo));
 r:=pg_temp.first_name_attempt(actor,photo,'Fable');if r->>'points'<>'1' then raise exception 'FAIL: hinted first name';end if;
 r:=pg_temp.first_name_attempt('b1000000-0000-4000-8000-000000000005',photo,'Fable');
 if r->>'correct'<>'false' or r->>'alreadyScored'<>'true' then raise exception 'FAIL: prior failed attempt reopened';end if;
 -- Owner exclusions, private answers and table grants remain unchanged.
 begin perform pg_temp.first_name_attempt(owner_id,photo,'Fable');raise exception 'FAIL: own-child first-name points';exception when raise_exception then if sqlerrm='FAIL: own-child first-name points' then raise;end if;end;
 perform set_config('request.jwt.claim.sub','b1000000-0000-4000-8000-000000000022',true);
 r:=public.boo_game('get','{}');if (r->'photos')::text like '%Fable%' then raise exception 'FAIL: answer leak';end if;
 if has_function_privilege('anon','boo_private.first_name_key(text)','execute') or has_function_privilege('authenticated','boo_private.first_name_key(text)','execute') then raise exception 'FAIL: private matcher exposed';end if;
 raise notice 'PASS: per-photo first/full/alias, shared first names, case/spacing/accents, hyphenated and multi-part names, non-substrings, 5/3/1, old wrong lock, own-child and secrecy';
end $$;
rollback;
