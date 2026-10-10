begin;
alter table playbook_private.committees drop constraint committees_id_check;
alter table playbook_private.committees add constraint committees_id_check check(id in ('marcom','men','trunk','raffle','uniform'));
insert into playbook_private.committees(id,name,folder_id,doc_id,record_id) values('uniform','Uniform Committee','1EtdK_2DqIMAUsZoJz0pxTSfqkQvgzi-0','1oqqH5ehFXeAisZF_1NAez1AZyU1hJXShNawT1oIhCE4','1kIe4ZpWdI-mIWNsVITuJpNWo4ETXYZTMaD5O5x2zEtU');
insert into playbook_private.members(committee,email) select distinct 'uniform',lower(trim(email)) from public.committee_interest where status='complete' and committees ? 'uniform' and nullif(trim(email),'') is not null on conflict do nothing;
-- Global admins already have access via the admins table. Chair access is scoped
-- and can be assigned by an admin through Manage committee access.
create or replace function playbook_private.handle(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 uid uuid:=auth.uid(); mail text; c text:=p_payload->>'committee'; r text; result jsonb; is_admin boolean;
 e playbook_private.entries%rowtype; a playbook_private.actions%rowtype; new_id uuid;
begin
 if uid is null then raise exception 'Sign in to your committee workspace.' using errcode='42501'; end if;
 select lower(email) into mail from auth.users where id=uid and email_confirmed_at is not null;
 if mail is null then raise exception 'Verify your email before joining.' using errcode='42501'; end if;
 select exists(select 1 from playbook_private.admins where email=mail) into is_admin;
 if p_action='memberships' then
  return coalesce((select jsonb_agg(to_jsonb(t)) from (select x.*,case when is_admin then 'lead' else m.role end as role,is_admin from playbook_private.committees x left join playbook_private.members m on m.committee=x.id and m.email=mail where is_admin or m.email is not null order by x.name)t),'[]'::jsonb);
 end if;
 select role into r from playbook_private.members where committee=c and email=mail;
 if is_admin and exists(select 1 from playbook_private.committees where id=c) then r:='lead'; end if;
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
   'is_admin',is_admin,
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
 elsif p_action='set_member_role' then
  if not is_admin then raise exception 'Only an administrator can assign committee chairs.' using errcode='42501'; end if;
  if nullif(trim(p_payload->>'email'),'') is null or trim(p_payload->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address.'; end if;
  insert into playbook_private.members(committee,email,role) values(c,lower(trim(p_payload->>'email')),case when p_payload->>'role'='lead' then 'lead' else 'member' end)
  on conflict(committee,email) do update set role=excluded.role;
  return jsonb_build_object('ok',true);
 elsif p_action='add_member' then
  if r<>'lead' then raise exception 'Committee lead access required.' using errcode='42501'; end if;
  if trim(p_payload->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address.'; end if;
  insert into playbook_private.members(committee,email,role) values(c,lower(trim(p_payload->>'email')),'member')
  on conflict(committee,email) do nothing;
  return jsonb_build_object('ok',true);
 else raise exception 'Unknown playbook action.'; end if;
end; $$;


commit;
