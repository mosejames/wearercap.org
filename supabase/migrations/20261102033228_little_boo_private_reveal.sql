begin;
select pg_advisory_xact_lock(291029);
create table boo_private.reveal_control(id boolean primary key default true check(id),published_at timestamptz,portraits_cleared boolean not null default false,publication_approved boolean not null default false,check(published_at is null or (portraits_cleared and publication_approved)));
insert into boo_private.reveal_control(id) values(true);
create table boo_private.reveal_assets(id uuid primary key,object_key text not null unique,content_hash text not null check(content_hash~'^[0-9a-f]{64}$'),width integer not null check(width between 1 and 1000),height integer not null check(height between 1 and 2000),ready boolean not null default false,check(object_key='little-boo/reveal/v1/'||id::text||'.bin'));
create table boo_private.reveal_entries(photo uuid primary key references boo_private.photos(id),display_names text[] not null check(cardinality(display_names) between 1 and 2 and array_position(display_names,null) is null),confirmed boolean not null default false);
create table boo_private.reveal_portrait_links(photo uuid references boo_private.reveal_entries(photo),portrait uuid references boo_private.reveal_assets(id),position integer not null check(position between 1 and 2),primary key(photo,position),unique(photo,portrait));
alter table boo_private.reveal_control enable row level security;
alter table boo_private.reveal_assets enable row level security;
alter table boo_private.reveal_entries enable row level security;
alter table boo_private.reveal_portrait_links enable row level security;
revoke all on boo_private.reveal_control,boo_private.reveal_assets,boo_private.reveal_entries,boo_private.reveal_portrait_links from public,anon,authenticated;

