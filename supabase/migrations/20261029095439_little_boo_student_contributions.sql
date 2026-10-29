begin;
-- Only this game's private reward ledger is added. Existing photos/players stay intact.
select pg_advisory_xact_lock(291029);
do $$ begin
 if exists(select 1 from boo_private.settings where finalized_at is not null) then
  raise exception 'Do not change contribution scoring after final standings are frozen.';
 end if;
end $$;

alter table boo_private.settings add column submissions_open_at timestamptz not null default '2026-10-29T00:00:00-04:00';
alter table boo_private.settings add column submissions_close_at timestamptz not null default '2026-10-30T11:59:00-04:00';
alter table boo_private.settings add column guesses_open_at timestamptz not null default '2026-10-30T12:00:00-04:00';
alter table boo_private.settings add column results_on date not null default '2026-11-01';
alter table boo_private.settings drop constraint if exists settings_tie_rule_check;
alter table boo_private.settings add constraint boo_tie_rule_check check(tie_rule in ('unsettled','shared-rank','earliest-score','drawing'));
update boo_private.settings set closes_at='2026-10-31T23:59:00-04:00',timezone='America/New_York',tie_rule='drawing';
create table boo_private.opening_notice_consents (
 user_id uuid primary key references auth.users(id),
 campaign text not null default 'little-boo-2026-opening' check(campaign='little-boo-2026-opening'),
 opted_in boolean not null,
 consented_at timestamptz,
 withdrawn_at timestamptz,
 consent_version text not null default 'one-opening-text-v1',
 delivery_state text not null default 'not_scheduled' check(delivery_state='not_scheduled')
);
alter table boo_private.opening_notice_consents enable row level security;
revoke all on boo_private.opening_notice_consents from public,anon,authenticated;

create table boo_private.contributions (
 student_key text primary key,
 person uuid references boo_private.people(id) on delete set null,
 photo uuid unique references boo_private.photos(id) on delete set null,
 content_hash text unique not null,
 user_id uuid not null references auth.users(id),
 house text not null check(house in ('Amistad','Altruismo','Isibindi','Reveur')),
 grade text not null,
 points integer not null default 3 check(points=3),
 awarded_at timestamptz not null,
 voided_at timestamptz,
 source text not null check(source in ('submission','backfill'))
);
alter table boo_private.contributions enable row level security;
revoke all on boo_private.contributions from public,anon,authenticated;
create index boo_contributions_user_active on boo_private.contributions(user_id) where voided_at is null;

-- Receipts survive soft removal and actual photo/person deletion. Neither a new
-- photo ID nor retrying an insert can issue another bonus for the same student.
create function boo_private.photo_contribution() returns trigger language plpgsql security invoker set search_path='' as $$
declare student text; team boo_private.players; credited integer;
begin
 if TG_OP='INSERT' then
  if not exists(select 1 from boo_private.settings where clock_timestamp()>=submissions_open_at and clock_timestamp()<submissions_close_at and finalized_at is null) then raise exception 'Photo submissions have closed.'; end if;
  if NEW.mode='children' and NEW.state='active' then
   select normalized into student from boo_private.people where id=NEW.person and mode='children';
   select * into team from boo_private.players where user_id=NEW.owner;
   if student is null or team.user_id is null then raise exception 'Set up scoring before adding a student photo.'; end if;
   insert into boo_private.contributions(student_key,person,photo,content_hash,user_id,house,grade,awarded_at,source)
    values(student,NEW.person,NEW.id,NEW.content_hash,NEW.owner,team.house,team.grade,NEW.created_at,'submission')
    on conflict do nothing returning points into credited;
   if credited=3 then insert into boo_private.notifications(user_id,message) values(NEW.owner,'Your accepted student photo earned 3 contribution points. One bonus per student.'); end if;
  end if;
 elsif TG_OP='DELETE' then
  update boo_private.contributions set voided_at=coalesce(voided_at,clock_timestamp()) where photo=OLD.id;
  return OLD;
 elsif NEW.state<>'active' or NEW.mode<>'children' then
  update boo_private.contributions set voided_at=coalesce(voided_at,clock_timestamp()) where photo=NEW.id;
 end if;
 return NEW;
end $$;
revoke all on function boo_private.photo_contribution() from public,anon,authenticated;
create trigger boo_photo_contribution_after after insert or update of state,mode on boo_private.photos for each row execute function boo_private.photo_contribution();
create trigger boo_photo_contribution_delete before delete on boo_private.photos for each row execute function boo_private.photo_contribution();

