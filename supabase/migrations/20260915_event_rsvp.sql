-- Parent Social RSVP: events, RSVPs, the thread.
--
-- Tables have RLS on, no policies and no grants. The anon key reads through
-- security-definer functions that return public fields only (wall name, house,
-- photo) and writes through definer RPCs keyed by the RSVP's private token.
-- Deliberately functions, not views: anon-readable definer views are the open
-- advisor issue on vault_people and friends, and this should not add a fourth.
-- Live updates go out as a Realtime broadcast from a trigger carrying the same
-- public fields, so nothing needs a select grant on event_rsvps.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue_name text not null,
  venue_address text,
  blurb text,
  hero_image text,
  capacity int,
  allow_plus_one boolean not null default true,
  comments_open boolean not null default true,
  status text not null default 'open' check (status in ('open','closed','past')),
  created_at timestamptz not null default now()
);

create table public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  token uuid unique not null default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 80),
  wall_name text not null,
  phone text not null check (phone ~ '^\+1[2-9][0-9]{9}$'),
  email text not null check (char_length(email) <= 160),
  house text check (house in ('amistad','isibindi','reveur','altruismo')),
  grades int[] not null default '{}',
  plus_one_name text check (char_length(plus_one_name) <= 80),
  photo_path text,
  status text not null default 'going' check (status in ('going','cancelled')),
  confirm_sent_at timestamptz,
  confirm_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, phone)
);

create table public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  rsvp_id uuid not null references public.event_rsvps(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index event_rsvps_event_idx on public.event_rsvps (event_id, created_at desc);
create index event_comments_event_idx on public.event_comments (event_id, created_at);
create index event_comments_rsvp_idx on public.event_comments (rsvp_id, created_at desc);

alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.event_comments enable row level security;
revoke all on public.events, public.event_rsvps, public.event_comments from anon, authenticated;

-- Helpers ------------------------------------------------------------------

create or replace function public.event_photo_url(p_path text, p_ver timestamptz)
returns text language sql immutable set search_path = ''
as $$
  select case when p_path is null then null else
    'https://kcsrtwwpnekqdrfgcfys.supabase.co/storage/v1/object/public/event-photos/'
    || p_path || '?v=' || floor(extract(epoch from p_ver))::bigint end;
$$;

create or replace function public.event_wall_name(p_full text)
returns text language plpgsql immutable set search_path = ''
as $$
declare parts text[];
begin
  parts := regexp_split_to_array(btrim(regexp_replace(coalesce(p_full,''), '\s+', ' ', 'g')), ' ');
  if coalesce(array_length(parts, 1), 0) = 0 or parts[1] = '' then return ''; end if;
  if array_length(parts, 1) = 1 then return parts[1]; end if;
  return parts[1] || ' ' || upper(left(parts[array_length(parts, 1)], 1)) || '.';
end;
$$;

create or replace function public.event_normalize_phone(p_raw text)
returns text language plpgsql immutable set search_path = ''
as $$
declare d text := regexp_replace(coalesce(p_raw,''), '[^0-9]', '', 'g');
begin
  if length(d) = 11 and left(d, 1) = '1' then d := substr(d, 2); end if;
  if d !~ '^[2-9][0-9]{9}$' then return null; end if;
  return '+1' || d;
end;
$$;

create or replace function public.event_going_count(p_event uuid)
returns int language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(1 + case when r.plus_one_name is null then 0 else 1 end), 0)::int
  from public.event_rsvps r where r.event_id = p_event and r.status = 'going';
$$;

-- Public reads -------------------------------------------------------------

create or replace function public.event_get(p_slug text)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id, 'slug', e.slug, 'title', e.title,
    'starts_at', e.starts_at, 'ends_at', e.ends_at,
    'venue_name', e.venue_name, 'venue_address', e.venue_address,
    'blurb', e.blurb, 'hero_image', e.hero_image, 'capacity', e.capacity,
    'allow_plus_one', e.allow_plus_one, 'comments_open', e.comments_open,
    'status', e.status, 'going_count', public.event_going_count(e.id))
  from public.events e where e.slug = p_slug;
$$;

