-- ============================================================================
-- M³ Vault: Mall Math Marathon, Class of 2028, Tuesday September 15, 2026
-- Step 1 of the recipe: schema, RLS, admin-passcode function, seed.
--
-- Applied to the live project September 12, 2026 (migration m3_vault).
--
-- Decisions (recipe section 2), written down so they are decisions and not drift:
--   Group ........ Class of 2028 families + chaperones, Dr. Valerie Camille Jones
--   Span ......... one day. Opens 12:01am Sept 15 (America/New_York), never closes.
--   Unit ......... a "moment" of the day (Meet-up, Missions, Lunch) plus one
--                  permanent "Around the Mall" album for everything else.
--   Identity ..... none. Browser token, name typed once. owner = sha256(token).
--   Visibility ... open link + noindex today. A front-door passcode is a single
--                  UPDATE on m3_settings.gate_pass; the check function already exists.
--   Delete ....... nobody. Owners and admins hide. No update/delete policy anywhere.
--   Timezone ..... one rule, one function: m3_today(). Never new Date() in the app.
--   Featuring .... no "featured" flag. Cover = newest photo. (Recipe section 10.)
--
-- Separate m3_ prefix, not a new `house` row on vault_*. The live vault_* schema
-- has since moved to SMS-verified accounts and hardcodes 'amistad' inside its
-- functions; this vault is no-sign-in and single-day, and should not inherit that.
-- Every table still carries a `vault` column so a second specialty event
-- (another M³, a field trip) is a settings row and a seed, not a second schema.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table public.m3_settings (
  vault       text primary key,
  title       text not null,
  admin_pass  text not null,
  gate_pass   text,                                   -- null = open link
  timezone    text not null default 'America/New_York',
  event_date  date not null,
  created_at  timestamptz not null default now()
);

create table public.m3_events (
  id          uuid primary key default gen_random_uuid(),
  vault       text not null default 'm3-2028' references public.m3_settings(vault),
  slug        text not null,
  title       text not null,
  blurb       text not null default '',
  kind        text not null default 'moment' check (kind in ('moment','everyday')),
  starts_on   date not null,
  starts_at   time,                                   -- order within the day; null sorts first
  ends_on     date,
  ongoing     boolean not null default false,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (vault, slug)
);

