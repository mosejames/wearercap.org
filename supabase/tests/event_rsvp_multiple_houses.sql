-- Run after the multiple-houses migration. All fixture writes roll back.
begin;
do $$
declare
  slug text := 'test-houses-' || gen_random_uuid();
  token uuid;
  payload jsonb := '{"full_name":"Test Parent","phone":"4045550199","email":"test@example.com","houses":["amistad","reveur","amistad"],"grades":[4,8]}';
  mine jsonb;
  bad jsonb;
begin
  insert into public.events(slug,title,starts_at,ends_at,venue_name)
  values (slug,'House regression test',now(),now() + interval '2 hours','Test');
  token := public.event_rsvp_upsert(slug,null,payload);
  mine := public.event_rsvp_mine(slug,token);
  assert mine->'houses' = '["amistad","reveur"]'::jsonb, 'Every unique house must be saved';
  assert mine->>'house' = 'amistad', 'Keep the first house for legacy displays';
  assert public.event_rsvp_mine(slug,gen_random_uuid()) is null, 'Wrong token must not expose an RSVP';

  perform public.event_rsvp_upsert(slug,token,(payload - 'houses') || '{"house":"amistad"}'::jsonb);
  assert public.event_rsvp_mine(slug,token)->'houses' = mine->'houses', 'Legacy client must preserve additional houses';

  perform public.event_rsvp_upsert(slug,token,payload || '{"houses":["isibindi","altruismo"]}'::jsonb);
  assert public.event_rsvp_mine(slug,token)->'houses' = '["isibindi","altruismo"]'::jsonb, 'Editing must replace the full selection';
  assert public.event_admin_list('rcap2026',slug)->'rsvps'->0->'houses' = '["isibindi","altruismo"]'::jsonb, 'Admin reads must include every house';

  for bad in select value from jsonb_array_elements('[[],["invalid"],["amistad",null],null,"amistad"]'::jsonb) loop
    begin
      perform public.event_rsvp_upsert(slug,token,payload || jsonb_build_object('houses',bad));
      raise exception 'Accepted invalid houses: %',bad;
    exception when raise_exception then
      if sqlerrm <> 'invalid_house' then raise; end if;
    end;
  end loop;
end;
$$;
rollback;
