-- A scoped, operator-only cleanup for explicitly disposable verification trips.
create function trip_engine_private.discard_test(p_draft text,p_version integer,p_confirm text,p_apply boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t trip_engine_private.trips; files jsonb;
begin
 if not trip_engine_private.is_admin() then raise exception 'Trip organizer access required' using errcode='42501';end if;
 if p_draft='dc-draft' or p_draft !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'Only disposable verification trips can be removed' using errcode='42501';end if;
 select * into t from trip_engine_private.trips where draft_id=p_draft for update;
 if not found then return jsonb_build_object('tripId',null,'photos','[]'::jsonb);end if;
 if t.published or t.version<>p_version or t.slug<>p_confirm or t.slug not like 'verification-flow-%' or t.config->>'destination' not like 'Temporary verification trip %' then raise exception 'Make this verification trip private and confirm its current link before cleanup' using errcode='42501';end if;
 select coalesce(jsonb_agg(trip_engine_private.photo_json(p)),'[]'::jsonb) into files from trip_engine_private.photos p where p.trip_id=t.id;
 if p_apply then
  delete from trip_engine_private.photos where trip_id=t.id;
  delete from trip_engine_private.trips where id=t.id;
 end if;
 return jsonb_build_object('tripId',t.id,'photos',files);
end;
$$;
revoke all on function trip_engine_private.discard_test(text,integer,text,boolean) from public;
grant execute on function trip_engine_private.discard_test(text,integer,text,boolean) to authenticated;
create function public.trip_engine_discard_test(p_draft text,p_version integer,p_confirm text,p_apply boolean default false) returns jsonb
language sql security invoker set search_path='' as $$ select trip_engine_private.discard_test(p_draft,p_version,p_confirm,p_apply); $$;
revoke all on function public.trip_engine_discard_test(text,integer,text,boolean) from public;
grant execute on function public.trip_engine_discard_test(text,integer,text,boolean) to authenticated;
notify pgrst,'reload schema';
