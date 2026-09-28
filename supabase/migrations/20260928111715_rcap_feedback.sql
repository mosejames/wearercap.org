-- Anonymous event feedback. No member identity, request headers, or visitor tracking stored.
create schema if not exists feedback_private;
revoke all on schema feedback_private from public;
grant usage on schema feedback_private to anon, authenticated, service_role;
create table feedback_private.organizers (
 id uuid primary key default gen_random_uuid(), token_hash text not null unique,
 label text not null, expires_at timestamptz not null default now()+interval '90 days', revoked boolean not null default false,
 ai_window timestamptz, ai_count integer not null default 0
);
create table feedback_private.surveys (
 id uuid primary key default gen_random_uuid(), slug text not null unique,
 event_name text not null, event_date date not null, title text not null, intro text not null,
 gallery_url text not null default '/rcap-capsule/', questions jsonb not null,
 voices_enabled boolean not null default true, status text not null default 'draft' check(status in ('draft','published','closed')),
 organizer_id uuid references feedback_private.organizers(id), created_at timestamptz not null default now()
);
create table feedback_private.responses (
 id uuid primary key, survey_id uuid not null references feedback_private.surveys(id),
 created_at timestamptz not null default now(), answers jsonb not null
);
create index on feedback_private.responses(survey_id);
create table feedback_private.voices (
 id uuid primary key, survey_id uuid not null references feedback_private.surveys(id),
 created_at timestamptz not null default now(), permission text not null check(permission in ('private','community')),
 duration numeric not null check(duration > 0 and duration <= 30), mime text not null check(mime in ('audio/webm','audio/mp4','audio/ogg','audio/wav')),
 complete boolean not null default false
);
create index on feedback_private.voices(survey_id);
create table feedback_private.insights (
 id uuid primary key default gen_random_uuid(), survey_id uuid not null references feedback_private.surveys(id),
 created_at timestamptz not null default now(), body text not null check(length(body) between 1 and 2000)
);
create index on feedback_private.insights(survey_id);
alter table feedback_private.organizers enable row level security;
alter table feedback_private.surveys enable row level security;
alter table feedback_private.responses enable row level security;
alter table feedback_private.voices enable row level security;
alter table feedback_private.insights enable row level security;
revoke all on all tables in schema feedback_private from public, anon, authenticated;

-- Capability authorization is intentional: respondents have no auth account.
-- Private definer code is reachable only through the bounded invoker API below.
create function feedback_private.organizer(p_token text) returns uuid language sql stable security definer set search_path='' as $$
 select id from feedback_private.organizers where token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex') and not revoked and expires_at>now()
