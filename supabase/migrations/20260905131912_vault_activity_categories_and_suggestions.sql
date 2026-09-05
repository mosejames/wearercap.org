alter table public.vault_events add column category text check(category in('everyday','cheers','exp','sports'));
alter table public.vault_events add column ongoing boolean not null default false;
update public.vault_events set category='everyday',ongoing=true where kind='everyday';
insert into public.vault_events(house,slug,title,blurb,kind,starts_on,ends_on,category,ongoing,open)
select 'amistad',x.slug,x.title,x.blurb,'house',e.starts_on,e.ends_on,x.category,true,true
from (values ('house-cheers','House Cheers','Cheers, chants, and house spirit. Share the photos and videos that bring our house together.','cheers'),('exp','EXP','Keep our EXP memories together. Share your favorite photos and videos.','exp'),('sports-and-games','Sports & Games','From basketball games to cheering from the sidelines. Share the moments that bring us together.','sports')) x(slug,title,blurb,category)
cross join lateral (select starts_on,ends_on from public.vault_events where kind='everyday' order by starts_on desc limit 1) e
where not exists(select 1 from public.vault_events v where v.slug=x.slug);
-- Keep the existing authorized event editor, extending its returned record.
do $$ declare d text; begin
 d:=pg_get_functiondef('public.vault_admin_save_event(text,uuid,jsonb)'::regprocedure);
 d:=replace(d,'  return r;',E'  update public.vault_events set category=case when p ? ''category'' then nullif(p->>''category'','''') else category end, ongoing=coalesce((p->>''ongoing'')::boolean,ongoing) where id=r.id returning * into r;\n  return r;');
 execute d;
end $$;
create table vault_private.event_suggestions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),title text not null,description text not null default '',starts_on date,ongoing boolean not null,category text check(category in('everyday','cheers','exp','sports')),status text not null default 'pending' check(status in('pending','approved','linked','dismissed')),event_id uuid references public.vault_events(id),created_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid);
alter table vault_private.event_suggestions enable row level security;
create function public.vault_suggest_event(p_title text,p_description text,p_date date,p_ongoing boolean,p_category text) returns uuid language plpgsql security definer set search_path='' as $$
declare id uuid;
begin
 if vault_private.active_owner() is null then raise exception 'Verify your phone before suggesting an event'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if (select count(*) from vault_private.event_suggestions where user_id=auth.uid() and created_at>now()-interval '1 day')>=5 then raise exception 'You have sent five ideas today. Please let us review those first.'; end if;
 if length(trim(p_title)) not between 3 and 100 or length(coalesce(p_description,''))>500 then raise exception 'Enter a name between 3 and 100 characters and a description under 500 characters'; end if;
 if not p_ongoing and p_date is null then raise exception 'Choose a date or Ongoing'; end if;
 insert into vault_private.event_suggestions(user_id,title,description,starts_on,ongoing,category) values(auth.uid(),trim(p_title),coalesce(p_description,''),case when p_ongoing then null else p_date end,p_ongoing,nullif(p_category,'')) returning event_suggestions.id into id;
 return id;
end $$;
create function public.vault_event_suggestions(p_pass text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.vault_pass_ok('amistad',p_pass) then raise exception 'Admin access required'; end if;
 return coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('name',p.display_name) order by s.created_at) from vault_private.event_suggestions s join vault_private.members m on m.user_id=s.user_id join public.vault_profiles p on p.owner=m.owner where s.status='pending'),'[]');
end $$;
create function public.vault_review_event_suggestion(p_id uuid,p_action text,p_event uuid default null,p_category text default null,p_pass text default '') returns uuid language plpgsql security definer set search_path='' as $$
declare s vault_private.event_suggestions; new_id uuid; term record;
begin
 if not public.vault_pass_ok('amistad',p_pass) then raise exception 'Admin access required'; end if;
 select * into s from vault_private.event_suggestions where id=p_id for update;
 if s.id is null or s.status<>'pending' then raise exception 'This suggestion has already been reviewed'; end if;
 if p_action='approve' then
  select starts_on,ends_on into term from public.vault_events where kind='everyday' order by starts_on desc limit 1;
  insert into public.vault_events(house,slug,title,blurb,kind,starts_on,ends_on,category,ongoing,open) values('amistad',trim(both '-' from regexp_replace(lower(s.title),'[^a-z0-9]+','-','g'))||'-'||left(s.id::text,8),s.title,s.description,'house',case when s.ongoing then term.starts_on else s.starts_on end,case when s.ongoing then term.ends_on else null end,nullif(p_category,''),s.ongoing,true) returning id into new_id;
 elsif p_action='link' then
  select id into new_id from public.vault_events where id=p_event and not hidden;
  if new_id is null then raise exception 'Choose an existing gallery'; end if;
 elsif p_action<>'dismiss' then raise exception 'Choose approve, link, or dismiss'; end if;
 update vault_private.event_suggestions set status=case p_action when 'approve' then 'approved' when 'link' then 'linked' else 'dismissed' end,event_id=new_id,reviewed_at=now(),reviewed_by=auth.uid() where id=p_id;
 return new_id;
end $$;
revoke all on function public.vault_suggest_event(text,text,date,boolean,text) from public,anon;
grant execute on function public.vault_suggest_event(text,text,date,boolean,text) to authenticated;
revoke all on function public.vault_event_suggestions(text),public.vault_review_event_suggestion(uuid,text,uuid,text,text) from public;
grant execute on function public.vault_event_suggestions(text),public.vault_review_event_suggestion(uuid,text,uuid,text,text) to anon,authenticated;