-- Backfill only previously accepted student records. The original acceptance
-- time is retained; removed records consume a receipt but add no live points.
with existing as (
 select distinct on (person.normalized) person.normalized,person.id person_id,photo.id photo_id,photo.content_hash,photo.owner,player.house,player.grade,photo.created_at,photo.state
 from boo_private.photos photo join boo_private.people person on person.id=photo.person
 join boo_private.players player on player.user_id=photo.owner
 where photo.mode='children' and person.mode='children'
 order by person.normalized,photo.created_at,photo.id
), credited as (
 insert into boo_private.contributions(student_key,person,photo,content_hash,user_id,house,grade,awarded_at,voided_at,source)
 select normalized,person_id,photo_id,content_hash,owner,house,grade,created_at,case when state='active' then null else clock_timestamp() end,'backfill' from existing
 on conflict do nothing returning user_id,voided_at
)
insert into boo_private.notifications(user_id,message)
 select user_id,'Your earlier accepted student photo now has 3 contribution points. One bonus per student.' from credited where voided_at is null;

create function boo_private.score_events(m text) returns table(user_id uuid,house text,grade text,points integer,guess_points integer,upload_points integer,identified integer,contributed integer,reached timestamptz)
language sql stable security invoker set search_path='' as $$
 select player.user_id,player.house,player.grade,play.points,play.points,0,1,0,play.correct_at
 from boo_private.players player join boo_private.plays play on play.user_id=player.user_id join boo_private.photos photo on photo.id=play.photo
 where photo.mode=m and photo.state='active' and play.points>0
 union all
 select c.user_id,c.house,c.grade,c.points,0,c.points,0,1,c.awarded_at from boo_private.contributions c where m='children' and c.voided_at is null
$$;
revoke all on function boo_private.score_events(text) from public,anon,authenticated;
create or replace function boo_private.board(m text) returns jsonb language sql stable security invoker set search_path='' as $$
 with events as (select * from boo_private.score_events(m))
 select jsonb_build_object(
 'individual',coalesce((select jsonb_agg(to_jsonb(entry)) from (
 select player.user_id id,player.display,player.house,player.grade,sum(e.points)::int points,sum(e.guess_points)::int "guessPoints",sum(e.upload_points)::int "uploadPoints",sum(e.identified)::int identified,sum(e.contributed)::int contributions,max(e.reached) reached
 from boo_private.players player join events e on e.user_id=player.user_id group by player.user_id
 order by sum(e.points) desc,max(e.reached),player.user_id)entry),'[]'::jsonb),
 'house',coalesce((select jsonb_agg(to_jsonb(entry)) from (
 select e.house label,sum(e.points)::int points,sum(e.guess_points)::int "guessPoints",sum(e.upload_points)::int "uploadPoints" from events e group by e.house order by sum(e.points) desc,e.house)entry),'[]'::jsonb),
 'grade',coalesce((select jsonb_agg(to_jsonb(entry)) from (
 select e.grade label,sum(e.points)::int points,sum(e.guess_points)::int "guessPoints",sum(e.upload_points)::int "uploadPoints" from events e group by e.grade order by sum(e.points) desc,e.grade)entry),'[]'::jsonb))
$$;

-- Public schedule only. No submissions, scores, phone numbers or answers.
create function boo_private.phase_at(at_time timestamptz) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('phase',case when at_time<submissions_open_at then 'soon' when at_time<submissions_close_at then 'submissions' when at_time<guesses_open_at then 'waiting' when at_time<closes_at then 'guessing' when at_time<(results_on::timestamp at time zone timezone) then 'closed' else 'results' end,
 'serverNow',at_time,'timezone',timezone,'submissionsOpenAt',submissions_open_at,'submissionsCloseAt',submissions_close_at,'guessesOpenAt',guesses_open_at,'guessesCloseAt',closes_at,'resultsOn',results_on,'resultsAt',(results_on::timestamp at time zone timezone),'tieRule',tie_rule,'resultsPublished',finalized_at is not null and at_time>=(results_on::timestamp at time zone timezone) and not exists(select 1 from jsonb_array_elements(coalesce(awards,'[]'::jsonb))j where coalesce((j->>'drawingRequired')::boolean,false)))
 from boo_private.settings where id=true