create or replace function public.event_wall(p_slug text)
returns table (id uuid, wall_name text, house text, has_plus_one boolean, photo_url text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.wall_name, r.house, r.plus_one_name is not null,
         public.event_photo_url(r.photo_path, r.updated_at), r.created_at
  from public.event_rsvps r join public.events e on e.id = r.event_id
  where e.slug = p_slug and r.status = 'going'
  order by r.created_at desc;
$$;

create or replace function public.event_thread(p_slug text)
returns table (id uuid, body text, created_at timestamptz, wall_name text, house text, photo_url text)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.body, c.created_at, r.wall_name, r.house,
         public.event_photo_url(r.photo_path, r.updated_at)
  from public.event_comments c
  join public.event_rsvps r on r.id = c.rsvp_id
  join public.events e on e.id = c.event_id
  where e.slug = p_slug and not c.hidden and r.status = 'going'
  order by c.created_at asc
  limit 500;
$$;

-- The token holder's own row, for the edit path. Includes their private fields
-- because the token is the proof they are the person who wrote them.
create or replace function public.event_rsvp_mine(p_slug text, p_token uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id, 'full_name', r.full_name, 'wall_name', r.wall_name,
    'phone', r.phone, 'email', r.email, 'house', r.house, 'grades', r.grades,
    'plus_one_name', r.plus_one_name, 'status', r.status,
    'photo_url', public.event_photo_url(r.photo_path, r.updated_at))
  from public.event_rsvps r join public.events e on e.id = r.event_id
  where e.slug = p_slug and r.token = p_token;
$$;

-- Writes -------------------------------------------------------------------

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
  if v_house is not null and v_house not in ('amistad','isibindi','reveur','altruismo') then raise exception 'invalid_house'; end if;
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

create or replace function public.event_rsvp_cancel(p_token uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.event_rsvps set status = 'cancelled', updated_at = now() where token = p_token;
  if not found then raise exception 'rsvp_not_found'; end if;
end;
$$;

create or replace function public.event_comment_post(p_token uuid, p_body text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare r public.event_rsvps; ev public.events; v_body text := btrim(coalesce(p_body,'')); v_id uuid;
begin
  select * into r from public.event_rsvps where token = p_token;
  if not found or r.status <> 'going' then raise exception 'rsvp_required'; end if;
  select * into ev from public.events where id = r.event_id;
  if not ev.comments_open then raise exception 'comments_closed'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 280 then raise exception 'invalid_body'; end if;
  if exists (select 1 from public.event_comments where rsvp_id = r.id and created_at > now() - interval '20 seconds') then
    raise exception 'slow_down';
  end if;
  insert into public.event_comments (event_id, rsvp_id, body) values (r.event_id, r.id, v_body) returning id into v_id;
  return v_id;
end;
$$;

-- Back office, same passcode as the committee back office ------------------

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
        'house', r.house, 'grades', r.grades, 'plus_one_name', r.plus_one_name,
        'status', r.status, 'photo_url', public.event_photo_url(r.photo_path, r.updated_at),
        'confirm_sent_at', r.confirm_sent_at, 'confirm_error', r.confirm_error,
        'created_at', r.created_at) order by r.created_at desc)
      from public.event_rsvps r where r.event_id = ev.id), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(jsonb_build_object(
        'id', c.id, 'body', c.body, 'hidden', c.hidden, 'created_at', c.created_at,
        'full_name', r.full_name, 'wall_name', r.wall_name) order by c.created_at desc)
      from public.event_comments c join public.event_rsvps r on r.id = c.rsvp_id
      where c.event_id = ev.id), '[]'::jsonb));
end;
$$;

create or replace function public.event_admin_hide_comment(p_pass text, p_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;
  update public.event_comments set hidden = p_hidden where id = p_id;
end;
$$;

create or replace function public.event_admin_remove_photo(p_pass text, p_rsvp uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;
  update public.event_rsvps set photo_path = null, updated_at = now() where id = p_rsvp;
end;
$$;

-- Grants: anon gets exactly the public surface.
revoke all on function
  public.event_going_count(uuid), public.event_get(text), public.event_wall(text),
  public.event_thread(text), public.event_rsvp_mine(text, uuid),
  public.event_rsvp_upsert(text, uuid, jsonb), public.event_rsvp_cancel(uuid),
  public.event_comment_post(uuid, text), public.event_admin_list(text, text),
  public.event_admin_hide_comment(text, uuid, boolean), public.event_admin_remove_photo(text, uuid)
  from public, anon, authenticated;
grant execute on function
  public.event_get(text), public.event_wall(text), public.event_thread(text),
  public.event_rsvp_mine(text, uuid), public.event_rsvp_upsert(text, uuid, jsonb),
  public.event_rsvp_cancel(uuid), public.event_comment_post(uuid, text),
  public.event_admin_list(text, text), public.event_admin_hide_comment(text, uuid, boolean),
  public.event_admin_remove_photo(text, uuid)
  to anon, authenticated;

-- Realtime: public fields only, on a public topic per event -----------------

create or replace function public.event_broadcast()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_slug text; v_payload jsonb; v_kind text; r public.event_rsvps;
begin
  select slug into v_slug from public.events where id = new.event_id;
  if tg_table_name = 'event_rsvps' then
    v_kind := 'rsvp';
    v_payload := jsonb_build_object('id', new.id, 'wall_name', new.wall_name, 'house', new.house,
      'has_plus_one', new.plus_one_name is not null, 'status', new.status,
      'photo_url', public.event_photo_url(new.photo_path, new.updated_at), 'created_at', new.created_at,
      'going_count', public.event_going_count(new.event_id));
  else
    select * into r from public.event_rsvps where id = new.rsvp_id;
    v_kind := 'comment';
    v_payload := jsonb_build_object('id', new.id, 'body', new.body, 'hidden', new.hidden,
      'created_at', new.created_at, 'wall_name', r.wall_name, 'house', r.house,
      'photo_url', public.event_photo_url(r.photo_path, r.updated_at));
  end if;
  begin
    perform realtime.send(v_payload, v_kind, 'event:' || v_slug, false);
  exception when others then null; -- a broadcast must never block a write
  end;
  return new;
end;
$$;
revoke all on function public.event_broadcast() from public, anon, authenticated;

create trigger event_rsvps_broadcast after insert or update on public.event_rsvps
  for each row execute function public.event_broadcast();
create trigger event_comments_broadcast after insert or update on public.event_comments
  for each row execute function public.event_broadcast();

-- Storage: public read, writes only by the event-photo edge function ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-photos', 'event-photos', true, 1048576, array['image/jpeg'])
on conflict (id) do nothing;

-- Seed the first event --------------------------------------------------------

insert into public.events (slug, title, starts_at, ends_at, venue_name, venue_address, blurb, hero_image)
values ('karaoke-sept-27', 'Parent Social: R&B Karaoke',
  '2026-09-27 17:00:00-04', '2026-09-27 19:00:00-04',
  'Ron Clark Academy', '228 Margaret St SE, Atlanta, GA 30315',
  'Two hours. A mic. The parents you wave at in the carpool line. Bring a song or bring a friend who has one.',
  '/meeting/sept-14/parent-social-flyer.jpg');