-- Rank actual student-game participants, including upload-only contributors and
-- zero-point committed guessers. Never return another player's name or identity.
create function boo_private.reveal_self(u uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 with eligible as(
 select p.user_id from boo_private.players p where exists(select 1 from auth.users a where a.id=p.user_id and a.phone_confirmed_at is not null and not coalesce(a.is_anonymous,false) and a.deleted_at is null and (a.banned_until is null or a.banned_until<=statement_timestamp())) and (exists(
  select 1 from boo_private.plays s join boo_private.photos f on f.id=s.photo where s.user_id=p.user_id and s.submitted and f.mode='children' and f.state='active')
 or exists(select 1 from boo_private.contributions c where c.user_id=p.user_id and c.voided_at is null))),
 totals as(select e.user_id,coalesce(sum(v.points),0)::int points,coalesce(sum(v.guess_points),0)::int guess_points,coalesce(sum(v.upload_points),0)::int upload_points from eligible e left join boo_private.score_events('children')v on v.user_id=e.user_id group by e.user_id),
 ranked as(select *,rank() over(order by points desc)::int placement,count(*) over()::int total_players,count(*) over(partition by points)::int tied_players from totals where not exists(select 1 from vault_private.staff staff where staff.user_id=totals.user_id))
 select jsonb_build_object('display',coalesce((select display from boo_private.players where user_id=u),'Player'),'totalPoints',coalesce((select points from totals where user_id=u),0),'guessPoints',coalesce((select guess_points from totals where user_id=u),0),'uploadPoints',coalesce((select upload_points from totals where user_id=u),0),'placement',r.placement,'totalPlayers',(select count(*) from ranked),'tiedPlayers',coalesce(r.tied_players,0),'eligible',exists(select 1 from eligible where user_id=u))
 from (select u id)anchor left join ranked r on r.user_id=anchor.id
$$;
revoke all on function boo_private.reveal_self(uuid) from public,anon,authenticated;

create function boo_private.reveal_dispatch(a text,b jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); admin boolean; preview boolean:=a in('reveal-preview','reveal-preview-media'); cfg boo_private.settings; ctl boo_private.reveal_control; me boo_private.players; photo_id uuid; portrait_id uuid; object_key text; result jsonb;
begin
 if u is null or not exists(select 1 from auth.users where id=u and phone_confirmed_at is not null and not coalesce(is_anonymous,false) and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp())) then raise exception 'Please sign in with your phone.' using errcode='42501';end if;
 if jsonb_typeof(b) is distinct from 'object' or octet_length(b::text)>100000 then raise exception 'Invalid reveal request.';end if;
 select exists(select 1 from vault_private.staff where user_id=u and role='owner') into admin;
 if preview and not admin then raise exception 'Owner access required for private reveal preview.' using errcode='42501';end if;
 if a in('reveal-publish','reveal-hide','reveal-register-asset','reveal-register-entries') then
  if not admin then raise exception 'Owner access required.' using errcode='42501';end if;
  perform pg_advisory_xact_lock(291029);
 else perform pg_advisory_xact_lock_shared(291029);end if;
 select * into cfg from boo_private.settings where id=true;
 select * into ctl from boo_private.reveal_control where id=true;
 select * into me from boo_private.players where user_id=u;
 if a='reveal-hide' then
  update boo_private.reveal_control set published_at=null,publication_approved=false,portraits_cleared=false where id=true;
  insert into boo_private.audit(actor,action,payload) values(u,'reveal_hide','{}');return jsonb_build_object('published',false);
 end if;
 if a='reveal-register-asset' then
  if ctl.published_at is not null then raise exception 'Hide the reveal before changing private assets.';end if;
  if b->>'objectKey'<>'little-boo/reveal/v1/'||(b->>'id')||'.bin' then raise exception 'Invalid private portrait key.';end if;
  if exists(select 1 from boo_private.reveal_assets where id=(b->>'id')::uuid and content_hash<>b->>'hash') then raise exception 'Portrait identity already has different content.';end if;
  insert into boo_private.reveal_assets(id,object_key,content_hash,width,height,ready) values((b->>'id')::uuid,b->>'objectKey',b->>'hash',(b->>'width')::int,(b->>'height')::int,true)
   on conflict(id) do update set ready=true;
  return jsonb_build_object('id',b->>'id','ready',true);
 end if;
 if a='reveal-register-entries' then
  if ctl.published_at is not null then raise exception 'Hide the reveal before changing private mappings.';end if;
  if jsonb_typeof(b->'entries') is distinct from 'array' or jsonb_array_length(b->'entries')<>(select count(*) from boo_private.photos where mode='children' and state='active') or (select count(distinct x->>'game_photo_id') from jsonb_array_elements(b->'entries')x)<>jsonb_array_length(b->'entries') then raise exception 'Provide each active game photo exactly once.';end if;
  if exists(select 1 from jsonb_array_elements(b->'entries')x where x->>'confirmed' is distinct from 'true' or not exists(select 1 from boo_private.photos f where f.id=(x->>'game_photo_id')::uuid and f.state='active' and f.mode='children') or jsonb_typeof(x->'display_names') is distinct from 'array' or jsonb_typeof(x->'portrait_ids') is distinct from 'array') then raise exception 'Explicit confirmed mappings are required.';end if;
  if exists(select 1 from jsonb_array_elements(b->'entries')x where jsonb_array_length(x->'display_names') not between 1 and 2 or jsonb_array_length(x->'portrait_ids')<>jsonb_array_length(x->'display_names') or exists(select 1 from jsonb_array_elements_text(x->'display_names')n where length(trim(n)) not between 2 and 100) or exists(select 1 from jsonb_array_elements_text(x->'portrait_ids')pid where not exists(select 1 from boo_private.reveal_assets asset where asset.id=pid::uuid and asset.ready))) then raise exception 'Names and ready portrait assets must correspond.';end if;
  insert into boo_private.reveal_entries(photo,display_names,confirmed) select (x->>'game_photo_id')::uuid,array(select jsonb_array_elements_text(x->'display_names')),true from jsonb_array_elements(b->'entries')x on conflict(photo) do update set display_names=excluded.display_names,confirmed=true;
  delete from boo_private.reveal_portrait_links where photo in(select (x->>'game_photo_id')::uuid from jsonb_array_elements(b->'entries')x);
  insert into boo_private.reveal_portrait_links(photo,portrait,position) select (x->>'game_photo_id')::uuid,pid::uuid,ord::int from jsonb_array_elements(b->'entries')x cross join lateral jsonb_array_elements_text(x->'portrait_ids') with ordinality v(pid,ord);
  return jsonb_build_object('mappedEntries',jsonb_array_length(b->'entries'));
 end if;
 if a='reveal-admin' then
  if not admin then raise exception 'Owner access required.' using errcode='42501';end if;
  return jsonb_build_object('publishedAt',ctl.published_at,'activeEntries',(select count(*) from boo_private.photos where mode='children' and state='active'),'mappedEntries',(select count(*) from boo_private.reveal_entries e join boo_private.photos f on f.id=e.photo where e.confirmed and f.state='active' and f.mode='children' and (select count(*) from boo_private.reveal_portrait_links l join boo_private.reveal_assets asset on asset.id=l.portrait where l.photo=e.photo and asset.ready)=cardinality(e.display_names)),'readyPortraits',(select count(*) from boo_private.reveal_assets where ready),'guessingClosed',clock_timestamp()>=cfg.closes_at,'resultsReviewed',coalesce((boo_private.phase_at(clock_timestamp())->>'resultsPublished')::boolean,false));
 end if;
 if a='reveal-publish' then
  if b->>'confirm'<>'true' or b->>'portraitUseApproved'<>'true' or not(b ? 'confirm') or not(b ? 'portraitUseApproved') then raise exception 'Confirm publication and actual school-portrait reuse clearance.';end if;
  if clock_timestamp()<cfg.closes_at or not coalesce((boo_private.phase_at(clock_timestamp())->>'resultsPublished')::boolean,false) then raise exception 'Close guessing and complete organizer results review and tie handling before publishing the reveal.';end if;
  if not exists(select 1 from boo_private.photos where mode='children' and state='active') then raise exception 'No active student photos to reveal.';end if;
  if exists(select 1 from boo_private.photos f left join boo_private.reveal_entries e on e.photo=f.id where f.mode='children' and f.state='active' and (
   e.photo is null or not e.confirmed or exists(select 1 from unnest(e.display_names)n where length(trim(n)) not between 2 and 100)
   or (select count(*) from boo_private.reveal_portrait_links l where l.photo=f.id)<>cardinality(e.display_names)
   or exists(select 1 from boo_private.reveal_portrait_links l join boo_private.reveal_assets asset on asset.id=l.portrait where l.photo=f.id and not asset.ready))) then raise exception 'Every active game entry needs confirmed names and verified private portraits before publication.';end if;
  update boo_private.reveal_control set portraits_cleared=true,publication_approved=true,published_at=coalesce(published_at,clock_timestamp()) where id=true;
  insert into boo_private.audit(actor,action,payload) values(u,'reveal_publish',jsonb_build_object('schoolPortraitReuseConfirmed',true));
  return jsonb_build_object('published',true);
 end if;
 if a not in('reveal','reveal-preview','reveal-media','reveal-preview-media') then raise exception 'Unsupported reveal request.';end if;
 if not preview then
  if clock_timestamp()<cfg.closes_at or ctl.published_at is null or not ctl.portraits_cleared or not ctl.publication_approved or not coalesce((boo_private.phase_at(clock_timestamp())->>'resultsPublished')::boolean,false) then raise exception 'The organizer has not published the reveal yet.' using errcode='42501';end if;
  if not admin and not coalesce((boo_private.reveal_self(u)->>'eligible')::boolean,false) then raise exception 'This reveal is available to game participants.' using errcode='42501';end if;
 end if;
 if a in('reveal-media','reveal-preview-media') then
  photo_id:=(b->>'photoId')::uuid;
  if not exists(select 1 from boo_private.photos f where f.id=photo_id and f.mode='children' and f.state='active') then raise exception 'Reveal photo unavailable.' using errcode='P0002';end if;
  if b->>'kind'='then' then select f.object_key into object_key from boo_private.photos f where f.id=photo_id;
  elsif b->>'kind'='now' then
   portrait_id:=(b->>'portraitId')::uuid;
   select asset.object_key into object_key from boo_private.reveal_portrait_links l join boo_private.reveal_assets asset on asset.id=l.portrait join boo_private.reveal_entries e on e.photo=l.photo where l.photo=photo_id and asset.id=portrait_id and asset.ready and e.confirmed;
  else raise exception 'Invalid reveal image kind.';end if;
  if object_key is null then raise exception 'Reveal photo unavailable.' using errcode='P0002';end if;
  return jsonb_build_object('key',object_key);
 end if;
 select jsonb_build_object('preview',preview,'publishedAt',ctl.published_at,'me',boo_private.reveal_self(u),'entries',coalesce(jsonb_agg(jsonb_build_object(
  'id',f.id,'displayNames',coalesce(e.display_names,array[p.name]),'grade',p.grade,'status',case
   when f.owner=u or p.normalized=any(coalesce(me.own_names,'{}')) or exists(select 1 from unnest(coalesce(e.display_names,'{}'))n where boo_private.normalize(n)=any(coalesce(me.own_names,'{}'))) then 'own_child'
   when s.pending is not null and not s.submitted then 'unavailable'
   when s.submitted and s.points>0 then 'correct' when s.submitted then 'incorrect' else 'not_guessed' end,
  'points',coalesce(s.points,0),'portraits',coalesce((select jsonb_agg(jsonb_build_object('id',asset.id) order by l.position) from boo_private.reveal_portrait_links l join boo_private.reveal_assets asset on asset.id=l.portrait where l.photo=f.id and asset.ready),'[]')) order by f.created_at desc,f.id),'[]')) into result
 from boo_private.photos f join boo_private.people p on p.id=f.person left join boo_private.reveal_entries e on e.photo=f.id left join boo_private.plays s on s.photo=f.id and s.user_id=u where f.mode='children' and f.state='active';
 return result;
