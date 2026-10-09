-- Committee knowledge stays private to verified members; all writes preserve author identity.
begin;
create schema if not exists playbook_private;
revoke all on schema playbook_private from public, anon;
grant usage on schema playbook_private to authenticated;
create table if not exists playbook_private.committees (
 id text primary key check(id in ('marcom','men','trunk')),
 name text not null, folder_id text not null, doc_id text not null, record_id text
);
create table if not exists playbook_private.catalog (id text primary key, section text not null, title text not null);
alter table playbook_private.catalog enable row level security;
revoke all on playbook_private.catalog from public,anon,authenticated;
insert into playbook_private.catalog(id,section,title) values
 ('purpose-why','purpose','What difference is this group here to make?'),
 ('purpose-scope','purpose','What belongs to us, and what belongs to someone else?'),
 ('purpose-success','purpose','At the end of the year, what would make us proud?'),
 ('perspective-keep','perspective','What should we never have to learn the hard way again?'),
 ('perspective-change','perspective','What was harder than it needed to be?'),
 ('perspective-fresh','perspective','What are we seeing with fresh eyes?'),
 ('people-roles','people','Who is bringing what to the table?'),
 ('people-leadership','people','Who will help this group move forward?'),
 ('people-norms','people','How do we want working together to feel?'),
 ('people-welcome','people','How will someone new find their place?'),
 ('provision-have','provision','What do we already have that the next team should know about?'),
 ('provision-need','provision','What would make this work easier?'),
 ('provision-budget','provision','What does the work really cost?'),
 ('provision-responsibility','provision','Who should provide or pay for what we need?'),
 ('provision-receipts','provision','How will we keep the money trail clear?'),
 ('plan-dates','plan','What needs to happen, and when should we start?'),
 ('plan-first','plan','What are the next two to four useful steps?'),
 ('plan-workflow','plan','How does the work move from beginning to end?'),
 ('plan-risks','plan','What could get in our way?'),
 ('pass-results','pass','What did we make happen?'),
 ('pass-lessons','pass','What would you tell yourself before doing this again?'),
 ('pass-trail','pass','Where can the next team find everything?'),
 ('pass-open','pass','What is still unfinished?'),
 ('pass-handoff','pass','Who is ready to carry this forward?') on conflict(id) do update set section=excluded.section,title=excluded.title;
