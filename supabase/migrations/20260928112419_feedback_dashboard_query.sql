create or replace function feedback_private.dispatch(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s feedback_private.surveys; lead boolean; org uuid; result jsonb; v jsonb; rid uuid; token text; existing feedback_private.voices;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>50000 then raise exception 'Invalid request'; end if;
 if p_action='get' then
  select * into s from feedback_private.surveys where slug=p_payload->>'slug' and status='published';
  if not found then raise exception 'Survey unavailable'; end if;
  return to_jsonb(s)-'organizer_id';
 elsif p_action='submit' then
  select * into s from feedback_private.surveys where id=(p_payload->>'survey')::uuid and status='published' for share;
  if not found then raise exception 'Survey closed'; end if;
  if not feedback_private.valid_answers(s.questions,p_payload->'answers') then raise exception 'Please complete the required questions'; end if;
  rid:=(p_payload->>'id')::uuid;
  insert into feedback_private.responses(id,survey_id,answers) values(rid,s.id,p_payload->'answers') on conflict(id) do nothing;
  if not exists(select 1 from feedback_private.responses where id=rid and survey_id=s.id and answers=p_payload->'answers') then raise exception 'Submission conflict'; end if;
  return jsonb_build_object('saved',true);
 elsif p_action='voice' then
  select * into s from feedback_private.surveys where id=(p_payload->>'survey')::uuid and status='published' and voices_enabled;
  if not found then raise exception 'Voice notes unavailable'; end if;
  rid:=(p_payload->>'id')::uuid;
  insert into feedback_private.voices(id,survey_id,permission,duration,mime) values(rid,s.id,p_payload->>'permission',(p_payload->>'duration')::numeric,p_payload->>'mime') on conflict(id) do nothing;
  select * into existing from feedback_private.voices where id=rid;
  if existing.survey_id<>s.id or existing.permission<>p_payload->>'permission' or existing.mime<>p_payload->>'mime' then raise exception 'Recording permission conflict. Record again.'; end if;
  return jsonb_build_object('ready',true);
 elsif p_action='voice_finish' then
  rid:=(p_payload->>'id')::uuid;
  if not exists(select 1 from storage.objects where bucket_id='rcap-feedback-voices' and name=rid::text||'/recording') then raise exception 'Recording has not uploaded'; end if;
  update feedback_private.voices set complete=true where id=rid;
  return jsonb_build_object('saved',true);
 end if;
 lead:=coalesce(public.vault_pass_ok('rcap',p_payload->>'pass'),false);
 org:=feedback_private.organizer(p_payload->>'token');
 if not lead and org is null then raise exception 'Open a valid organizer invitation or enter the leadership passcode'; end if;
 if p_action='ai_authorize' then
  -- A database-backed limit survives serverless restarts. Leadership uses the same bounded bucket.
  if org is null then
   insert into feedback_private.organizers(id,token_hash,label,revoked) values('00000000-0000-0000-0000-000000000001','internal-ai-budget','Leadership AI budget',true) on conflict do nothing;
   org:='00000000-0000-0000-0000-000000000001';
  end if;
  update feedback_private.organizers set ai_count=case when ai_window>now()-interval '1 hour' then ai_count+1 else 1 end, ai_window=case when ai_window>now()-interval '1 hour' then ai_window else now() end where id=org and (ai_window is null or ai_window<=now()-interval '1 hour' or ai_count<20);
  if not found then raise exception 'You have reached 20 AI drafts this hour. Please try later.'; end if;
  return 'true'::jsonb;
 elsif p_action='dashboard' then
  return jsonb_build_object('leadership',lead,'surveys',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from (select sv.*, (select count(*) from feedback_private.responses r where r.survey_id=sv.id) response_count from feedback_private.surveys sv where lead or sv.organizer_id=org) t),'[]'::jsonb),'invites',case when lead then coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',label,'expires_at',expires_at,'revoked',revoked)) from feedback_private.organizers where token_hash<>'internal-ai-budget'),'[]'::jsonb) else '[]'::jsonb end);
 elsif p_action='invite' and lead then
  if coalesce(length(trim(p_payload->>'label')),0) not between 1 and 80 then raise exception 'Add an invitation label'; end if;
  token:=encode(extensions.gen_random_bytes(32),'hex');
  insert into feedback_private.organizers(token_hash,label) values(encode(extensions.digest(token,'sha256'),'hex'),trim(p_payload->>'label'));
  return jsonb_build_object('token',token);
 elsif p_action='revoke' and lead then
  update feedback_private.organizers set revoked=true where id=(p_payload->>'id')::uuid;
  return 'true'::jsonb;
 elsif p_action='save' then
  v:=p_payload->'survey'; rid:=(v->>'id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(rid::text, 39));
  select * into s from feedback_private.surveys where id=rid for update;
  if found and (not (lead or coalesce(s.organizer_id=org,false)) or s.status<>'draft') then raise exception 'Published surveys are frozen. Duplicate to create a new version.'; end if;
  if coalesce(v->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v->>'slug')>80 or v->>'slug'='admin' or coalesce(length(trim(v->>'event_name')),0) not between 1 and 120 or coalesce(length(trim(v->>'title')),0) not between 1 and 160 or coalesce(length(trim(v->>'intro')),0) not between 1 and 800 or coalesce(v->>'status','') not in ('draft','published') or jsonb_typeof(v->'voices_enabled') is distinct from 'boolean' or not feedback_private.valid_questions(v->'questions') then raise exception 'Check the survey title, link, and questions'; end if;
  insert into feedback_private.surveys(id,slug,event_name,event_date,title,intro,questions,voices_enabled,status,organizer_id)
   values(rid,v->>'slug',v->>'event_name',(v->>'event_date')::date,v->>'title',v->>'intro',v->'questions',(v->>'voices_enabled')::boolean,v->>'status',org)
   on conflict(id) do update set slug=excluded.slug,event_name=excluded.event_name,event_date=excluded.event_date,title=excluded.title,intro=excluded.intro,questions=excluded.questions,voices_enabled=excluded.voices_enabled,status=excluded.status;
  return jsonb_build_object('id',rid);
 end if;
 select * into s from feedback_private.surveys where id=(p_payload->>'survey')::uuid;
 if not found or not (lead or coalesce(s.organizer_id=org,false)) then raise exception 'Survey access denied'; end if;
 if p_action='results' then
  return jsonb_build_object('leadership',lead,'survey',to_jsonb(s)-'organizer_id','rows',coalesce((select jsonb_agg(r order by r.created_at desc) from feedback_private.responses r where survey_id=s.id),'[]'::jsonb),'voices',coalesce((select jsonb_agg(v order by v.created_at desc) from feedback_private.voices v where survey_id=s.id and complete and (lead or permission='community')),'[]'::jsonb),'insights',coalesce((select jsonb_agg(i order by i.created_at desc) from feedback_private.insights i where survey_id=s.id),'[]'::jsonb));
 elsif p_action='status' then
  if s.status='draft' or coalesce(p_payload->>'status','') not in ('published','closed') then raise exception 'Use preview and publish for a draft'; end if;
  update feedback_private.surveys set status=p_payload->>'status' where id=s.id;
  return 'true'::jsonb;
 elsif p_action='insight' then
  insert into feedback_private.insights(survey_id,body) values(s.id,trim(p_payload->>'body'));
  return 'true'::jsonb;
 end if;
 raise exception 'Unknown action';
end $$;
