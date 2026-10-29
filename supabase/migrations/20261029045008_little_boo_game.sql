begin;
create schema if not exists boo_private;
revoke all on schema boo_private from public,anon,authenticated;
create table boo_private.players(user_id uuid primary key references auth.users(id),display text not null check(length(display) between 2 and 40),house text not null check(house in ('Amistad','Altruismo','Isibindi','Reveur')),grade text not null check(length(grade) between 1 and 24), own_names text[] not null default '{}',created_at timestamptz not null default now());
create table boo_private.settings(id bool primary key default true check(id),closes_at timestamptz,timezone text not null default 'America/New_York',tie_rule text not null default 'unsettled' check(tie_rule in ('unsettled','shared-rank','earliest-score')),finalized_at timestamptz,awards jsonb);
insert into boo_private.settings(id) values(true);
create table boo_private.people(id uuid primary key default gen_random_uuid(),mode text not null check(mode in ('children','adults')),name text not null check(length(name) between 2 and 80),normalized text not null,aliases text[] not null default '{}',house text not null,grade text not null,owner uuid not null references auth.users(id),unique(mode,normalized));
create table boo_private.photos(id uuid primary key,person uuid unique not null references boo_private.people(id),owner uuid not null references auth.users(id),mode text not null check(mode in ('children','adults')),object_key text not null unique,storage text not null default 'r2' check(storage='r2'),content_hash text unique not null,capsule text not null,proof_hash text not null,caption text not null default '' check(length(caption)<=100),state text not null default 'active' check(state in ('active','removed')),first_correct uuid,created_at timestamptz not null default now());
create table boo_private.plays(user_id uuid references auth.users(id),photo uuid references boo_private.photos(id),hinted bool not null default false,choices jsonb,points integer not null default 0 check(points in (0,1,3,5)),correct_at timestamptz,submitted bool not null default false,pending uuid,pending_at timestamptz,guess text,primary key(user_id,photo));
create table boo_private.limits(user_id uuid references auth.users(id),bucket timestamptz,used int not null default 0,primary key(user_id,bucket));
create table boo_private.reports(id uuid primary key default gen_random_uuid(),photo uuid references boo_private.photos(id),reporter uuid references auth.users(id),reason text not null check(length(reason) between 3 and 300),created_at timestamptz default now(),resolved bool not null default false,unique(photo,reporter));
create table boo_private.notifications(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),message text not null,created_at timestamptz default now());
create table boo_private.audit(id bigint generated always as identity primary key,actor uuid,action text,payload jsonb,created_at timestamptz default now());
create index on boo_private.photos(mode,state);
create index on boo_private.plays(photo,correct_at);
create index on boo_private.notifications(user_id,created_at);
create function boo_private.normalize(v text) returns text language sql immutable set search_path='' as $$ select regexp_replace(lower(translate(trim(v),'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÑñÇç','AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuNnCc')),'[^a-z0-9]','','g') $$;
create function boo_private.board(m text) returns jsonb language sql stable set search_path='' as $$
select jsonb_build_object('individual',coalesce((select jsonb_agg(to_jsonb(x)) from (select p.user_id as id,p.display,p.house,p.grade,sum(s.points)::int points,count(*)::int identified,max(s.correct_at) reached from boo_private.players p join boo_private.plays s on s.user_id=p.user_id join boo_private.photos f on f.id=s.photo where f.mode=m and f.state='active' and s.points>0 group by p.user_id order by sum(s.points) desc,max(s.correct_at),p.user_id) x),'[]'::jsonb),'house',coalesce((select jsonb_agg(to_jsonb(x)) from (select p.house as label,sum(s.points)::int points from boo_private.players p join boo_private.plays s on s.user_id=p.user_id join boo_private.photos f on f.id=s.photo where f.mode=m and f.state='active' and s.points>0 group by p.house order by sum(s.points) desc,p.house)x),'[]'::jsonb),'grade',coalesce((select jsonb_agg(to_jsonb(x)) from (select p.grade as label,sum(s.points)::int points from boo_private.players p join boo_private.plays s on s.user_id=p.user_id join boo_private.photos f on f.id=s.photo where f.mode=m and f.state='active' and s.points>0 group by p.grade order by sum(s.points) desc,p.grade)x),'[]'::jsonb)) $$;
create function boo_private.game(a text,b jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); admin bool; f boo_private.photos; p boo_private.people; me boo_private.players; s boo_private.plays; cfg boo_private.settings; m text:=coalesce(b->>'mode','children'); n text; vals text[]; pid uuid; pts int; used_count int; v_choices jsonb; result jsonb; cutoff timestamptz; v_awards jsonb;
begin
 if u is null or not exists(select 1 from auth.users where id=u and phone_confirmed_at is not null and coalesce(is_anonymous,false)=false) then raise exception 'Please sign in with your phone.' using errcode='42501'; end if;
 select exists(select 1 from vault_private.staff where user_id=u and role='owner') into admin;
 if m not in ('children','adults') or length(b::text)>18000 then raise exception 'Invalid game request.'; end if;
 if a in ('settings','finalize') then perform pg_advisory_xact_lock(291029); else perform pg_advisory_xact_lock_shared(291029); end if;
 select * into cfg from boo_private.settings where id=true;
 select * into me from boo_private.players where user_id=u;
 if a='profile' then
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  n:=trim(b->>'display');
  if length(n) not between 2 and 40 or b->>'house' not in ('Amistad','Altruismo','Isibindi','Reveur') or length(trim(b->>'grade')) not between 1 and 24 then raise exception 'Add a display name, house and grade.'; end if;
  if exists(select 1 from boo_private.plays where user_id=u and points>0) and (me.house<>b->>'house' or me.grade<>b->>'grade') then raise exception 'Your scoring house and grade are locked after your first point.'; end if;
  select coalesce(array_agg(distinct boo_private.normalize(value)) filter(where length(boo_private.normalize(value))>0),'{}') into vals from jsonb_array_elements_text(coalesce(b->'ownNames','[]'));
  -- Own-child declarations can only grow, so editing a profile cannot unlock self-scoring.
  vals:=array(select distinct unnest(vals||coalesce(me.own_names,'{}')));
  insert into boo_private.players(user_id,display,house,grade,own_names) values(u,n,b->>'house',trim(b->>'grade'),vals) on conflict(user_id) do update set display=excluded.display,house=excluded.house,grade=excluded.grade,own_names=excluded.own_names;
  return jsonb_build_object('ok',true);
 end if;
 if a='get' then
  return jsonb_build_object('userId',u,'me',case when me.user_id is null then null else jsonb_build_object('display',me.display,'house',me.house,'grade',me.grade) end,'isAdmin',admin,'settings',jsonb_build_object('closesAt',cfg.closes_at,'timezone',cfg.timezone,'tieRule',cfg.tie_rule,'finalizedAt',cfg.finalized_at),'photos',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'caption',x.caption,'createdAt',x.created_at,'own',x.owner=u or person.normalized=any(coalesce(me.own_names,'{}')),'canRemove',x.owner=u or admin,'correct',coalesce(t.points,0)>0,'points',coalesce(t.points,0),'hinted',coalesce(t.hinted,false),'submitted',coalesce(t.submitted,false),'pending',t.pending is not null,'pendingGuess',case when t.pending is not null then t.guess else null end,'choices',t.choices) order by x.created_at desc) from boo_private.photos x join boo_private.people person on person.id=x.person left join boo_private.plays t on t.photo=x.id and t.user_id=u where x.mode=m and x.state='active'),'[]'),'distinctChildren',(select count(*) from boo_private.photos where mode='children' and state='active'),'board',boo_private.board(m),'notifications',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,message,created_at from boo_private.notifications where user_id=u order by created_at desc limit 20)x),'[]'));
 end if;
 if a='admin' then
  if not admin then raise exception 'Owner access required.' using errcode='42501'; end if;
  return jsonb_build_object('reports',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'photo',r.photo,'reason',r.reason,'createdAt',r.created_at,'resolved',r.resolved,'state',x.state)) from boo_private.reports r join boo_private.photos x on x.id=r.photo),'[]'),'settings',to_jsonb(cfg),'board',boo_private.board('children'),'awards',cfg.awards);
 end if;
 if a in ('settings','finalize') then
  if not admin then raise exception 'Owner access required.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(291029);
  if a='settings' then
   if cfg.finalized_at is not null then raise exception 'Standings have already been finalized.'; end if;
   cutoff:=nullif(b->>'closesAt','')::timestamptz;
   if b->>'tieRule' not in ('unsettled','shared-rank','earliest-score') then raise exception 'Choose a tie rule.'; end if;
   if not exists(select 1 from pg_timezone_names where name=b->>'timezone') then raise exception 'Choose a valid timezone.'; end if;
   update boo_private.settings set closes_at=cutoff,timezone=b->>'timezone',tie_rule=b->>'tieRule';
  else
   if cfg.closes_at is null or cfg.closes_at>now() or cfg.tie_rule='unsettled' then raise exception 'Set and reach the closing time and settle ties before finalizing.'; end if;
   if cfg.finalized_at is not null then return cfg.awards; end if;
   with standings as (select pl.user_id,pl.display,sum(play.points)::int points,max(play.correct_at) reached from boo_private.players pl join boo_private.plays play on play.user_id=pl.user_id join boo_private.photos x on x.id=play.photo where x.mode='children' and x.state='active' and play.points>0 group by pl.user_id), ranks as(select *,case when cfg.tie_rule='earliest-score' then rank() over(order by points desc,reached) else rank() over(order by points desc) end as rank from standings) select coalesce(jsonb_agg(jsonb_build_object('playerId',user_id,'display',display,'points',points,'rank',rank,'tickets',case rank when 1 then 25 when 2 then 15 when 3 then 10 else 0 end) order by rank,display),'[]') into v_awards from ranks;
   update boo_private.settings set finalized_at=now(),awards=v_awards;
  end if;
  insert into boo_private.audit(actor,action,payload) values(u,a,b);
  return jsonb_build_object('ok',true,'awards',v_awards);
 end if;
 if a='upload' then
  if me.user_id is null then raise exception 'Set up your player profile first.'; end if;
  if cfg.finalized_at is not null or (cfg.closes_at is not null and now()>=cfg.closes_at) then raise exception 'This round has closed.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  if (select count(*) from boo_private.photos where owner=u and created_at>now()-interval '1 hour')>=12 then raise exception 'Upload limit reached. Try again later.'; end if;
  n:=boo_private.normalize(b->>'name');
  if length(n)<2 or length(b->>'name')>80 or b->>'consent' is distinct from 'true' then raise exception 'Add the full name and confirm permission to share.'; end if;
  if b->>'house' not in ('Amistad','Altruismo','Isibindi','Reveur') or length(b->>'grade') not between 1 and 24 then raise exception 'Choose the child house and grade.'; end if;
  select coalesce(array_agg(distinct boo_private.normalize(value)) filter(where length(boo_private.normalize(value))>1),'{}') into vals from jsonb_array_elements_text(coalesce(b->'aliases','[]'));
  if cardinality(vals)>10 then raise exception 'Use at most ten aliases.'; end if;
  if exists(select 1 from boo_private.people where mode=m and normalized=n) then raise exception 'This person already has a photo. One photo per person is allowed during this round.'; end if;
  if exists(select 1 from boo_private.photos where content_hash=b->>'hash') then raise exception 'This photo has already been submitted.'; end if;
  pid:=(b->>'id')::uuid;
  if b->>'key' <> 'little-boo/v1/'||pid::text||'.bin' or b->>'hash' !~ '^[0-9a-f]{64}$' then raise exception 'Invalid photo.'; end if;
  insert into boo_private.people(mode,name,normalized,aliases,house,grade,owner) values(m,trim(b->>'name'),n,vals,b->>'house',b->>'grade',u) returning id into pid;
  insert into boo_private.photos(id,person,owner,mode,object_key,content_hash,caption,capsule,proof_hash) values((b->>'id')::uuid,pid,u,m,b->>'key',b->>'hash',coalesce(b->>'caption',''),b->>'capsule',b->>'proofHash');
  if m='children' then update boo_private.players set own_names=array(select distinct unnest(own_names||array[n])) where user_id=u; end if;
  insert into boo_private.notifications(user_id,message) values(u,'Your photo is in the game. Thank you for sharing a little Halloween magic!');
  return jsonb_build_object('ok',true);
 end if;
 -- Serialize the player first, then the photo: hint use, rate limits and scores are atomic.
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 select * into f from boo_private.photos where id=(b->>'id')::uuid for update;
 if f.id is null then raise exception 'Photo unavailable.' using errcode='P0002'; end if;
 select * into p from boo_private.people where id=f.person;
 if a='remove' then
  if f.owner<>u and not admin then raise exception 'Only the uploader or owner can remove this photo.' using errcode='42501'; end if;
  update boo_private.photos set state='removed' where id=f.id;
  insert into boo_private.audit(actor,action,payload) values(u,a,jsonb_build_object('id',f.id));
  return jsonb_build_object('ok',true);
 end if;
 if a='resolve' then
  if not admin then raise exception 'Owner access required.' using errcode='42501'; end if;
  update boo_private.reports set resolved=true where photo=f.id;
  return jsonb_build_object('ok',true);
 end if;
 if f.state<>'active' then raise exception 'Photo unavailable.' using errcode='P0002'; end if;
 if a='media' then return jsonb_build_object('key',f.object_key); end if;
 if a='report' then
  insert into boo_private.reports(photo,reporter,reason) values(f.id,u,left(trim(b->>'reason'),300)) on conflict(photo,reporter) do update set reason=excluded.reason,resolved=false;
  return jsonb_build_object('ok',true);
 end if;
 if a not in ('guess','hint','judged','cancel-judge') then raise exception 'Unsupported game request.'; end if;
 if me.user_id is null then raise exception 'Set up your player profile first.'; end if;
 if cfg.finalized_at is not null or (cfg.closes_at is not null and now()>=cfg.closes_at) then raise exception 'This round has closed.'; end if;
 if f.owner=u or p.normalized=any(me.own_names) then raise exception 'Enjoy your own little boo, but guess someone else to score.'; end if;
 insert into boo_private.plays(user_id,photo) values(u,f.id) on conflict do nothing;
 select * into s from boo_private.plays where user_id=u and photo=f.id;
 if a in ('judged','cancel-judge') then
  if s.pending is null or s.pending::text<>b->>'pending' or encode(extensions.digest(b->>'proof','sha256'),'hex')<>f.proof_hash then raise exception 'Invalid spelling result.' using errcode='42501'; end if;
  if a='cancel-judge' then update boo_private.plays set pending=null,guess=null where user_id=u and photo=f.id; return jsonb_build_object('retry',true); end if;
  n:=case when b->>'correct'='true' then p.normalized else '' end;
 elsif s.pending is not null then
  if s.pending_at>clock_timestamp()-interval '20 seconds' then raise exception 'A spelling check is already running. Try resuming in 20 seconds.'; end if;
  update boo_private.plays set pending_at=clock_timestamp() where user_id=u and photo=f.id;
  return jsonb_build_object('pending',s.pending,'capsule',f.capsule,'guess',s.guess);
 end if;
 if s.submitted then return jsonb_build_object('correct',s.points>0,'points',s.points,'alreadyScored',true); end if;
 if s.points>0 then return jsonb_build_object('correct',true,'points',s.points,'alreadyScored',true); end if;
 if a='hint' then
  if (select count(*) from boo_private.photos where mode='children' and state='active')<10 then raise exception 'A little help unlocks after 10 distinct children join.'; end if;
  if (select count(*) from boo_private.photos where mode=f.mode and state='active')<4 then raise exception 'This mode needs four submitted people for a fair hint.'; end if;
  if s.choices is null then
   -- Choose three random submitted decoys; choices remain fixed for this player/photo.
   select jsonb_agg(name order by random()) into v_choices from (select p.name union all select name from (select q.name from boo_private.people q join boo_private.photos x on x.person=q.id where q.id<>p.id and x.mode=f.mode and x.state='active' order by random() limit 3)d)c;
   update boo_private.plays set hinted=true,choices=v_choices where user_id=u and photo=f.id;
  else v_choices:=s.choices; end if;
  return jsonb_build_object('choices',v_choices,'hinted',true);
 end if;
 if a='guess' then
 insert into boo_private.limits(user_id,bucket,used) values(u,date_trunc('minute',now()),1) on conflict(user_id,bucket) do update set used=boo_private.limits.used+1 returning used into used_count;
 if used_count>12 or (select coalesce(sum(used),0) from boo_private.limits where user_id=u and bucket>now()-interval '1 hour')>120 then return jsonb_build_object('rateLimited',true,'message','Take a little breather. Try again in a minute.'); end if;
 end if;
 if a='guess' then
  n:=boo_private.normalize(left(b->>'guess',100));
  if length(n)<2 or length(b->>'guess')>100 then raise exception 'Enter a name before committing your guess.'; end if;
  if exists(select 1 from boo_private.people other join boo_private.photos otherphoto on otherphoto.person=other.id where other.id<>p.id and other.mode=f.mode and otherphoto.state='active' and (other.normalized=n or n=any(other.aliases))) then
   update boo_private.plays set submitted=true where user_id=u and photo=f.id;return jsonb_build_object('correct',false);
  end if;
  if n<>p.normalized and not n=any(p.aliases) then
   update boo_private.plays set pending=gen_random_uuid(),pending_at=clock_timestamp(),guess=left(b->>'guess',100) where user_id=u and photo=f.id returning * into s;
   return jsonb_build_object('pending',s.pending,'capsule',f.capsule,'guess',s.guess);
  end if;
 end if;
 if n<>p.normalized and not n=any(p.aliases) then update boo_private.plays set submitted=true,pending=null where user_id=u and photo=f.id;return jsonb_build_object('correct',false); end if;
 pts:=case when s.hinted then 1 when f.first_correct is null then 5 else 3 end;
 update boo_private.plays set points=pts,correct_at=now(),submitted=true,pending=null where user_id=u and photo=f.id;
 if not s.hinted and f.first_correct is null then update boo_private.photos set first_correct=u where id=f.id; end if;
 insert into boo_private.notifications(user_id,message) values(u,'You identified a little boo! +'||pts||' points.');
 return jsonb_build_object('correct',true,'points',pts);
end $$;
create function public.boo_game(p_action text,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select boo_private.game(p_action,p_payload) $$;
revoke all on all tables in schema boo_private from public,anon,authenticated;
revoke all on all functions in schema boo_private from public,anon,authenticated;
grant usage on schema boo_private to authenticated;
grant execute on function boo_private.game(text,jsonb) to authenticated;
revoke all on function public.boo_game(text,jsonb) from public,anon;
grant execute on function public.boo_game(text,jsonb) to authenticated;
alter table boo_private.players enable row level security;
alter table boo_private.settings enable row level security;
alter table boo_private.people enable row level security;
alter table boo_private.photos enable row level security;
alter table boo_private.plays enable row level security;
alter table boo_private.limits enable row level security;
alter table boo_private.reports enable row level security;
alter table boo_private.notifications enable row level security;
alter table boo_private.audit enable row level security;
commit;