create table if not exists playbook_private.members (
 committee text references playbook_private.committees(id), email text not null,
 role text not null default 'member' check(role in ('member','lead')),
 primary key(committee,email), check(email=lower(email))
);
create table if not exists playbook_private.questions (
 id uuid primary key default gen_random_uuid(), committee text not null references playbook_private.committees(id),
 section text not null check(section in ('purpose','perspective','people','provision','plan','pass')),
 title text not null check(length(title) between 5 and 300),
 parent_entry_id uuid, author_id uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create unique index if not exists pb_question_unique on playbook_private.questions(committee,lower(title));
create table if not exists playbook_private.entries (
 id uuid primary key default gen_random_uuid(), committee text not null references playbook_private.committees(id),
 question_id text not null check(length(question_id) between 1 and 100),
 question_text text not null check(length(question_text) between 5 and 300),
 section text not null check(section in ('purpose','perspective','people','provision','plan','pass')),
 author_id uuid not null references auth.users(id), author_name text not null check(length(author_name) between 1 and 80),
 content text not null check(length(content) between 1 and 6000),
 kind text not null default 'insight' check(kind in ('insight','need','proposal','lesson')),
 agreed boolean not null default false, agreed_by uuid references auth.users(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(committee,question_id,author_id)
);
do $$ begin if not exists(select 1 from pg_constraint where conname='pb_parent_entry' and conrelid='playbook_private.questions'::regclass) then alter table playbook_private.questions add constraint pb_parent_entry foreign key(parent_entry_id) references playbook_private.entries(id); end if; end $$;
create table if not exists playbook_private.comments (
 id uuid primary key default gen_random_uuid(), committee text not null references playbook_private.committees(id),
 entry_id uuid not null references playbook_private.entries(id), author_id uuid not null references auth.users(id),
 author_name text not null check(length(author_name) between 1 and 80),
 content text not null check(length(content) between 1 and 2000), created_at timestamptz not null default now()
);
create table if not exists playbook_private.actions (
 id uuid primary key default gen_random_uuid(), committee text not null references playbook_private.committees(id),
 title text not null check(length(title) between 1 and 500), owner_name text not null default '' check(length(owner_name)<=80),
 due_date date, done_when text not null default '' check(length(done_when)<=1000),
 status text not null default 'Not started' check(status in ('Not started','In progress','Waiting','Done')),
 author_id uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
create table if not exists playbook_private.export_limits (
 author_id uuid primary key references auth.users(id), window_start timestamptz not null default now(), requests integer not null default 0
);
alter table playbook_private.export_limits enable row level security;
create table if not exists playbook_private.history (
 id bigint generated always as identity primary key, committee text not null references playbook_private.committees(id),
 entry_id uuid not null references playbook_private.entries(id), snapshot jsonb not null, saved_at timestamptz not null default now()
);
create index if not exists pb_entries_committee on playbook_private.entries(committee,updated_at);
create index if not exists pb_comments_entry on playbook_private.comments(entry_id);
create index if not exists pb_questions_parent on playbook_private.questions(parent_entry_id);
create index if not exists pb_actions_committee on playbook_private.actions(committee);
create index if not exists pb_history_entry on playbook_private.history(entry_id);
alter table playbook_private.committees enable row level security;
alter table playbook_private.members enable row level security;
alter table playbook_private.questions enable row level security;
alter table playbook_private.entries enable row level security;
alter table playbook_private.comments enable row level security;
alter table playbook_private.actions enable row level security;
alter table playbook_private.history enable row level security;
revoke all on all tables in schema playbook_private from public,anon,authenticated;
insert into playbook_private.committees(id,name,folder_id,doc_id) values
 ('marcom','Marketing & Communications','1pXeiND1zX83ZHRVeAohCoGDl6E2VMhPz','18fBYlX6HVZb4TuAuOYfvvd-4rRkideEkGnYvgCUTuxU'),
 ('men','Men of RCAP','1I9vwzU5uj76AJEwdnsawxpQyltT_9zts','1Ciz10tVUmgZ4pqUHDuuZbW1OCGslcRowO4eCVgxhWf8'),
 ('trunk','Trunk or Treat','1fXwtQP9MtLyXCdFhA25o42ey-WKZniOS','1reeVoeYFcCQbyg9QaGNEnF5fNNePxxoKenIZ1lnDNnA') on conflict(id) do nothing;
update playbook_private.committees set record_id='1Zffu5ifTkIGyKacSSw5m4r4xy1A18JDUUPCQn1XfevU' where id='marcom';
update playbook_private.committees set record_id='1_ep0M2T5GsZi7oleUeIM7tsP3eIBefepcgFRje-R6pY' where id='men';
update playbook_private.committees set record_id='1hjAJ7bpy0m-N8hEtBG5YKjWGP_L-epIKgJQw32u7g8Y' where id='trunk';
-- Existing complete signups grant participation, not leadership. No invitations are sent.
insert into playbook_private.members(committee,email)
 select distinct c.id,lower(trim(i.email)) from public.committee_interest i
 cross join playbook_private.committees c where i.status='complete' and i.committees ? c.id and nullif(trim(i.email),'') is not null
 on conflict do nothing;
insert into playbook_private.members(committee,email,role)
 select c.id,e.email,'lead' from playbook_private.committees c cross join
 (values ('mose@mosejames.com'),('mosejames4@gmail.com'),('rcaparents@ronclarkacademy.com'),('crystalelizabethj@gmail.com'),('lemeri@abc-seniors.com'),('farren.salter@yahoo.com'),('ldsmith19@hotmail.com')) e(email)
 on conflict(committee,email) do update set role='lead';

-- This definer is deliberately private. The public wrapper is an invoker and only
-- authenticated callers may reach the private function. Every action checks a
-- confirmed auth.users email and the committee-specific membership before data access.
create or replace function playbook_private.handle(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); mail text; c text:=p_payload->>'committee'; r text; result jsonb;
 e playbook_private.entries%rowtype; a playbook_private.actions%rowtype; new_id uuid;
begin
 if uid is null then raise exception 'Sign in to your committee workspace.' using errcode='42501'; end if;
 select lower(email) into mail from auth.users where id=uid and email_confirmed_at is not null;
 if mail is null then raise exception 'Verify your email before joining.' using errcode='42501'; end if;
 if p_action='memberships' then
  return coalesce((select jsonb_agg(to_jsonb(t)) from (select x.*,m.role from playbook_private.committees x join playbook_private.members m on m.committee=x.id where m.email=mail order by x.name)t),'[]'::jsonb);
 end if;
 select role into r from playbook_private.members where committee=c and email=mail;
 if r is null then raise exception 'This committee workspace is for its members. Ask your committee lead to add your sign-in email.' using errcode='42501'; end if;
 if p_action='drive_export' then
  insert into playbook_private.export_limits(author_id,window_start,requests) values(uid,now(),1)
  on conflict(author_id) do update set requests=case when playbook_private.export_limits.window_start<now()-interval '1 minute' then 1 else playbook_private.export_limits.requests+1 end, window_start=case when playbook_private.export_limits.window_start<now()-interval '1 minute' then now() else playbook_private.export_limits.window_start end;
  if (select requests from playbook_private.export_limits where author_id=uid)>12 then raise exception 'Your answers are saved. Wait a minute before refreshing Drive again.'; end if;
 end if;
 if p_action in ('load','export','drive_export') then
  return jsonb_build_object(
   'committee',(select to_jsonb(x) from playbook_private.committees x where id=c),
   'role',r,
   'entries',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from playbook_private.entries x where committee=c),'[]'::jsonb),
   'questions',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from playbook_private.questions x where committee=c),'[]'::jsonb),
   'comments',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from playbook_private.comments x where committee=c),'[]'::jsonb),
   'actions',coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at) from playbook_private.actions x where committee=c),'[]'::jsonb),
   'history',case when p_action in ('export','drive_export') then coalesce((select jsonb_agg(to_jsonb(x) order by x.saved_at) from playbook_private.history x where committee=c),'[]'::jsonb) else '[]'::jsonb end,
   'exported_at',now());
 elsif p_action='save' then
  if nullif(trim(p_payload->>'content'),'') is null then raise exception 'Add a thought before saving.'; end if;
  if length(p_payload->>'question_id')=36 then
   if not exists(select 1 from playbook_private.questions where id::text=p_payload->>'question_id' and committee=c and title=p_payload->>'question_text' and section=p_payload->>'section') then raise exception 'That follow-up does not belong to this committee.'; end if;
  elsif not exists(select 1 from playbook_private.catalog where id=p_payload->>'question_id' and title=p_payload->>'question_text' and section=p_payload->>'section') then
   raise exception 'Choose a question from the committee playbook.';
  end if;
  select * into e from playbook_private.entries where committee=c and question_id=p_payload->>'question_id' and author_id=uid for update;
  if found then
   if nullif(p_payload->>'expected_updated_at','') is null or (p_payload->>'expected_updated_at')::timestamptz<>e.updated_at then raise exception 'Your answer changed on another device. Refresh before editing again.' using errcode='40001'; end if;
   insert into playbook_private.history(committee,entry_id,snapshot) values(c,e.id,to_jsonb(e));
   update playbook_private.entries set content=trim(p_payload->>'content'),author_name=trim(p_payload->>'author_name'),kind=coalesce(p_payload->>'kind','insight'),agreed=false,agreed_by=null,updated_at=clock_timestamp() where id=e.id returning id into new_id;
  else
   insert into playbook_private.entries(committee,question_id,question_text,section,author_id,author_name,content,kind)
   values(c,p_payload->>'question_id',p_payload->>'question_text',p_payload->>'section',uid,trim(p_payload->>'author_name'),trim(p_payload->>'content'),coalesce(p_payload->>'kind','insight')) returning id into new_id;
  end if;
  return jsonb_build_object('id',new_id);
 elsif p_action='comment' then
  if not exists(select 1 from playbook_private.entries where id=(p_payload->>'entry_id')::uuid and committee=c) then raise exception 'Contribution unavailable.'; end if;
  if nullif(trim(p_payload->>'content'),'') is null then raise exception 'Add a comment before sending.'; end if;
  insert into playbook_private.comments(committee,entry_id,author_id,author_name,content) values(c,(p_payload->>'entry_id')::uuid,uid,trim(p_payload->>'author_name'),trim(p_payload->>'content')) returning id into new_id;
  return jsonb_build_object('id',new_id);
 elsif p_action='question' then
  if p_payload->>'parent_entry_id' is not null and not exists(select 1 from playbook_private.entries where id=(p_payload->>'parent_entry_id')::uuid and committee=c) then raise exception 'Contribution unavailable.'; end if;
  if (select count(*) from playbook_private.questions where committee=c)>=100 then raise exception 'Review the existing follow-ups before adding more.'; end if;
  insert into playbook_private.questions(committee,section,title,parent_entry_id,author_id) values(c,p_payload->>'section',trim(p_payload->>'title'),nullif(p_payload->>'parent_entry_id','')::uuid,uid)
  on conflict(committee,lower(title)) do nothing returning id into new_id;
  return jsonb_build_object('id',new_id);
 elsif p_action='agree' then
  if r<>'lead' then raise exception 'A committee lead records group agreement.' using errcode='42501'; end if;
  select * into e from playbook_private.entries where id=(p_payload->>'id')::uuid and committee=c for update;
  if not found then raise exception 'Contribution unavailable.'; end if;
  insert into playbook_private.history(committee,entry_id,snapshot) values(c,e.id,to_jsonb(e));
  update playbook_private.entries set agreed=coalesce((p_payload->>'agreed')::boolean,false),agreed_by=uid,updated_at=clock_timestamp() where id=e.id;
  return jsonb_build_object('ok',true);
 elsif p_action='action' then
  new_id:=nullif(p_payload->>'id','')::uuid;
  if new_id is not null then
   select * into a from playbook_private.actions where id=new_id and committee=c for update;
   if not found or (a.author_id<>uid and r<>'lead') then raise exception 'Only the creator or a committee lead can update this action.' using errcode='42501'; end if;
   update playbook_private.actions set title=trim(p_payload->>'title'),owner_name=trim(coalesce(p_payload->>'owner_name','')),due_date=nullif(p_payload->>'due_date','')::date,done_when=coalesce(p_payload->>'done_when',''),status=coalesce(p_payload->>'status','Not started'),updated_at=clock_timestamp() where id=new_id;
  else
   insert into playbook_private.actions(committee,title,owner_name,due_date,done_when,status,author_id) values(c,trim(p_payload->>'title'),trim(coalesce(p_payload->>'owner_name','')),nullif(p_payload->>'due_date','')::date,coalesce(p_payload->>'done_when',''),coalesce(p_payload->>'status','Not started'),uid) returning id into new_id;
  end if;
  return jsonb_build_object('id',new_id);
 elsif p_action='members' then
  if r<>'lead' then raise exception 'Committee lead access required.' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(m) order by email) from playbook_private.members m where committee=c),'[]'::jsonb);
 elsif p_action='add_member' then
  if r<>'lead' then raise exception 'Committee lead access required.' using errcode='42501'; end if;
  if trim(p_payload->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address.'; end if;
  insert into playbook_private.members(committee,email,role) values(c,lower(trim(p_payload->>'email')),case when p_payload->>'role'='lead' then 'lead' else 'member' end)
  on conflict(committee,email) do nothing;
  return jsonb_build_object('ok',true);
 else raise exception 'Unknown playbook action.'; end if;
end; $$;
revoke all on function playbook_private.handle(text,jsonb) from public,anon;
grant execute on function playbook_private.handle(text,jsonb) to authenticated;
create or replace function public.rcap_playbook(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select playbook_private.handle(p_action,p_payload); $$;
revoke all on function public.rcap_playbook(text,jsonb) from public,anon;
grant execute on function public.rcap_playbook(text,jsonb) to authenticated;
commit;
