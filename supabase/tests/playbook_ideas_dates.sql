-- Real database checks, all fixtures are rolled back.
begin;
do $$
declare admin_id uuid; member_id uuid; idea uuid; other_idea uuid; result jsonb; item jsonb; denied boolean; base jsonb;
begin
 select id into admin_id from auth.users where lower(email)='mose@mosejames.com';
 select u.id into member_id from auth.users u join playbook_private.members m on m.email=lower(u.email)
 where u.email_confirmed_at is not null and not exists(select 1 from playbook_private.admins a where a.email=lower(u.email)) limit 1;
 if admin_id is null or member_id is null then raise exception 'Missing verification accounts'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 denied:=false;begin perform public.rcap_playbook('load','{"committee":"exec"}');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anonymous access allowed'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 base:='{"committee":"exec","content":"Should dues have a defined collection window?","author_name":"Verification only","timeframe":"Before next school year","sections":["plan","provision"]}'::jsonb;
 result:=public.rcap_playbook('idea',base);idea:=(result->>'id')::uuid;
 result:=public.rcap_playbook('export','{"committee":"exec"}');
 select x into item from jsonb_array_elements(result->'ideas') x where x->>'id'=idea::text;
 if item->>'status'<>'Open for discussion' or jsonb_array_length(item->'sections')<>2 then raise exception 'Capture did not preserve defaults and connections'; end if;
 result:=public.rcap_playbook('idea',base||jsonb_build_object('id',idea,'version',1,'status','Agreed','kind','Confirmed date','event_date','2027-09-01'));
 result:=public.rcap_playbook('idea',base||jsonb_build_object('id',idea,'version',2,'status','Agreed','kind','Confirmed date','event_date','2027-09-01','content','Explore a two-month dues collection window.'));
 select to_jsonb(i) into item from playbook_private.ideas i where id=idea;
 if item->>'status'<>'Exploring' or item->>'kind'<>'Proposed date' or jsonb_array_length(item->'previous_versions')<>2 then raise exception 'Editing agreement failed to reopen or preserve history'; end if;
 denied:=false;begin perform public.rcap_playbook('idea',base||jsonb_build_object('id',idea,'version',1));exception when serialization_failure then denied:=true;end;
 if not denied then raise exception 'Stale edit overwrote data'; end if;
 denied:=false;begin perform public.rcap_playbook('idea_comment',jsonb_build_object('committee','advisory','idea_id',idea,'author_name','Verification only','content','Cross-workspace reply'));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross-workspace reply allowed'; end if;
 denied:=false;begin perform public.rcap_playbook('action',jsonb_build_object('committee','advisory','idea_id',idea,'title','Cross-workspace action'));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Cross-workspace action allowed'; end if;
 result:=public.rcap_playbook('action',jsonb_build_object('committee','exec','idea_id',idea,'title','Discuss collection timing','owner_name','Finance contact','due_date','2027-08-01','done_when','A recommendation is ready.'));
 if not exists(select 1 from playbook_private.actions where id=(result->>'id')::uuid and idea_id=idea) then raise exception 'Next step lost its source'; end if;
 perform set_config('request.jwt.claim.sub',member_id::text,true);
 denied:=false;begin perform public.rcap_playbook('load','{"committee":"exec"}');exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Outsider accessed capture'; end if;
 insert into playbook_private.members(committee,email,role) select 'exec',lower(email),'member' from auth.users where id=member_id;
 denied:=false;begin perform public.rcap_playbook('idea',base||jsonb_build_object('id',idea,'version',3));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Member overwrote peer'; end if;
 result:=public.rcap_playbook('idea',base);other_idea:=(result->>'id')::uuid;
 denied:=false;begin perform public.rcap_playbook('idea',base||jsonb_build_object('id',other_idea,'version',1,'status','Agreed'));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Member recorded agreement'; end if;
 denied:=false;begin perform public.rcap_playbook('idea',base||jsonb_build_object('id',other_idea,'version',1,'kind','Confirmed date','event_date','2027-09-01'));exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Member confirmed date'; end if;
 perform public.rcap_playbook('idea_comment',jsonb_build_object('committee','exec','idea_id',idea,'content','Useful question.','author_name','Member verification'));
 if not exists(select 1 from playbook_private.idea_comments where idea_id=idea and author_id=member_id and author_name='Member verification') then raise exception 'Reply lost attribution'; end if;
 if has_table_privilege('authenticated','playbook_private.ideas','SELECT') or has_table_privilege('anon','playbook_private.idea_comments','SELECT') then raise exception 'Direct access was granted'; end if;
end $$;
select 'Ideas capture, history, dates, discussion, linked actions and access checks passed' as result;
rollback;
