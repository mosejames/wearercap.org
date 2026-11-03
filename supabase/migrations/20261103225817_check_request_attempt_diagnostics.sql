-- Independent client diagnostics, never part of cr_action or notification hooks.
create table cr_private.attempt_events (
 attempt_id uuid not null,
 sequence integer not null check(sequence between 1 and 250),
 correlation_id uuid not null,
 recorded_at timestamptz not null default clock_timestamp(),
 stage text not null check(stage in ('prepare','upload','submit')),
 outcome text not null check(outcome in ('started','succeeded','failed')),
 error_code text check(error_code in ('23505','23503','23514','42501','P0001','57014','40001','40P01','PGRST301','PGRST302','PGRST003','aborted','network_or_client','unknown','http_400','http_401','http_403','http_409','http_413','http_415','http_429','http_500','http_502','http_503','http_504')),
 reference bigint,
 primary key(attempt_id,sequence),
 check((outcome='failed')=(error_code is not null))
);
alter table cr_private.attempt_events enable row level security;
revoke all on cr_private.attempt_events from public,anon,authenticated;
create index cr_attempt_events_time on cr_private.attempt_events(recorded_at);
create index cr_attempt_events_correlation on cr_private.attempt_events(correlation_id);

create function cr_private.log_attempt(p_event jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare ref bigint;
begin
 if auth.uid() is null then raise exception 'Sign in required.' using errcode='42501'; end if;
 -- Reject extra fields, including messages and payloads. The client cannot set time.
 if p_event is null or jsonb_typeof(p_event)<>'object' or
    p_event - array['attempt_id','sequence','correlation_id','stage','outcome','error_code','reference'] <> '{}'::jsonb then
  raise exception 'Invalid diagnostic fields.' using errcode='22023';
 end if;
 ref := (p_event->>'reference')::bigint;
 -- Only attach an actually existing number owned by this submitting account.
 -- Do not return lookup results or associate arbitrary financial records.
 if ref is not null and not exists(select 1 from public.cr_requests where reference=ref and owner_id=auth.uid()) then
  ref := null;
 end if;
 insert into cr_private.attempt_events(attempt_id,sequence,correlation_id,stage,outcome,error_code,reference)
 values((p_event->>'attempt_id')::uuid,(p_event->>'sequence')::integer,(p_event->>'correlation_id')::uuid,
  p_event->>'stage',p_event->>'outcome',p_event->>'error_code',ref)
 on conflict(attempt_id,sequence) do nothing;
end $$;
revoke all on function cr_private.log_attempt(jsonb) from public,anon,authenticated;
grant execute on function cr_private.log_attempt(jsonb) to authenticated;
create function public.cr_log_attempt(p_event jsonb) returns void
language sql security invoker set search_path='' as $$select cr_private.log_attempt(p_event)$$;
revoke all on function public.cr_log_attempt(jsonb) from public,anon,authenticated;
grant execute on function public.cr_log_attempt(jsonb) to authenticated;
