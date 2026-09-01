-- ---------------------------------------------------------------------------
-- 20260828160000_ami_vault_open.sql — no sign-in.
--
-- Identity is a secret token the browser makes on first visit and keeps in
-- localStorage. The database only ever stores sha256(token) as `owner`. You
-- can prove you are the owner of a row by presenting the token; nobody can
-- forge it from what is readable. That is enough for "hide my own photo" and
-- "un-love this" without a single email.
--
-- Admin is a passcode kept in vault_settings and checked inside functions,
-- exactly the Recap's shape. Change it with one UPDATE; it never ships in JS.
--
-- The photo/like/comment/profile tables were empty, so they are rebuilt
-- rather than migrated. Events and requests keep their rows.
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

drop view if exists public.vault_totals;
drop view if exists public.vault_photo_likes;
drop view if exists public.vault_event_stats;
drop view if exists public.vault_people;
drop table if exists public.vault_comments;
drop table if exists public.vault_likes;
drop table if exists public.vault_photos;
drop table if exists public.vault_profiles;
drop table if exists public.vault_admins;
drop function if exists public.vault_is_admin() cascade;

-- ---------------------------------------------------------------- helpers
create or replace function public.vault_hash(p_token text)
returns text language sql immutable as $$
  select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

create table if not exists public.vault_settings (
  house      text primary key,
  admin_pass text not null
);
alter table public.vault_settings enable row level security;   -- no policies: unreadable from the browser
insert into public.vault_settings (house, admin_pass) values ('amistad', 'ami2026')
on conflict (house) do nothing;

create or replace function public.vault_pass_ok(p_house text, p_pass text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vault_settings s
                 where s.house = p_house and s.admin_pass = coalesce(p_pass, ''));
$$;

