-- House is required on an RSVP. Every parent knows their house by now, and
-- the wall reads better with no navy "no house" chips. Existing rows with no
-- house are left alone; only new writes are held to it.
create or replace function public.event_rsvp_upsert(p_slug text, p_token uuid, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  ev public.events;
  v_name text := btrim(regexp_replace(coalesce(p_payload->>'full_name',''), '\s+', ' ', 'g'));
  v_phone text := public.event_normalize_phone(p_payload->>'phone');
  v_email text := lower(btrim(coalesce(p_payload->>'email','')));
  v_house text := nullif(btrim(coalesce(p_payload->>'house','')), '');
  v_plus text := nullif(btrim(coalesce(p_payload->>'plus_one_name','')), '');
  v_grades int[];
  v_existing public.event_rsvps;
  v_token uuid;
begin
  select * into ev from public.events where slug = p_slug;
  if not found then raise exception 'event_not_found'; end if;
  if ev.status <> 'open' then raise exception 'event_closed'; end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then raise exception 'invalid_name'; end if;
  if v_phone is null then raise exception 'invalid_phone'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 160 then raise exception 'invalid_email'; end if;
  if v_house is null or v_house not in ('amistad','isibindi','reveur','altruismo') then raise exception 'invalid_house'; end if;
  if v_plus is not null and (not ev.allow_plus_one or char_length(v_plus) > 80) then raise exception 'invalid_plus_one'; end if;

  begin
    select coalesce(array_agg(distinct g::int order by g::int), '{}')
      into v_grades
      from jsonb_array_elements_text(coalesce(p_payload->'grades', '[]'::jsonb)) g;
  exception when others then raise exception 'invalid_grades';
  end;
  if exists (select 1 from unnest(v_grades) g where g < 5 or g > 8) then raise exception 'invalid_grades'; end if;

  if p_token is not null then
    select * into v_existing from public.event_rsvps where token = p_token and event_id = ev.id;
  end if;

  if v_existing.id is null then
    if exists (select 1 from public.event_rsvps where event_id = ev.id and phone = v_phone) then
      raise exception 'duplicate_phone';
    end if;
    if ev.capacity is not null and public.event_going_count(ev.id) + 1 + (case when v_plus is null then 0 else 1 end) > ev.capacity then
      raise exception 'event_full';
    end if;
    insert into public.event_rsvps (event_id, full_name, wall_name, phone, email, house, grades, plus_one_name)
    values (ev.id, v_name, public.event_wall_name(v_name), v_phone, v_email, v_house, v_grades, v_plus)
    returning token into v_token;
    return v_token;
  end if;

  if exists (select 1 from public.event_rsvps where event_id = ev.id and phone = v_phone and id <> v_existing.id) then
    raise exception 'duplicate_phone';
  end if;
  update public.event_rsvps set
    full_name = v_name, wall_name = public.event_wall_name(v_name), phone = v_phone,
    email = v_email, house = v_house, grades = v_grades, plus_one_name = v_plus,
    status = 'going', updated_at = now()
  where id = v_existing.id;
  return v_existing.token;
exception when unique_violation then
  raise exception 'duplicate_phone';
end;
$$;