end $$;
revoke all on function boo_private.reveal_dispatch(text,jsonb) from public,anon,authenticated;
-- Delegate only the new explicit actions; retain every existing installed guard.
do $patch$ declare definition text; anchor text:=$anchor$ if m not in ('children','adults') or length(b::text)>18000 then raise exception 'Invalid game request.'; end if;$anchor$;begin
 definition:=pg_get_functiondef('boo_private.game(text,jsonb)'::regprocedure);
 if length(definition)-length(replace(definition,anchor,''))<>length(anchor) or strpos(definition,'boo_private.reveal_dispatch')>0 then raise exception 'Game dispatch changed; review before installing reveal.';end if;
 execute replace(definition,anchor,$dispatch$ if a in ('reveal','reveal-preview','reveal-media','reveal-preview-media','reveal-publish','reveal-hide','reveal-admin','reveal-register-asset','reveal-register-entries') then return boo_private.reveal_dispatch(a,b); end if;
$dispatch$||anchor);
end $patch$;
-- Public availability flag only; no names, pictures, rankings or identities.
create or replace function boo_private.public_phase() returns jsonb language sql volatile security definer set search_path='' as $$
 select boo_private.phase_at(clock_timestamp())||jsonb_build_object('revealPublished',coalesce((select published_at is not null and portraits_cleared and publication_approved from boo_private.reveal_control where id=true),false) and clock_timestamp()>=(select closes_at from boo_private.settings where id=true) and coalesce((boo_private.phase_at(clock_timestamp())->>'resultsPublished')::boolean,false))
$$;
revoke all on function boo_private.public_phase() from public;
grant execute on function boo_private.public_phase() to anon,authenticated;
commit;