-- ---------------------------------------------------------------- profiles
create table public.vault_profiles (
  owner        text primary key,                       -- sha256(token)
  house        text not null default 'amistad',
  display_name text not null check (length(btrim(display_name)) between 1 and 60),
  student      text not null default '' check (length(student) <= 80),
  phone        text not null default '' check (length(phone) <= 24),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.vault_profiles enable row level security;
-- No direct policies. Reads go through vault_people (no phone); writes go
-- through vault_save_profile (token-checked).

create or replace view public.vault_people
with (security_invoker = false) as
  select owner, display_name, house, student, created_at from public.vault_profiles;

create or replace function public.vault_save_profile(
  p_token text, p_name text, p_student text default '', p_phone text default ''
) returns public.vault_people
language plpgsql security definer set search_path = public as $$
declare o text := public.vault_hash(p_token); r public.vault_people;
begin
  if length(coalesce(p_token, '')) < 16 then raise exception 'Bad token'; end if;
  insert into public.vault_profiles (owner, display_name, student, phone)
  values (o, btrim(p_name), coalesce(btrim(p_student), ''), coalesce(btrim(p_phone), ''))
  on conflict (owner) do update
    set display_name = excluded.display_name, student = excluded.student,
        phone = excluded.phone, updated_at = now();
  select * into r from public.vault_people where owner = o;
  return r;
end $$;

-- ---------------------------------------------------------------- events
alter table public.vault_events drop column if exists created_by;
drop policy if exists vault_events_insert on public.vault_events;
drop policy if exists vault_events_update on public.vault_events;
drop policy if exists vault_events_read on public.vault_events;
create policy vault_events_read on public.vault_events for select using (not hidden);

create or replace function public.vault_admin_save_event(p_pass text, p_id uuid, p jsonb)
returns public.vault_events
language plpgsql security definer set search_path = public as $$
declare r public.vault_events;
begin
  if not public.vault_pass_ok('amistad', p_pass) then raise exception 'Wrong passcode'; end if;
  if p_id is null then
    insert into public.vault_events (house, slug, title, blurb, kind, starts_on, ends_on, open, featured, hidden)
    values ('amistad', p->>'slug', p->>'title', coalesce(p->>'blurb',''), coalesce(p->>'kind','house'),
            (p->>'starts_on')::date, nullif(p->>'ends_on','')::date,
            coalesce((p->>'open')::boolean, true), coalesce((p->>'featured')::boolean, false), coalesce((p->>'hidden')::boolean, false))
    returning * into r;
  else
    update public.vault_events set
      slug = p->>'slug', title = p->>'title', blurb = coalesce(p->>'blurb',''), kind = coalesce(p->>'kind', kind),
      starts_on = (p->>'starts_on')::date, ends_on = nullif(p->>'ends_on','')::date,
      open = coalesce((p->>'open')::boolean, open), featured = coalesce((p->>'featured')::boolean, featured),
      hidden = coalesce((p->>'hidden')::boolean, hidden)
    where id = p_id returning * into r;
  end if;
  return r;
end $$;

-- ---------------------------------------------------------------- photos
create table public.vault_photos (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.vault_events (id),
  house         text not null default 'amistad',
  owner         text not null,                          -- sha256(token)
  uploader_name text not null default '' check (length(uploader_name) <= 60),
  storage       text not null check (storage in ('r2','supabase')),
  key           text not null,
  web_key       text not null,
  thumb_key     text not null,
  width         integer,
  height        integer,
  bytes         bigint,
  content_type  text not null default 'image/jpeg',
  taken_at      timestamptz,
  caption       text not null default '' check (length(caption) <= 280),
  hidden        boolean not null default false,
  created_at    timestamptz not null default now()
);
create index vault_photos_event_idx on public.vault_photos (event_id, hidden, taken_at, created_at);
create index vault_photos_owner_idx on public.vault_photos (owner, created_at desc);
alter table public.vault_photos enable row level security;

-- Anyone can read (hidden rows are filtered in the client, which needs them
-- to show an owner their own hidden photo). Anyone can add to an open event.
-- Nobody can update or delete from the browser.
create policy vault_photos_read on public.vault_photos for select using (true);
create policy vault_photos_insert on public.vault_photos for insert
  with check (exists (select 1 from public.vault_events e where e.id = event_id and e.open and not e.hidden));

-- Hide or show: the owner (by token) or an admin (by passcode).
create or replace function public.vault_set_photo(
  p_id uuid, p_token text, p_pass text, p_hidden boolean default null, p_caption text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  select (owner = public.vault_hash(p_token)) or public.vault_pass_ok(house, p_pass)
    into ok from public.vault_photos where id = p_id;
  if not coalesce(ok, false) then raise exception 'Not yours'; end if;
  update public.vault_photos
    set hidden = coalesce(p_hidden, hidden), caption = coalesce(left(p_caption, 280), caption)
    where id = p_id;
end $$;

-- ---------------------------------------------------------------- likes
create table public.vault_likes (
  photo_id   uuid not null references public.vault_photos (id),
  owner      text not null,
  created_at timestamptz not null default now(),
  primary key (photo_id, owner)
);
alter table public.vault_likes enable row level security;
create policy vault_likes_read on public.vault_likes for select using (true);
create policy vault_likes_insert on public.vault_likes for insert with check (true);

create or replace function public.vault_unlike(p_photo uuid, p_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.vault_likes where photo_id = p_photo and owner = public.vault_hash(p_token);
$$;

-- ---------------------------------------------------------------- comments
create table public.vault_comments (
  id          uuid primary key default gen_random_uuid(),
  photo_id    uuid not null references public.vault_photos (id),
  owner       text not null,
  author_name text not null default '' check (length(author_name) <= 60),
  body        text not null check (length(btrim(body)) between 1 and 500),
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index vault_comments_photo_idx on public.vault_comments (photo_id, created_at);
alter table public.vault_comments enable row level security;
create policy vault_comments_read on public.vault_comments for select using (not hidden);
create policy vault_comments_insert on public.vault_comments for insert with check (true);

create or replace function public.vault_hide_comment(p_id uuid, p_token text, p_pass text)
returns void language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  select (c.owner = public.vault_hash(p_token)) or public.vault_pass_ok(p.house, p_pass)
    into ok from public.vault_comments c join public.vault_photos p on p.id = c.photo_id where c.id = p_id;
  if not coalesce(ok, false) then raise exception 'Not yours'; end if;
  update public.vault_comments set hidden = true where id = p_id;
end $$;

-- ---------------------------------------------------------------- requests
alter table public.vault_requests drop column if exists created_by;
drop policy if exists vault_requests_insert on public.vault_requests;
drop policy if exists vault_requests_update on public.vault_requests;

create or replace function public.vault_admin_save_request(p_pass text, p_id uuid, p jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.vault_pass_ok('amistad', p_pass) then raise exception 'Wrong passcode'; end if;
  if p_id is null then
    insert into public.vault_requests (house, event_id, message, goal, due_on, open)
    values ('amistad', (p->>'event_id')::uuid, coalesce(p->>'message',''), coalesce((p->>'goal')::int, 40),
            nullif(p->>'due_on','')::date, coalesce((p->>'open')::boolean, true));
  else
    update public.vault_requests set
      event_id = (p->>'event_id')::uuid, message = coalesce(p->>'message',''), goal = coalesce((p->>'goal')::int, goal),
      due_on = nullif(p->>'due_on','')::date, open = coalesce((p->>'open')::boolean, open)
    where id = p_id;
  end if;
end $$;

-- Phone numbers, admins only.
create or replace function public.vault_admin_phones(p_pass text)
returns table (display_name text, student text, phone text)
language sql security definer set search_path = public as $$
  select display_name, student, phone from public.vault_profiles
  where phone <> '' and public.vault_pass_ok(house, p_pass);
$$;

-- ---------------------------------------------------------------- views
create or replace view public.vault_event_stats
with (security_invoker = true) as
  select e.id as event_id,
    count(p.id) as photo_count,
    count(distinct p.owner) as contributor_count,
    coalesce(sum(l.n), 0)::bigint as like_count,
    max(p.created_at) as last_upload_at
  from public.vault_events e
  left join public.vault_photos p on p.event_id = e.id and not p.hidden
  left join (select photo_id, count(*) as n from public.vault_likes group by photo_id) l on l.photo_id = p.id
  group by e.id;

create or replace view public.vault_photo_likes
with (security_invoker = true) as
  select photo_id, count(*)::int as likes from public.vault_likes group by photo_id;

create or replace view public.vault_totals
with (security_invoker = true) as
  select e.house,
    count(p.id) as photo_count,
    count(distinct p.owner) as family_count,
    count(distinct p.event_id) as event_count,
    (select count(*) from public.vault_likes l join public.vault_photos q on q.id = l.photo_id
      where q.house = e.house and not q.hidden) as like_count
  from public.vault_events e
  left join public.vault_photos p on p.event_id = e.id and not p.hidden
  group by e.house;

-- ---------------------------------------------------------------- storage
drop policy if exists vault_media_insert on storage.objects;
create policy vault_media_insert on storage.objects for insert
  with check (bucket_id = 'vault-media');

-- ---------------------------------------------------------------- grants
grant select on public.vault_people, public.vault_event_stats, public.vault_photo_likes, public.vault_totals
  to anon, authenticated;
grant execute on function
  public.vault_hash(text), public.vault_pass_ok(text, text),
  public.vault_save_profile(text, text, text, text),
  public.vault_admin_save_event(text, uuid, jsonb),
  public.vault_set_photo(uuid, text, text, boolean, text),
  public.vault_unlike(uuid, text),
  public.vault_hide_comment(uuid, text, text),
  public.vault_admin_save_request(text, uuid, jsonb),
  public.vault_admin_phones(text)
  to anon, authenticated;
