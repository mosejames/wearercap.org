begin;
create table playbook_private.ideas (
 id uuid primary key default gen_random_uuid(),
 committee text not null references playbook_private.committees(id),
 author_id uuid not null references auth.users(id),
 author_name text not null check(length(trim(author_name)) between 1 and 80),
 content text not null check(length(trim(content)) between 1 and 3000),
 kind text not null default 'Idea' check(kind in ('Idea','Question','Lesson','Proposed date','Confirmed date','Recurring reminder')),
 timeframe text not null default '' check(length(timeframe)<=300),
 event_date date,
 context text not null default '' check(length(context)<=2000),
 involve text not null default '' check(length(involve)<=300),
 status text not null default 'Open for discussion' check(status in ('Open for discussion','Exploring','Ready for a decision','Agreed','Revisit later')),
 sections text[] not null default '{}' check(sections <@ array['purpose','perspective','people','provision','plan','pass']::text[]),
 version integer not null default 1,
 previous_versions jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(kind<>'Confirmed date' or event_date is not null)
);
create index ideas_committee on playbook_private.ideas(committee,created_at);
create table playbook_private.idea_comments (
 id uuid primary key default gen_random_uuid(), committee text not null references playbook_private.committees(id),
 idea_id uuid not null references playbook_private.ideas(id),
 author_id uuid not null references auth.users(id), author_name text not null check(length(trim(author_name)) between 1 and 80),
 content text not null check(length(trim(content)) between 1 and 2000), created_at timestamptz not null default now()
);
create index idea_comments_committee on playbook_private.idea_comments(committee,idea_id);
alter table playbook_private.ideas enable row level security;
alter table playbook_private.idea_comments enable row level security;
revoke all on playbook_private.ideas,playbook_private.idea_comments from public,anon,authenticated;
alter table playbook_private.actions add column idea_id uuid references playbook_private.ideas(id);
-- The existing handler remains the authority for verified membership and existing actions.
-- This private wrapper adds capture and discussion without broadening table access.
create function playbook_private.with_ideas(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c text:=p_payload->>'committee'; uid uuid:=auth.uid(); access jsonb; result jsonb;
 item playbook_private.ideas%rowtype; iid uuid; next_status text; next_kind text;
begin
 if p_action='memberships' then return playbook_private.handle(p_action,p_payload); end if;
 if p_action in ('load','export','drive_export') then
  result:=playbook_private.handle(p_action,p_payload);
  return result||jsonb_build_object(
   'ideas',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc) from playbook_private.ideas i where i.committee=c),'[]'::jsonb),
   'idea_comments',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from playbook_private.idea_comments x where x.committee=c),'[]'::jsonb));
 end if;
 if p_action not in ('idea','idea_comment') and not (p_action='action' and p_payload ? 'idea_id') then
  return playbook_private.handle(p_action,p_payload);
 end if;
 access:=playbook_private.handle('load',p_payload); -- Rejects outsiders before inspecting any idea.
 if p_action='idea' then
  iid:=nullif(p_payload->>'id','')::uuid;
  next_status:=coalesce(p_payload->>'status','Open for discussion'); next_kind:=coalesce(p_payload->>'kind','Idea');
  if (next_status='Agreed' or next_kind='Confirmed date') and access->>'role'<>'lead' then
   raise exception 'A chair or lead records agreement and confirms dates.' using errcode='42501';
  end if;
  if iid is not null then
   select * into item from playbook_private.ideas where id=iid and committee=c for update;
   if not found then raise exception 'This idea is unavailable.' using errcode='42501'; end if;
   if item.author_id<>uid and access->>'role'<>'lead' then raise exception 'Only the contributor or a lead can update this item.' using errcode='42501'; end if;
   if coalesce((p_payload->>'version')::integer,0)<>item.version then raise exception 'This item changed. Refresh before editing again.' using errcode='40001'; end if;
   if item.author_id<>uid and trim(p_payload->>'content') is distinct from item.content then raise exception 'Keep the contributor’s words intact. Add your perspective in a reply.' using errcode='42501'; end if;
   if trim(p_payload->>'content') is distinct from item.content or coalesce(p_payload->>'timeframe','') is distinct from item.timeframe or nullif(p_payload->>'event_date','')::date is distinct from item.event_date or coalesce(p_payload->>'context','') is distinct from item.context then
    if item.status='Agreed' then next_status:='Exploring'; end if;
    if item.kind='Confirmed date' then next_kind:='Proposed date'; end if;
   end if;
   update playbook_private.ideas set content=trim(p_payload->>'content'),kind=next_kind,status=next_status,
    timeframe=coalesce(p_payload->>'timeframe',''),event_date=nullif(p_payload->>'event_date','')::date,
    context=coalesce(p_payload->>'context',''),involve=coalesce(p_payload->>'involve',''),
    sections=array(select distinct jsonb_array_elements_text(coalesce(p_payload->'sections','[]'::jsonb))),
    previous_versions=previous_versions||jsonb_build_array(to_jsonb(item)-'previous_versions'),version=version+1,updated_at=clock_timestamp()
    where id=iid;
  else
   insert into playbook_private.ideas(committee,author_id,author_name,content,kind,status,timeframe,event_date,context,involve,sections)
   values(c,uid,trim(p_payload->>'author_name'),trim(p_payload->>'content'),next_kind,next_status,coalesce(p_payload->>'timeframe',''),nullif(p_payload->>'event_date','')::date,coalesce(p_payload->>'context',''),coalesce(p_payload->>'involve',''),array(select distinct jsonb_array_elements_text(coalesce(p_payload->'sections','[]'::jsonb)))) returning id into iid;
  end if;
  return jsonb_build_object('id',iid);
 elsif p_action='idea_comment' then
  iid:=(p_payload->>'idea_id')::uuid;
  if not exists(select 1 from playbook_private.ideas where id=iid and committee=c) then raise exception 'This idea is unavailable.' using errcode='42501'; end if;
  insert into playbook_private.idea_comments(committee,idea_id,author_id,author_name,content)
   values(c,iid,uid,trim(p_payload->>'author_name'),trim(p_payload->>'content'));
  return jsonb_build_object('ok',true);
 else
  iid:=nullif(p_payload->>'idea_id','')::uuid;
  if iid is not null and not exists(select 1 from playbook_private.ideas where id=iid and committee=c) then raise exception 'This idea is unavailable.' using errcode='42501'; end if;
  result:=playbook_private.handle('action',p_payload);
  update playbook_private.actions set idea_id=iid where id=(result->>'id')::uuid and committee=c;
  return result;
 end if;
end $$;
revoke all on function playbook_private.with_ideas(text,jsonb) from public,anon;
grant execute on function playbook_private.with_ideas(text,jsonb) to authenticated;
create or replace function public.rcap_playbook(p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select playbook_private.with_ideas(p_action,p_payload); $$;
commit;
