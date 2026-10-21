-- NYC-only conversations; raw tables remain inaccessible to API roles.
create table trip_private.reactions (
 photo_id uuid not null references trip_private.photos(id),
 owner text not null, active boolean not null default true, reaction text not null check(reaction in ('love','celebrate','thanks','amazing','bravo')),
 primary key(photo_id,owner,reaction)
);
create table trip_private.comments (
 id uuid primary key default gen_random_uuid(),photo_id uuid not null references trip_private.photos(id),
 owner text not null,author_name text not null check(length(author_name) between 1 and 60),
 body text not null check(length(body) between 1 and 500),created_at timestamptz not null default now(),hidden boolean not null default false
);
create index trip_comments_photo on trip_private.comments(photo_id,created_at) where not hidden;
create index trip_comments_owner on trip_private.comments(owner,created_at);
create table trip_private.response_requests(owner text not null,minute timestamptz not null,count integer not null,primary key(owner,minute));
alter table trip_private.reactions enable row level security;
alter table trip_private.comments enable row level security;
alter table trip_private.response_requests enable row level security;
revoke all on trip_private.reactions,trip_private.comments,trip_private.response_requests from public,anon,authenticated;
create function trip_private.conversation(p_photo uuid,p_token text,p_action text default 'read',p_body text default '',p_name text default '',p_reaction text default '',p_comment uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare o text; n integer;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'A response token is required'; end if;
 o:=encode(extensions.digest(p_token,'sha256'),'hex');
 -- Lock visibility for the transaction, so a hidden photo cannot receive responses.
 perform 1 from trip_private.photos where id=p_photo and vault='nyc-2026' and not hidden for share;
 if not found then raise exception 'This moment is no longer available'; end if;
 if p_action is null or p_action not in ('read','react','comment','remove') then raise exception 'Unknown action'; end if;
 if p_action <> 'read' then
  perform pg_advisory_xact_lock(hashtextextended(o,1));
  insert into trip_private.response_requests(owner,minute,count) values(o,date_trunc('minute',now()),1)
  on conflict(owner,minute) do update set count=trip_private.response_requests.count+1 returning count into n;
  if n>120 then raise exception 'Please wait a minute before responding again'; end if;
 end if;
 if p_action='react' then
  if p_reaction is null or p_reaction not in ('love','celebrate','thanks','amazing','bravo') then raise exception 'Choose a positive reaction'; end if;
  insert into trip_private.reactions(photo_id,owner,reaction) values(p_photo,o,p_reaction)
  on conflict(photo_id,owner,reaction) do update set active=not trip_private.reactions.active;
 elsif p_action='comment' then
  if p_body is null or length(btrim(p_body)) not between 1 and 500 or p_name is null or length(btrim(p_name)) not between 1 and 60 then raise exception 'Add a comment up to 500 characters and a name up to 60 characters'; end if;
  if (select count(*) from trip_private.comments where owner=o and created_at>now()-interval '1 hour')>=60 then raise exception 'Please wait before adding more comments'; end if;
  insert into trip_private.comments(photo_id,owner,author_name,body) values(p_photo,o,btrim(p_name),btrim(p_body));
 elsif p_action='remove' then
  update trip_private.comments set hidden=true where id=p_comment and photo_id=p_photo and owner=o and not hidden;
  if not found then raise exception 'This comment does not belong to this device'; end if;
 end if;
 return jsonb_build_object(
  'reactions',coalesce((select jsonb_agg(r order by r.reaction) from(select reaction,count(*) as count,bool_or(owner=o) as mine from trip_private.reactions where photo_id=p_photo and active group by reaction)r),'[]'::jsonb),
  'comments',coalesce((select jsonb_agg(c order by c.created_at,c.id) from(select id,author_name,body,created_at,owner=o as mine from trip_private.comments where photo_id=p_photo and not hidden order by created_at desc,id desc limit 500)c),'[]'::jsonb));
end $$;
create function public.trip_conversation(p_photo uuid,p_token text,p_action text default 'read',p_body text default '',p_name text default '',p_reaction text default '',p_comment uuid default null)
returns jsonb language sql security invoker set search_path='' as $$select trip_private.conversation(p_photo,p_token,p_action,p_body,p_name,p_reaction,p_comment)$$;
revoke all on function trip_private.conversation(uuid,text,text,text,text,text,uuid),public.trip_conversation(uuid,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function trip_private.conversation(uuid,text,text,text,text,text,uuid),public.trip_conversation(uuid,text,text,text,text,text,uuid) to anon,authenticated;
notify pgrst,'reload schema';
