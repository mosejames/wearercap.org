create table trip_engine_private.hero_generation_leases (
 user_id uuid primary key references auth.users(id) on delete cascade,
 usage_day date not null,
 attempts integer not null check(attempts between 0 and 10),
 job_id uuid not null,
 active_until timestamptz not null
);
alter table trip_engine_private.hero_generation_leases enable row level security;
revoke all on trip_engine_private.hero_generation_leases from public,anon,authenticated;
create function trip_engine_private.hero_generation_lease(p_action text,p_job uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_day date:=(now() at time zone 'UTC')::date;v_row trip_engine_private.hero_generation_leases;v_count integer;
begin
 if v_user is null or not trip_engine_private.is_admin() then raise exception 'Trip Studio administrator access required' using errcode='42501';end if;
 if p_job is null or p_action not in ('claim','release') or p_action is null then raise exception 'Invalid generation request';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('trip-studio-hero:'||v_user::text,0));
 select * into v_row from trip_engine_private.hero_generation_leases where user_id=v_user for update;
 if p_action='release' then
  update trip_engine_private.hero_generation_leases set active_until=now() where user_id=v_user and job_id=p_job;
  return jsonb_build_object('released',found);
 end if;
 if v_row.active_until>now() then
  if v_row.job_id=p_job then return jsonb_build_object('claimed',true);end if;
  return jsonb_build_object('busy',true);
 end if;
 v_count:=case when v_row.usage_day=v_day then v_row.attempts else 0 end;
 if v_count>=10 then return jsonb_build_object('limitReached',true);end if;
 insert into trip_engine_private.hero_generation_leases(user_id,usage_day,attempts,job_id,active_until)
 values(v_user,v_day,v_count+1,p_job,now()+interval '5 minutes')
 on conflict(user_id) do update set usage_day=excluded.usage_day,attempts=excluded.attempts,job_id=excluded.job_id,active_until=excluded.active_until;
 return jsonb_build_object('claimed',true);
end;
$$;
revoke all on function trip_engine_private.hero_generation_lease(text,uuid) from public,anon,authenticated;
grant usage on schema trip_engine_private to authenticated;
grant execute on function trip_engine_private.hero_generation_lease(text,uuid) to authenticated;
create function public.trip_studio_hero_lease(p_action text,p_job uuid) returns jsonb
language sql security invoker set search_path='' as $$ select trip_engine_private.hero_generation_lease(p_action,p_job); $$;
revoke all on function public.trip_studio_hero_lease(text,uuid) from public,anon,authenticated;
grant execute on function public.trip_studio_hero_lease(text,uuid) to authenticated;