create table public.m3_profiles (
  owner        text primary key,                      -- sha256(token), never a name
  vault        text not null default 'm3-2028' references public.m3_settings(vault),
  display_name text not null,                         -- the chaperone
  team         text not null default '',              -- typed once; the app groups by it
  students     text[] not null default '{}',          -- the three or four in their group
  phone        text not null default '',              -- leaves the server only via m3_admin_phones
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.m3_photos (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.m3_events(id),
  vault         text not null default 'm3-2028' references public.m3_settings(vault),
  owner         text not null check (length(owner) = 64),
  uploader_name text not null default '',
  kind          text not null default 'photo' check (kind in ('photo','video')),
  storage       text not null check (storage in ('supabase','r2')),
  key           text not null,                        -- original, byte for byte
  web_key       text not null,                        -- ~1800px jpeg (video: same as key)
  thumb_key     text not null,                        -- ~560px jpeg  (video: poster frame)
  width         integer,
  height        integer,
  bytes         bigint,
  duration_s    numeric,                              -- video only
  content_type  text not null default 'image/jpeg',
  taken_at      timestamptz,                          -- EXIF capture time
  caption       text not null default '' check (length(caption) <= 280),
  hidden        boolean not null default false,
  created_at    timestamptz not null default now()
);
create index m3_photos_event_order on public.m3_photos (event_id, (coalesce(taken_at, created_at)));
create index m3_photos_owner on public.m3_photos (owner);

create table public.m3_likes (
  photo_id    uuid not null references public.m3_photos(id),
  owner       text not null check (length(owner) = 64),
  created_at  timestamptz not null default now(),
  primary key (photo_id, owner)
);

create table public.m3_comments (
  id          uuid primary key default gen_random_uuid(),
  photo_id    uuid not null references public.m3_photos(id),
  owner       text not null check (length(owner) = 64),
  author_name text not null default '',
  body        text not null check (length(btrim(body)) between 1 and 500),
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index m3_comments_photo on public.m3_comments (photo_id, created_at);

create table public.m3_requests (
  id          uuid primary key default gen_random_uuid(),
  vault       text not null default 'm3-2028' references public.m3_settings(vault),
  event_id    uuid not null references public.m3_events(id),
  message     text not null default '',
  goal        integer not null default 40,
  due_on      date,
  open        boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Helpers. One question, one function.
-- ----------------------------------------------------------------------------

create or replace function public.m3_hash(p_token text) returns text
language sql immutable set search_path = '' as $$
  select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
$$;

-- Today, in the vault's timezone. The only place a date comes from.
create or replace function public.m3_today(p_vault text default 'm3-2028') returns date
language sql stable security definer set search_path = '' as $$
  select (now() at time zone coalesce((select timezone from public.m3_settings where vault = p_vault), 'America/New_York'))::date;
$$;

-- "Can I upload here?" Opens 12:01am on the day, never closes. <=, not <.
create or replace function public.m3_can_upload(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.m3_events e
    where e.id = p_event and not e.hidden
      and (e.ongoing or e.starts_on <= public.m3_today(e.vault))
  );
$$;

-- Admin passcode, checked in the database. Never in the bundle.
create or replace function public.m3_pass_ok(p_vault text, p_pass text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.m3_settings s where s.vault = p_vault and s.admin_pass = coalesce(p_pass, ''));
$$;

-- Front door. True while gate_pass is null; flip it on with one UPDATE.
create or replace function public.m3_gate_ok(p_vault text, p_pass text default '') returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.m3_settings s where s.vault = p_vault and (s.gate_pass is null or s.gate_pass = coalesce(p_pass, '')));
$$;

-- ----------------------------------------------------------------------------
-- Views. Counts, and people without phones.
-- ----------------------------------------------------------------------------

create view public.m3_people as
  select owner, vault, display_name, team, students, created_at from public.m3_profiles;

-- One row per team: who chaperoned, which students, how many photos. Dr. J's view.
create view public.m3_teams as
  select pr.vault, pr.team,
         array_agg(distinct pr.display_name order by pr.display_name) as chaperones,
         array_agg(distinct s order by s) filter (where s is not null) as students,
         count(distinct ph.id) as photo_count,
         max(ph.created_at) as last_upload_at
  from public.m3_profiles pr
  left join lateral unnest(pr.students) s on true
  left join public.m3_photos ph on ph.owner = pr.owner and not ph.hidden
  where pr.team <> ''
  group by pr.vault, pr.team;

create view public.m3_photo_likes as
  select photo_id, count(*)::int as likes from public.m3_likes group by photo_id;

create view public.m3_event_stats as
  select e.id as event_id,
         count(p.id) as photo_count,
         count(distinct p.owner) as contributor_count,
         coalesce(sum(l.likes), 0) as like_count,
         max(p.created_at) as last_upload_at
  from public.m3_events e
  left join public.m3_photos p on p.event_id = e.id and not p.hidden
  left join public.m3_photo_likes l on l.photo_id = p.id
  group by e.id;

create view public.m3_totals as
  select p.vault,
         count(*) as photo_count,
         count(distinct p.owner) as family_count,
         count(distinct p.event_id) as event_count,
         (select count(*) from public.m3_likes l join public.m3_photos q on q.id = l.photo_id where q.vault = p.vault and not q.hidden) as like_count
  from public.m3_photos p where not p.hidden group by p.vault;

-- ----------------------------------------------------------------------------
-- RLS. Reads are open for what is not hidden. Writes are inserts only, and
-- only where the browser can prove nothing it should not. Everything else
-- is a SECURITY DEFINER function below. No update or delete policy anywhere.
-- ----------------------------------------------------------------------------

alter table public.m3_settings enable row level security;   -- no policies. Ever.
alter table public.m3_events   enable row level security;
alter table public.m3_profiles enable row level security;   -- no policies; read via m3_people, write via m3_save_profile
alter table public.m3_photos   enable row level security;
alter table public.m3_likes    enable row level security;
alter table public.m3_comments enable row level security;
alter table public.m3_requests enable row level security;

create policy m3_events_read on public.m3_events for select using (not hidden);
create policy m3_requests_read on public.m3_requests for select using (true);
create policy m3_photos_read on public.m3_photos for select using (not hidden);
create policy m3_likes_read on public.m3_likes for select using (true);
create policy m3_comments_read on public.m3_comments for select using (not hidden);

-- The upload row. The app writes this after the three files land.
create policy m3_photos_insert on public.m3_photos for insert
  with check (public.m3_can_upload(event_id) and not hidden
              and vault = (select vault from public.m3_events e where e.id = event_id));

create policy m3_likes_insert on public.m3_likes for insert
  with check (exists (select 1 from public.m3_photos p where p.id = photo_id and not p.hidden));

create policy m3_comments_insert on public.m3_comments for insert
  with check (not hidden and exists (select 1 from public.m3_photos p where p.id = photo_id and not p.hidden));

-- ----------------------------------------------------------------------------
-- Writes that need proof: the token (owner) or the passcode (admin).
-- ----------------------------------------------------------------------------

create or replace function public.m3_save_profile(p_token text, p_name text, p_team text default '', p_students text[] default '{}', p_phone text default '')
returns public.m3_people language plpgsql security definer set search_path = '' as $$
declare o text := public.m3_hash(p_token); r public.m3_people; kids text[];
begin
  if length(coalesce(p_token,'')) < 16 then raise exception 'Bad token'; end if;
  if length(btrim(coalesce(p_name,''))) = 0 then raise exception 'Name required'; end if;
  select coalesce(array_agg(left(btrim(k), 60)) filter (where btrim(k) <> ''), '{}') into kids
    from unnest(coalesce(p_students, '{}')) k;
  insert into public.m3_profiles (owner, display_name, team, students, phone)
  values (o, left(btrim(p_name), 60), left(coalesce(btrim(p_team),''), 40), kids[1:6], left(coalesce(btrim(p_phone),''), 20))
  on conflict (owner) do update
    set display_name = excluded.display_name, team = excluded.team, students = excluded.students,
        phone = case when excluded.phone = '' then public.m3_profiles.phone else excluded.phone end,
        updated_at = now();
  select * into r from public.m3_people where owner = o;
  return r;
end $$;

-- Hide (or caption) an upload: its owner by token, or an admin by passcode.
create or replace function public.m3_set_photo(p_id uuid, p_token text, p_pass text, p_hidden boolean default null, p_caption text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.m3_photos; a boolean;
begin
  select * into p from public.m3_photos where id = p_id;
  if p.id is null then raise exception 'No such upload'; end if;
  a := public.m3_pass_ok(p.vault, p_pass);
  if not (a or p.owner = public.m3_hash(p_token)) then raise exception 'You cannot change this upload'; end if;
  update public.m3_photos set hidden = coalesce(p_hidden, hidden), caption = coalesce(left(p_caption, 280), caption) where id = p_id;
end $$;

create or replace function public.m3_hide_comment(p_id uuid, p_token text, p_pass text)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.m3_comments; v text;
begin
  select * into c from public.m3_comments where id = p_id;
  if c.id is null then raise exception 'No such comment'; end if;
  select vault into v from public.m3_photos where id = c.photo_id;
  if not (public.m3_pass_ok(v, p_pass) or c.owner = public.m3_hash(p_token)) then raise exception 'You cannot hide this comment'; end if;
  update public.m3_comments set hidden = true where id = p_id;
end $$;

-- The only real delete: your own like.
create or replace function public.m3_unlike(p_photo uuid, p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from public.m3_likes where photo_id = p_photo and owner = public.m3_hash(p_token);
$$;

-- Admin: create or edit a moment. No close switch; hide is the only door.
create or replace function public.m3_admin_save_event(p_pass text, p_id uuid, p jsonb)
returns public.m3_events language plpgsql security definer set search_path = '' as $$
declare r public.m3_events; v text := coalesce(p->>'vault', 'm3-2028');
begin
  if not public.m3_pass_ok(v, p_pass) then raise exception 'Wrong passcode'; end if;
  if p_id is null then
    insert into public.m3_events (vault, slug, title, blurb, kind, starts_on, starts_at, ends_on, ongoing, hidden)
    values (v, p->>'slug', p->>'title', coalesce(p->>'blurb',''), coalesce(p->>'kind','moment'),
            (p->>'starts_on')::date, nullif(p->>'starts_at','')::time, nullif(p->>'ends_on','')::date,
            coalesce((p->>'ongoing')::boolean, false), coalesce((p->>'hidden')::boolean, false))
    returning * into r;
  else
    update public.m3_events set
      slug = coalesce(p->>'slug', slug), title = coalesce(p->>'title', title), blurb = coalesce(p->>'blurb', blurb),
      kind = coalesce(p->>'kind', kind),
      starts_on = coalesce((p->>'starts_on')::date, starts_on),
      starts_at = case when p ? 'starts_at' then nullif(p->>'starts_at','')::time else starts_at end,
      ends_on = case when p ? 'ends_on' then nullif(p->>'ends_on','')::date else ends_on end,
      ongoing = coalesce((p->>'ongoing')::boolean, ongoing),
      hidden = coalesce((p->>'hidden')::boolean, hidden)
    where id = p_id and vault = v returning * into r;
    if r.id is null then raise exception 'No such event'; end if;
  end if;
  return r;
end $$;

-- Admin: open or close a "photos wanted" ask. Requests close; albums do not.
create or replace function public.m3_admin_save_request(p_pass text, p_id uuid, p jsonb)
returns public.m3_requests language plpgsql security definer set search_path = '' as $$
declare r public.m3_requests; v text := coalesce(p->>'vault', 'm3-2028');
begin
  if not public.m3_pass_ok(v, p_pass) then raise exception 'Wrong passcode'; end if;
  if p_id is null then
    insert into public.m3_requests (vault, event_id, message, goal, due_on, open)
    values (v, (p->>'event_id')::uuid, coalesce(p->>'message',''), coalesce((p->>'goal')::int, 40),
            nullif(p->>'due_on','')::date, coalesce((p->>'open')::boolean, true))
    returning * into r;
  else
    update public.m3_requests set
      event_id = coalesce((p->>'event_id')::uuid, event_id), message = coalesce(p->>'message', message),
      goal = coalesce((p->>'goal')::int, goal),
      due_on = case when p ? 'due_on' then nullif(p->>'due_on','')::date else due_on end,
      open = coalesce((p->>'open')::boolean, open)
    where id = p_id and vault = v returning * into r;
    if r.id is null then raise exception 'No such request'; end if;
  end if;
  return r;
end $$;

-- Admin: move uploads to the right moment. Reversible, unlike a delete.
create or replace function public.m3_move_uploads(p_pass text, p_photos uuid[], p_to uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v text; n integer;
begin
  select vault into v from public.m3_events where id = p_to;
  if v is null or not public.m3_pass_ok(v, p_pass) then raise exception 'Wrong passcode'; end if;
  update public.m3_photos set event_id = p_to where id = any(p_photos) and vault = v;
  get diagnostics n = row_count;
  return n;
end $$;

-- Admin: the phone numbers people chose to give, for the nudge text and nothing else.
create or replace function public.m3_admin_phones(p_pass text, p_vault text default 'm3-2028')
returns table (display_name text, team text, phone text)
language sql stable security definer set search_path = '' as $$
  select display_name, team, phone from public.m3_profiles
  where vault = p_vault and phone <> '' and public.m3_pass_ok(p_vault, p_pass)
  order by display_name;
$$;

-- ----------------------------------------------------------------------------
-- Grants. Views and functions are the surface; tables only through RLS.
-- ----------------------------------------------------------------------------

grant select on public.m3_people, public.m3_teams, public.m3_photo_likes, public.m3_event_stats, public.m3_totals to anon, authenticated;
grant select, insert on public.m3_photos, public.m3_likes, public.m3_comments to anon, authenticated;
grant select on public.m3_events, public.m3_requests to anon, authenticated;

revoke all on function public.m3_hash(text), public.m3_today(text), public.m3_can_upload(uuid),
  public.m3_pass_ok(text,text), public.m3_gate_ok(text,text),
  public.m3_save_profile(text,text,text,text[],text), public.m3_set_photo(uuid,text,text,boolean,text),
  public.m3_hide_comment(uuid,text,text), public.m3_unlike(uuid,text),
  public.m3_admin_save_event(text,uuid,jsonb), public.m3_admin_save_request(text,uuid,jsonb),
  public.m3_move_uploads(text,uuid[],uuid), public.m3_admin_phones(text,text)
from public;

grant execute on function public.m3_hash(text), public.m3_today(text), public.m3_can_upload(uuid),
  public.m3_pass_ok(text,text), public.m3_gate_ok(text,text),
  public.m3_save_profile(text,text,text,text[],text), public.m3_set_photo(uuid,text,text,boolean,text),
  public.m3_hide_comment(uuid,text,text), public.m3_unlike(uuid,text),
  public.m3_admin_save_event(text,uuid,jsonb), public.m3_admin_save_request(text,uuid,jsonb),
  public.m3_move_uploads(text,uuid[],uuid), public.m3_admin_phones(text,text)
to anon, authenticated;

-- ----------------------------------------------------------------------------
-- Seed: the real day. Change the passcode before this goes live.
-- ----------------------------------------------------------------------------

insert into public.m3_settings (vault, title, admin_pass, event_date)
values ('m3-2028', 'Mall Math Marathon · Class of 2028', 'm3lenox', '2026-09-15');

insert into public.m3_events (vault, slug, title, blurb, kind, starts_on, starts_at, ongoing) values
  ('m3-2028', 'around-the-mall', 'Around the Mall',
   'Everything that does not fit a moment. Groups on the move, the walk between stores, the faces.',
   'everyday', '2026-09-15', null, true),
  ('m3-2028', 'meet-up', 'Food Court Meet-up',
   'Back of the food court by the parking lot entrance. Chaperones at 9:15, hard start 9:30 sharp.',
   'moment', '2026-09-15', '09:15', false),
  ('m3-2028', 'missions', 'The Missions',
   'Groups of three race the mall: sales, discounts, percentages, budgets. No help, no maps, no shortcuts. 9:30 to noon.',
   'moment', '2026-09-15', '09:30', false),
  ('m3-2028', 'lunch', 'Lunch in the Food Court',
   'Noon to one. Missions done, math put away, the debrief happens over food.',
   'moment', '2026-09-15', '12:00', false);

insert into public.m3_requests (vault, event_id, message, goal, due_on)
select 'm3-2028', id, 'Every group, every mission. Add what you shot before you forget which store it was.', 60, '2026-09-17'
from public.m3_events where vault = 'm3-2028' and slug = 'missions';
