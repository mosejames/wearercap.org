-- Keep the first house for existing wall colours and older clients.
-- Private RSVP and admin reads return the complete selection.
alter table public.event_rsvps add column houses text[] not null default '{}';
update public.event_rsvps set houses = array[house] where house is not null;
alter table public.event_rsvps add constraint event_rsvps_houses_valid check (
  houses <@ array['amistad','isibindi','reveur','altruismo']::text[]
  and array_position(houses, null) is null
);

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
  v_houses text[];
  v_existing public.event_rsvps;
  v_token uuid;
begin
  select * into ev from public.events where slug = p_slug;
  if not found then raise exception 'event_not_found'; end if;
  if ev.status <> 'open' then raise exception 'event_closed'; end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then raise exception 'invalid_name'; end if;
  if v_phone is null then raise exception 'invalid_phone'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 160 then raise exception 'invalid_email'; end if;
  if p_payload ? 'houses' then
    if jsonb_typeof(p_payload->'houses') is distinct from 'array' then raise exception 'invalid_house'; end if;
    select coalesce(array_agg(h order by first_seen), '{}') into v_houses
    from (select h, min(ord) first_seen
      from jsonb_array_elements_text(p_payload->'houses') with ordinality as x(h, ord)
      group by h) dedup;
  else
    v_houses := case when v_house is null then '{}'::text[] else array[v_house] end;
  end if;
  if cardinality(v_houses) = 0 or exists (
    select 1 from unnest(v_houses) h where h is null or h not in ('amistad','isibindi','reveur','altruismo')
  ) then raise exception 'invalid_house'; end if;
  v_house := v_houses[1];
  if v_plus is not null and (not ev.allow_plus_one or char_length(v_plus) > 80) then raise exception 'invalid_plus_one'; end if;

  begin
    select coalesce(array_agg(distinct g::int order by g::int), '{}')
      into v_grades
      from jsonb_array_elements_text(coalesce(p_payload->'grades', '[]'::jsonb)) g;
  exception when others then raise exception 'invalid_grades';
  end;
  if exists (select 1 from unnest(v_grades) g where g < 4 or g > 8) then raise exception 'invalid_grades'; end if;

  if p_token is not null then
    select * into v_existing from public.event_rsvps where token = p_token and event_id = ev.id;
  end if;

  -- Older open tabs must not discard additional houses on unrelated edits.
  if not (p_payload ? 'houses') and v_existing.house = v_house and cardinality(v_existing.houses) > 0 then
    v_houses := v_existing.houses;
  end if;

  if v_existing.id is null then
    if exists (select 1 from public.event_rsvps where event_id = ev.id and phone = v_phone) then
      raise exception 'duplicate_phone';
    end if;
    if ev.capacity is not null and public.event_going_count(ev.id) + 1 + (case when v_plus is null then 0 else 1 end) > ev.capacity then
      raise exception 'event_full';
    end if;
    insert into public.event_rsvps (event_id, full_name, wall_name, phone, email, house, houses, grades, plus_one_name)
    values (ev.id, v_name, public.event_wall_name(v_name), v_phone, v_email, v_house, v_houses, v_grades, v_plus)
    returning token into v_token;
    return v_token;
  end if;

  if exists (select 1 from public.event_rsvps where event_id = ev.id and phone = v_phone and id <> v_existing.id) then
    raise exception 'duplicate_phone';
  end if;
  update public.event_rsvps set
    full_name = v_name, wall_name = public.event_wall_name(v_name), phone = v_phone,
    email = v_email, house = v_house, houses = v_houses, grades = v_grades, plus_one_name = v_plus,
    status = 'going', updated_at = now()
  where id = v_existing.id;
  return v_existing.token;
exception when unique_violation then
  raise exception 'duplicate_phone';
end;
$$;

create or replace function public.event_rsvp_mine(p_slug text, p_token uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id, 'full_name', r.full_name, 'wall_name', r.wall_name,
    'phone', r.phone, 'email', r.email, 'house', r.house, 'houses', r.houses, 'grades', r.grades,
    'plus_one_name', r.plus_one_name, 'status', r.status,
    'photo_url', public.event_photo_url(r.photo_path, r.updated_at))
  from public.event_rsvps r join public.events e on e.id = r.event_id
  where e.slug = p_slug and r.token = p_token;
$$;

create or replace function public.event_admin_list(p_pass text, p_slug text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare ev public.events;
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;
  select * into ev from public.events where slug = p_slug;
  if not found then raise exception 'event_not_found'; end if;
  return jsonb_build_object(
    'event', public.event_get(p_slug),
    'rsvps', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'full_name', r.full_name, 'phone', r.phone, 'email', r.email,
        'house', r.house, 'houses', r.houses, 'grades', r.grades, 'plus_one_name', r.plus_one_name,
        'status', r.status, 'photo_url', public.event_photo_url(r.photo_path, r.updated_at),
        'confirm_sent_at', r.confirm_sent_at, 'confirm_error', r.confirm_error,
        'created_at', r.created_at) order by r.created_at desc)
      from public.event_rsvps r where r.event_id = ev.id), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'body', c.body, 'prompt', c.prompt, 'hidden', c.hidden, 'created_at', c.created_at,
        'full_name', r.full_name, 'wall_name', r.wall_name) order by c.created_at desc)
      from public.event_comments c join public.event_rsvps r on r.id = c.rsvp_id
      where c.event_id = ev.id), '[]'::jsonb));
end;
$$;