$$;
revoke all on function boo_private.phase_at(timestamptz) from public,anon,authenticated;
create function boo_private.public_phase() returns jsonb language sql volatile security definer set search_path='' as $$ select boo_private.phase_at(clock_timestamp()) $$;
revoke all on function boo_private.public_phase() from public;
grant usage on schema boo_private to anon;
grant execute on function boo_private.public_phase() to anon,authenticated;
create function public.boo_phase() returns jsonb language sql volatile security invoker set search_path='' as $$ select boo_private.public_phase() $$;
revoke all on function public.boo_phase() from public;
grant execute on function public.boo_phase() to anon,authenticated;

-- A drawing is a human organizer action. Tied podium places remain unassigned.
create function boo_private.drawing_report() returns jsonb language sql stable security invoker set search_path='' as $$
 with standings as (select (j->>'id')::uuid player_id,j->>'display' display,(j->>'points')::int points,(j->>'guessPoints')::int guess_points,(j->>'uploadPoints')::int upload_points from jsonb_array_elements(boo_private.board('children')->'individual')j),
 ranked as (select *,rank() over(order by points desc)::int place,count(*) over(partition by points)::int tied from standings)
 select coalesce(jsonb_agg(jsonb_build_object('playerId',player_id,'display',display,'points',points,'guessPoints',guess_points,'uploadPoints',upload_points,'rank',place,'drawingRequired',tied>1 and place<=3,
 'eligiblePlacements',case when tied>1 and place<=3 then (select jsonb_agg(jsonb_build_object('place',n,'tickets',case n when 1 then 25 when 2 then 15 when 3 then 10 end)) from generate_series(place,least(place+tied-1,3))n) else '[]'::jsonb end,
 'tickets',case when tied>1 and place<=3 then null when place=1 then 25 when place=2 then 15 when place=3 then 10 else 0 end) order by place,display),'[]'::jsonb) from ranked
$$;
revoke all on function boo_private.drawing_report() from public,anon,authenticated;


-- Enforce phase boundaries at the write as well as the RPC. A request that waits
-- on a lock across a cutoff cannot commit a new guess from a stale function plan.
create function boo_private.guard_play_phase() returns trigger language plpgsql security invoker set search_path='' as $$
declare cfg boo_private.settings; check_time timestamptz:=clock_timestamp(); needs_window boolean; finishing boolean:=false;
begin
 select * into cfg from boo_private.settings where id=true;
 if TG_OP='INSERT' then
  if exists(select 1 from boo_private.plays where user_id=NEW.user_id and photo=NEW.photo) then return NEW; end if;
  needs_window:=true;
 else
  needs_window:=(NEW.submitted and not OLD.submitted) or NEW.points>OLD.points or (NEW.hinted and not OLD.hinted) or (NEW.pending is not null and (OLD.pending is null or NEW.pending_at is distinct from OLD.pending_at or NEW.guess is distinct from OLD.guess));
  finishing:=OLD.pending is not null and NEW.pending is null and OLD.pending_at>=cfg.guesses_open_at and OLD.pending_at<cfg.closes_at and OLD.pending_at>check_time-interval '20 seconds' and NEW.guess is not distinct from OLD.guess;
 end if;
 if needs_window and (cfg.finalized_at is not null or (not finishing and (check_time<cfg.guesses_open_at or check_time>=cfg.closes_at))) then raise exception 'Guessing is only open Friday, October 30 at noon through Saturday, October 31 at 11:59 p.m. Eastern.'; end if;
 return NEW;
end $$;
revoke all on function boo_private.guard_play_phase() from public,anon,authenticated;
create trigger boo_play_phase_guard before insert or update on boo_private.plays for each row execute function boo_private.guard_play_phase();

