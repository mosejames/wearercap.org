begin;
select pg_advisory_xact_lock(291029);
-- Public output is a separately approved three-adult snapshot. Never return the
-- private board, auth IDs, phones, child labels, images or individual guesses.
create function boo_private.public_winners() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare cfg boo_private.settings;ctl boo_private.reveal_control;approval jsonb;item jsonb;approved jsonb:='[]';seen int[]:='{}';place int;pts int;person uuid;label text;
begin
 select * into cfg from boo_private.settings where id=true;
 select * into ctl from boo_private.reveal_control where id=true;
 if cfg.finalized_at is null or ctl.published_at is null or not ctl.portraits_cleared or not ctl.publication_approved or not coalesce((boo_private.phase_at(statement_timestamp())->>'resultsPublished')::boolean,false)then return jsonb_build_object('winners','[]'::jsonb);end if;
 select payload into approval from boo_private.audit where action='confirmed_finalists_public_v1'and payload->>'reference'='little-boo-public-winners-2026-11-02-v1'order by id desc limit 1;
 if jsonb_typeof(approval->'winners')is distinct from 'array' or jsonb_array_length(approval->'winners')<>3 then return jsonb_build_object('winners','[]'::jsonb);end if;
 for item in select value from jsonb_array_elements(approval->'winners')loop
  if jsonb_typeof(item->'name')is distinct from 'string' or length(item->>'name')not between 2 and 40 or coalesce(item->>'place','')!~'^[1-3]$'or coalesce(item->>'points','')!~'^[0-9]{1,6}$'or coalesce(item->>'userId','')!~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'then return jsonb_build_object('winners','[]'::jsonb);end if;
  place:=(item->>'place')::int;pts:=(item->>'points')::int;person:=(item->>'userId')::uuid;label:=item->>'name';
  if place=any(seen)or not exists(select 1 from boo_private.reveal_rankings()r where r.user_id=person and r.placement=place and r.points=pts and r.display=label and r.ties=1)or not exists(select 1 from jsonb_array_elements(coalesce(cfg.awards,'[]'))a where a->>'playerId'=person::text and a->>'rank'=place::text and a->>'points'=pts::text and a->>'display'=label and coalesce(a->>'drawingRequired','false')='false')then return jsonb_build_object('winners','[]'::jsonb);end if;
  seen:=array_append(seen,place);approved:=approved||jsonb_build_array(jsonb_build_object('place',place,'name',label,'points',pts));
 end loop;
 return jsonb_build_object('winners',(select jsonb_agg(x order by(x->>'place')::int)from jsonb_array_elements(approved)x));
end $$;
revoke all on function boo_private.public_winners()from public,anon,authenticated;
create function public.boo_winners()returns jsonb language sql stable security definer set search_path='' as $$select boo_private.public_winners()$$;
revoke all on function public.boo_winners()from public;
grant execute on function public.boo_winners()to anon,authenticated;
-- Apply the same closed-round eligibility to legacy game/photo reads, so an
-- unrelated new Auth account cannot bypass the reveal guard through old URLs.
do $legacy$
declare definition text;anchor text:=$anchor$ if m not in ('children','adults') or length(b::text)>18000 then raise exception 'Invalid game request.'; end if;$anchor$;guard text:=$guard$ if a in ('get','media') and not admin and exists(select 1 from boo_private.settings where id=true and clock_timestamp()>=closes_at) and not coalesce((boo_private.reveal_self(u)->>'eligible')::boolean,false) then raise exception 'This closed game is only available to players who guessed before closing.' using errcode='42501';end if;
$guard$;
begin
 definition:=pg_get_functiondef('boo_private.game(text,jsonb)'::regprocedure);
 if position('This closed game is only available to players who guessed before closing.' in definition)=0 then
  if length(definition)-length(replace(definition,anchor,''))<>length(anchor)then raise exception 'Unexpected game dispatch; review closed-round media guard.';end if;
  execute replace(definition,anchor,guard||anchor);
 end if;
end $legacy$;
commit;