$$;
create function feedback_private.valid_questions(qs jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare q jsonb; o jsonb; k text; seen text[]:='{}'; ids text[];
begin
 if jsonb_typeof(qs) is distinct from 'array' or jsonb_array_length(qs) not between 1 and 12 then return false; end if;
 for q in select value from jsonb_array_elements(qs) loop
  if jsonb_typeof(q) is distinct from 'object' or coalesce(length(q->>'id'),0) not between 1 and 80 or q->>'id'=any(seen) or coalesce(length(trim(q->>'title')),0) not between 1 and 240 or coalesce(length(q->>'help'),0)>400 or jsonb_typeof(q->'required') is distinct from 'boolean' or coalesce(q->>'type','') not in ('rating','matrix','choice','multi','text') then return false; end if;
  seen:=array_append(seen,q->>'id');
  if q->>'type' in ('choice','multi','matrix') then
   k:=case when q->>'type'='matrix' then 'items' else 'options' end;
   if jsonb_typeof(q->k) is distinct from 'array' or jsonb_array_length(q->k) not between (case when k='items' then 1 else 2 end) and 8 then return false; end if;
   ids:='{}';
   for o in select value from jsonb_array_elements(q->k) loop
    if coalesce(length(o->>'id'),0) not between 1 and 80 or o->>'id'=any(ids) or coalesce(length(trim(o->>'label')),0) not between 1 and 160 then return false; end if;
    ids:=array_append(ids,o->>'id');
   end loop;
   if q->>'type'='multi' and (coalesce(q->>'max','') !~ '^[1-8]$' or (q->>'max')::int>jsonb_array_length(q->'options')) then return false; end if;
  end if;
 end loop;
 return true;
end $$;
create function feedback_private.valid_answers(qs jsonb,a jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare q jsonb; v jsonb; item jsonb; option_ids jsonb; k text;
begin
 if jsonb_typeof(a) is distinct from 'object' or octet_length(a::text)>20000 then return false; end if;
 for k in select jsonb_object_keys(a) loop if not exists(select 1 from jsonb_array_elements(qs) x where x->>'id'=k) then return false; end if; end loop;
 for q in select value from jsonb_array_elements(qs) loop
  v:=a->(q->>'id');
  if v is null or v='null'::jsonb then if (q->>'required')::boolean then return false; else continue; end if; end if;
  case q->>'type'
   when 'rating' then if jsonb_typeof(v)<>'number' or v::text !~ '^[1-5]$' then return false; end if;
   when 'text' then if jsonb_typeof(v)<>'string' or length(v#>>'{}')>2000 or ((q->>'required')::boolean and length(trim(v#>>'{}'))=0) then return false; end if;
   when 'choice' then if not exists(select 1 from jsonb_array_elements(q->'options') o where o->'id'=v) then return false; end if;
   when 'matrix' then
    if jsonb_typeof(v)<>'object' or (select count(*) from jsonb_object_keys(v))<>jsonb_array_length(q->'items') then return false; end if;
    for item in select value from jsonb_array_elements(q->'items') loop if v->(item->>'id') is null or (v->(item->>'id')<> '"na"'::jsonb and coalesce((v->(item->>'id'))::text,'') !~ '^[1-5]$') then return false; end if; end loop;
   when 'multi' then
    if jsonb_typeof(v) is distinct from 'object' or jsonb_typeof(v->'choices') is distinct from 'array' then return false; end if;
    if exists(select 1 from jsonb_object_keys(v) t where t not in ('choices','other')) or jsonb_array_length(v->'choices') not between 1 and (q->>'max')::int then return false; end if;
    if (select count(distinct value) from jsonb_array_elements(v->'choices'))<>jsonb_array_length(v->'choices') then return false; end if;
    for item in select value from jsonb_array_elements(v->'choices') loop if not exists(select 1 from jsonb_array_elements(q->'options') o where o->'id'=item) then return false; end if; end loop;
    if v->'choices' ? 'other' then if jsonb_typeof(v->'other') is distinct from 'string' or length(trim(v->>'other')) not between 1 and 160 then return false; end if;
    elsif v ? 'other' and coalesce(v->>'other','')<>'' then return false; end if;
   else return false;
  end case;
 end loop;
 return true;
end $$;
create function feedback_private.dispatch(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
  return jsonb_build_object('leadership',lead,'surveys',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from (select s.*, (select count(*) from feedback_private.responses r where r.survey_id=s.id) response_count from feedback_private.surveys s where lead or s.organizer_id=org) t),'[]'::jsonb),'invites',case when lead then coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',label,'expires_at',expires_at,'revoked',revoked)) from feedback_private.organizers where token_hash<>'internal-ai-budget'),'[]'::jsonb) else '[]'::jsonb end);
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
revoke all on all functions in schema feedback_private from public,anon,authenticated;
grant execute on function feedback_private.dispatch(text,jsonb) to anon,authenticated,service_role;
create function public.rcap_feedback(p_action text,p_payload jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$ select feedback_private.dispatch(p_action,p_payload) $$;
revoke all on function public.rcap_feedback(text,jsonb) from public;
grant execute on function public.rcap_feedback(text,jsonb) to anon,authenticated,service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('rcap-feedback-voices','rcap-feedback-voices',false,2097152,array['audio/webm','audio/mp4','audio/ogg','audio/wav']);
create function feedback_private.voice_access(p_name text,p_write boolean) returns boolean language plpgsql stable security definer set search_path='' as $$
declare v feedback_private.voices; headers jsonb:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb; secret text; org uuid;
begin
 select * into v from feedback_private.voices where id::text||'/recording'=p_name;
 if not found then return false; end if;
 if p_write then return not v.complete and v.created_at>now()-interval '1 hour' and headers->>'x-feedback-token'=v.id::text; end if;
 secret:=headers->>'x-feedback-admin';
 if coalesce(public.vault_pass_ok('rcap',secret),false) then return v.complete; end if;
 org:=feedback_private.organizer(secret);
 return v.complete and v.permission='community' and org is not null and exists(select 1 from feedback_private.surveys where id=v.survey_id and organizer_id=org);
end $$;
revoke all on function feedback_private.voice_access(text,boolean) from public;
grant execute on function feedback_private.voice_access(text,boolean) to anon,authenticated,service_role;
create policy feedback_voice_insert on storage.objects for insert to anon,authenticated with check(bucket_id='rcap-feedback-voices' and feedback_private.voice_access(name,true));
create policy feedback_voice_read on storage.objects for select to anon,authenticated using(bucket_id='rcap-feedback-voices' and feedback_private.voice_access(name,false));

insert into feedback_private.surveys(id,slug,event_name,event_date,title,intro,gallery_url,questions,voices_enabled,status) values ('6b0fb341-9c4d-4ee3-992a-74f6bc9fd396','rb-karaoke','R&B Karaoke Night','2026-09-27','Your night. Your honest take.','The music brought us together. Your feedback helps us make the next one better. Tell us what you loved and what missed the mark. Honest criticism is welcome. This is for our whole RCA school community.','/rcap-capsule/#/e/karaoke-night', $questions$[{"id": "enjoyment", "type": "rating", "title": "How was your night?", "help": "Think about your overall experience at R&B Karaoke Night.", "required": true}, {"id": "experiences", "type": "matrix", "title": "What did you enjoy?", "help": "Rate each part, or choose Didn\u2019t try / Not applicable.", "required": true, "items": [{"id": "food", "label": "Food"}, {"id": "dj", "label": "DJ / hosting"}, {"id": "karaoke", "label": "Karaoke"}, {"id": "dancing", "label": "Dancing / party portion"}, {"id": "booth", "label": "Photo booth"}]}, {"id": "comfort", "type": "choice", "title": "How comfortable was the space?", "help": "Think about the standing-only setup and the availability of tables and seating.", "required": true, "options": [{"id": "comfortable", "label": "Comfortable as it was"}, {"id": "some_seating", "label": "Mostly comfortable, but some seating would help"}, {"id": "more_seating", "label": "Uncomfortable. We needed more tables and seating"}, {"id": "unsure", "label": "Not sure / no opinion"}]}, {"id": "length", "type": "choice", "title": "How did two hours feel?", "required": true, "options": [{"id": "short", "label": "Too short"}, {"id": "right", "label": "About right"}, {"id": "long", "label": "Too long"}]}, {"id": "future", "type": "multi", "title": "What should we do next?", "help": "Choose up to two parent experiences you would enjoy.", "required": true, "max": 2, "options": [{"id": "music", "label": "More music, karaoke & dancing"}, {"id": "games", "label": "Game or trivia night"}, {"id": "dinner", "label": "A relaxed meal together"}, {"id": "creative", "label": "A creative class or workshop"}, {"id": "outdoors", "label": "An outdoor outing or activity"}, {"id": "service", "label": "A community service project"}, {"id": "other", "label": "Other"}]}, {"id": "reflection", "type": "text", "title": "What should we keep or change?", "help": "A favorite moment, an honest criticism, or one idea for next time. We want to hear it.", "required": false}]$questions$::jsonb,true,'published');