create or replace function boo_private.game(a text,b jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); admin bool; f boo_private.photos; p boo_private.people; me boo_private.players; s boo_private.plays; cfg boo_private.settings; m text:=coalesce(b->>'mode','children'); n text; vals text[]; pid uuid; pts int; used_count int; v_choices jsonb; result jsonb; cutoff timestamptz; v_awards jsonb;
begin
 if u is null or not exists(select 1 from auth.users where id=u and phone_confirmed_at is not null and coalesce(is_anonymous,false)=false) then raise exception 'Please sign in with your phone.' using errcode='42501'; end if;
 select exists(select 1 from vault_private.staff where user_id=u and role='owner') into admin;
 if m not in ('children','adults') or length(b::text)>18000 then raise exception 'Invalid game request.'; end if;
 if a in ('settings','finalize','drawing-results') then perform pg_advisory_xact_lock(291029); else perform pg_advisory_xact_lock_shared(291029); end if;
 select * into cfg from boo_private.settings where id=true;
 select * into me from boo_private.players where user_id=u;
 if a='profile' then
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  n:=trim(b->>'display');
  if length(n) not between 2 and 40 or b->>'house' not in ('Amistad','Altruismo','Isibindi','Reveur') or length(trim(b->>'grade')) not between 1 and 24 then raise exception 'Add a display name, house and grade.'; end if;
  if (exists(select 1 from boo_private.plays where user_id=u and points>0) or exists(select 1 from boo_private.contributions where user_id=u)) and (me.house<>b->>'house' or me.grade<>b->>'grade') then raise exception 'Your scoring house and grade are locked after your first point.'; end if;
  select coalesce(array_agg(distinct boo_private.normalize(value)) filter(where length(boo_private.normalize(value))>0),'{}') into vals from jsonb_array_elements_text(coalesce(b->'ownNames','[]'));
  -- Own-child declarations can only grow, so editing a profile cannot unlock self-scoring.
  vals:=array(select distinct unnest(vals||coalesce(me.own_names,'{}')));
  insert into boo_private.players(user_id,display,house,grade,own_names) values(u,n,b->>'house',trim(b->>'grade'),vals) on conflict(user_id) do update set display=excluded.display,house=excluded.house,grade=excluded.grade,own_names=excluded.own_names;
  return jsonb_build_object('ok',true);
 end if;
 if a='opening-notice' then
  if not b ? 'optedIn' or jsonb_typeof(b->'optedIn')<>'boolean' then raise exception 'Choose whether to request one opening text.'; end if;
  if (b->>'optedIn')::boolean and clock_timestamp()>=cfg.guesses_open_at then raise exception 'Guessing has already opened; opening-text requests are closed.'; end if;
  insert into boo_private.opening_notice_consents(user_id,opted_in,consented_at,withdrawn_at)
   values(u,(b->>'optedIn')::boolean,case when (b->>'optedIn')::boolean then clock_timestamp() end,case when not (b->>'optedIn')::boolean then clock_timestamp() end)
   on conflict(user_id) do update set opted_in=excluded.opted_in,consented_at=case when excluded.opted_in and not boo_private.opening_notice_consents.opted_in then excluded.consented_at else boo_private.opening_notice_consents.consented_at end,withdrawn_at=case when excluded.opted_in then null else excluded.withdrawn_at end;
  return jsonb_build_object('optedIn',(b->>'optedIn')::boolean,'deliveryState','not_scheduled');
 end if;
 if a='get' then
  return jsonb_build_object('phase',boo_private.phase_at(clock_timestamp()),'openingNotice',jsonb_build_object('optedIn',coalesce((select opted_in from boo_private.opening_notice_consents where user_id=u),false),'deliveryState','not_scheduled'),'userId',u,'me',case when me.user_id is null then null else jsonb_build_object('display',me.display,'house',me.house,'grade',me.grade) end,'isAdmin',admin,'settings',jsonb_build_object('closesAt',cfg.closes_at,'timezone',cfg.timezone,'tieRule',cfg.tie_rule,'finalizedAt',cfg.finalized_at),'photos',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'caption',x.caption,'createdAt',x.created_at,'own',x.owner=u or person.normalized=any(coalesce(me.own_names,'{}')),'canRemove',x.owner=u or admin,'correct',coalesce(t.points,0)>0,'points',coalesce(t.points,0),'hinted',coalesce(t.hinted,false),'submitted',coalesce(t.submitted,false),'pending',t.pending is not null,'pendingGuess',case when t.pending is not null then t.guess else null end,'choices',t.choices) order by x.created_at desc) from boo_private.photos x join boo_private.people person on person.id=x.person left join boo_private.plays t on t.photo=x.id and t.user_id=u where x.mode=m and x.state='active' and (admin or clock_timestamp()>=cfg.guesses_open_at or x.owner=u)),'[]'),'distinctChildren',(select count(*) from boo_private.photos where mode='children' and state='active'),'board',boo_private.board(m),'awards',case when (boo_private.phase_at(clock_timestamp())->>'resultsPublished')::boolean then cfg.awards else null end,'notifications',coalesce((select jsonb_agg(to_jsonb(x)) from (select id,message,created_at from boo_private.notifications where user_id=u order by created_at desc limit 20)x),'[]'));
 end if;
 if a='admin' then
  if not admin then raise exception 'Owner access required.' using errcode='42501'; end if;
  return jsonb_build_object('reports',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'photo',r.photo,'reason',r.reason,'createdAt',r.created_at,'resolved',r.resolved,'state',x.state)) from boo_private.reports r join boo_private.photos x on x.id=r.photo),'[]'),'settings',to_jsonb(cfg),'board',boo_private.board('children'),'awards',cfg.awards,'openingNoticeRequests',(select count(*) from boo_private.opening_notice_consents where opted_in));
 end if;
 if a='drawing-results' then
  if not admin or cfg.finalized_at is null or cfg.tie_rule<>'drawing' then raise exception 'Finalize the organizer report before recording a drawing.' using errcode='42501'; end if;
  if b->>'confirmed' is distinct from 'true' or jsonb_typeof(b->'placements') is distinct from 'array' then raise exception 'Confirm that the organizer drawing was conducted.'; end if;
  if jsonb_array_length(b->'placements')>3 or jsonb_array_length(b->'placements')=0 then raise exception 'Record each affected podium place exactly once.'; end if;
  if exists(select 1 from jsonb_array_elements(b->'placements')x where x->>'place' not in ('1','2','3') or not exists(select 1 from jsonb_array_elements(cfg.awards)j where j->>'playerId'=x->>'playerId' and coalesce((j->>'drawingRequired')::boolean,false) and exists(select 1 from jsonb_array_elements(j->'eligiblePlacements')v where v->>'place'=x->>'place'))) then raise exception 'A selected player is not eligible for that drawn place.'; end if;
  if (select count(distinct x->>'place') from jsonb_array_elements(b->'placements')x)<>jsonb_array_length(b->'placements') or (select count(distinct x->>'playerId') from jsonb_array_elements(b->'placements')x)<>jsonb_array_length(b->'placements') then raise exception 'Use each place and player only once.'; end if;
  if (select count(distinct v->>'place') from jsonb_array_elements(cfg.awards)j cross join lateral jsonb_array_elements(j->'eligiblePlacements')v where coalesce((j->>'drawingRequired')::boolean,false))<>jsonb_array_length(b->'placements') then raise exception 'Complete every affected drawing place.'; end if;
  select jsonb_agg(case when coalesce((j->>'drawingRequired')::boolean,false) then j||jsonb_build_object('drawingRequired',false,'awardedPlace',chosen.place,'tickets',case chosen.place when 1 then 25 when 2 then 15 when 3 then 10 else 0 end,'drawingOutcome',case when chosen.place is null then 'not_selected' else 'selected' end) else j||jsonb_build_object('awardedPlace',case when (j->>'rank')::int<=3 then (j->>'rank')::int end) end order by ord) into v_awards
   from jsonb_array_elements(cfg.awards) with ordinality items(j,ord)
   left join lateral (select (x->>'place')::int place from jsonb_array_elements(b->'placements')x where x->>'playerId'=j->>'playerId')chosen on true;
  update boo_private.settings set awards=v_awards;
  insert into boo_private.audit(actor,action,payload) values(u,a,b);
  return jsonb_build_object('ok',true,'awards',v_awards);
 end if;
 if a in ('settings','finalize') then
  if not admin then raise exception 'Owner access required.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(291029);
  if a='settings' then
   if cfg.finalized_at is not null then raise exception 'Standings have already been finalized.'; end if;
   cutoff:=nullif(b->>'closesAt','')::timestamptz;
   if b->>'tieRule' not in ('unsettled','shared-rank','earliest-score','drawing') then raise exception 'Choose a tie rule.'; end if;
   if not exists(select 1 from pg_timezone_names where name=b->>'timezone') then raise exception 'Choose a valid timezone.'; end if;
   if cutoff is null or cutoff<=cfg.guesses_open_at then raise exception 'Closing must be after guessing opens.'; end if;
   update boo_private.settings set closes_at=cutoff,timezone=b->>'timezone',tie_rule=b->>'tieRule';
  else
   if cfg.closes_at is null or cfg.closes_at>clock_timestamp() or cfg.tie_rule='unsettled' then raise exception 'Set and reach the closing time and settle ties before finalizing.'; end if;
   if cfg.finalized_at is not null then return cfg.awards; end if;
   if exists(select 1 from boo_private.plays where pending is not null and not submitted and pending_at>clock_timestamp()-interval '20 seconds') then raise exception 'A spelling review is finishing. Wait 20 seconds and try again.'; end if;
   if cfg.tie_rule='drawing' then v_awards:=boo_private.drawing_report(); else
   with standings as (select (item->>'id')::uuid user_id,item->>'display' display,(item->>'points')::int points,(item->>'guessPoints')::int guess_points,(item->>'uploadPoints')::int upload_points,(item->>'reached')::timestamptz reached from jsonb_array_elements(boo_private.board('children')->'individual') item), ranks as(select *,case when cfg.tie_rule='earliest-score' then rank() over(order by points desc,reached) else rank() over(order by points desc) end as rank from standings) select coalesce(jsonb_agg(jsonb_build_object('playerId',user_id,'display',display,'points',points,'guessPoints',guess_points,'uploadPoints',upload_points,'rank',rank,'tickets',case rank when 1 then 25 when 2 then 15 when 3 then 10 else 0 end) order by rank,display),'[]') into v_awards from ranks;
   end if;
   update boo_private.settings set finalized_at=now(),awards=v_awards;
  end if;
  insert into boo_private.audit(actor,action,payload) values(u,a,b);
  return jsonb_build_object('ok',true,'awards',v_awards);
 end if;
 if a='upload' then
  if me.user_id is null then raise exception 'Set up your player profile first.'; end if;
  if cfg.finalized_at is not null or clock_timestamp()<cfg.submissions_open_at or clock_timestamp()>=cfg.submissions_close_at then raise exception 'Photo submissions are closed. Guessing opens Friday, October 30 at noon Eastern.'; end if;
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
  if clock_timestamp()<cfg.submissions_open_at or clock_timestamp()>=cfg.submissions_close_at then raise exception 'Photo submissions have closed.'; end if;
  insert into boo_private.people(mode,name,normalized,aliases,house,grade,owner) values(m,trim(b->>'name'),n,vals,b->>'house',b->>'grade',u) returning id into pid;
  insert into boo_private.photos(id,person,owner,mode,object_key,content_hash,caption,capsule,proof_hash) values((b->>'id')::uuid,pid,u,m,b->>'key',b->>'hash',coalesce(b->>'caption',''),b->>'capsule',b->>'proofHash');
  if m='children' then update boo_private.players set own_names=array(select distinct unnest(own_names||array[n])) where user_id=u; end if;
  insert into boo_private.notifications(user_id,message) values(u,'Your photo is in the game. Thank you for sharing a little Halloween magic!');
  return jsonb_build_object('ok',true,'uploadBonus',coalesce((select c.points from boo_private.contributions c where c.photo=(b->>'id')::uuid and c.user_id=u and c.voided_at is null),0));
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
 if a='media' and clock_timestamp()<cfg.guesses_open_at and f.owner<>u and not admin then raise exception 'Other families’ photos open Friday, October 30 at noon Eastern.' using errcode='42501'; end if;
 if a='media' then return jsonb_build_object('key',f.object_key); end if;
 if a='report' then
  insert into boo_private.reports(photo,reporter,reason) values(f.id,u,left(trim(b->>'reason'),300)) on conflict(photo,reporter) do update set reason=excluded.reason,resolved=false;
  return jsonb_build_object('ok',true);
 end if;
 if a not in ('guess','hint','judged','cancel-judge') then raise exception 'Unsupported game request.'; end if;
 if me.user_id is null then raise exception 'Set up your player profile first.'; end if;
 if cfg.finalized_at is not null then raise exception 'This round has closed.'; end if;
 if a in ('guess','hint') and clock_timestamp()<cfg.guesses_open_at then raise exception 'Guessing opens Friday, October 30 at noon Eastern.'; end if;
 if a in ('guess','hint') and clock_timestamp()>=cfg.closes_at then raise exception 'Guessing closed Saturday, October 31 at 11:59 p.m. Eastern. Results are Sunday.'; end if;
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

-- Public RPC grants and all answer visibility remain unchanged.
commit;
