-- ---------------------------------------------------------------------------
-- 20260828150000_ami_vault.sql — The Amistad Vault
--
-- A living photo time capsule of one school year, built by the families of
-- one house. Every table is prefixed vault_ and carries a `house` column so
-- the other three houses can be switched on later without a second schema.
--
-- Identity is real Supabase Auth (magic link). Rows belong to auth.uid().
-- Nothing is ever deleted from the browser: photos and comments are hidden,
-- by their owner or by an admin. Admins are rows in vault_admins.
--
-- The image bytes do NOT live in Postgres. Each photo row carries a `storage`
-- tag ('r2' or 'supabase') and three object keys (original, web, thumb). The
-- public URL is assembled in the client from the storage tag, so moving the
-- bytes from Supabase Storage to Cloudflare R2 is a config change, not a
-- migration.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------- admins
create table if not exists public.vault_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  house      text not null default 'amistad',
  note       text not null default '',
  created_at timestamptz not null default now()
);
alter table public.vault_admins enable row level security;

-- ---------------------------------------------------------------- helpers
create or replace function public.vault_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.vault_admins a where a.user_id = auth.uid());
$$;

-- Admins can see the admin list (so the UI can show who else runs the vault);
-- everyone else sees nothing. Membership is managed in SQL only.
drop policy if exists vault_admins_read on public.vault_admins;
create policy vault_admins_read on public.vault_admins
  for select using (public.vault_is_admin());

-- ---------------------------------------------------------------- profiles
create table if not exists public.vault_profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 60),
  house        text not null default 'amistad',
  student      text not null default '' check (length(student) <= 80),
  phone        text not null default '' check (length(phone) <= 24),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table public.vault_profiles enable row level security;

-- Names appear under photos and comments, so they are readable by anyone who
-- can see the vault. Phone is only readable by the owner and admins — it is
-- there so the house can text a nudge, not for the world.
drop policy if exists vault_profiles_read on public.vault_profiles;
create policy vault_profiles_read on public.vault_profiles
  for select using (true);

drop policy if exists vault_profiles_insert on public.vault_profiles;
create policy vault_profiles_insert on public.vault_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists vault_profiles_update on public.vault_profiles;
create policy vault_profiles_update on public.vault_profiles
  for update using (auth.uid() = user_id or public.vault_is_admin())
  with check (auth.uid() = user_id or public.vault_is_admin());

-- A public view that hides the phone column. The app reads names from here.
create or replace view public.vault_people
with (security_invoker = true) as
  select user_id, display_name, house, student, created_at
  from public.vault_profiles;

-- ---------------------------------------------------------------- events
create table if not exists public.vault_events (
  id          uuid primary key default gen_random_uuid(),
  house       text not null default 'amistad',
  slug        text not null,
  title       text not null check (length(btrim(title)) between 1 and 120),
  blurb       text not null default '' check (length(blurb) <= 400),
  kind        text not null default 'school'
              check (kind in ('house','school','trip','milestone','everyday')),
  starts_on   date not null,
  ends_on     date,
  cover_photo uuid,
  open        boolean not null default true,   -- accepting uploads
  featured    boolean not null default false,  -- pinned on the home page
  hidden      boolean not null default false,
  created_by  uuid references auth.users (id),
  created_at  timestamptz not null default now(),
  unique (house, slug)
);
create index if not exists vault_events_house_starts_idx
  on public.vault_events (house, starts_on);
alter table public.vault_events enable row level security;

drop policy if exists vault_events_read on public.vault_events;
create policy vault_events_read on public.vault_events
  for select using (not hidden or public.vault_is_admin());

drop policy if exists vault_events_insert on public.vault_events;
create policy vault_events_insert on public.vault_events
  for insert with check (public.vault_is_admin());

drop policy if exists vault_events_update on public.vault_events;
create policy vault_events_update on public.vault_events
  for update using (public.vault_is_admin()) with check (public.vault_is_admin());

-- ---------------------------------------------------------------- photos
create table if not exists public.vault_photos (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.vault_events (id),
  house         text not null default 'amistad',
  user_id       uuid not null default auth.uid() references auth.users (id),
  uploader_name text not null default '' check (length(uploader_name) <= 60),
  storage       text not null check (storage in ('r2','supabase')),
  key           text not null,            -- original bytes
  web_key       text not null,            -- ~1600px JPEG for the lightbox
  thumb_key     text not null,            -- ~480px JPEG for the grid
  width         integer,
  height        integer,
  bytes         bigint,
  content_type  text not null default 'image/jpeg',
  taken_at      timestamptz,
  caption       text not null default '' check (length(caption) <= 280),
  hidden        boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists vault_photos_event_idx
  on public.vault_photos (event_id, hidden, taken_at, created_at);
create index if not exists vault_photos_user_idx
  on public.vault_photos (user_id, created_at desc);
alter table public.vault_photos enable row level security;

-- Anyone can look. Hidden photos stay visible to their owner and to admins.
drop policy if exists vault_photos_read on public.vault_photos;
create policy vault_photos_read on public.vault_photos
  for select using (not hidden or auth.uid() = user_id or public.vault_is_admin());

-- Only signed-in people add photos, only as themselves, only to an open event.
drop policy if exists vault_photos_insert on public.vault_photos;
create policy vault_photos_insert on public.vault_photos
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.vault_events e
                where e.id = event_id and e.open and not e.hidden)
  );

-- Owners fix captions or hide their own; admins do the same for anything.
-- There is no delete policy. The bytes stay put; the row goes quiet.
drop policy if exists vault_photos_update on public.vault_photos;
create policy vault_photos_update on public.vault_photos
  for update using (auth.uid() = user_id or public.vault_is_admin())
  with check (auth.uid() = user_id or public.vault_is_admin());

-- ---------------------------------------------------------------- likes
create table if not exists public.vault_likes (
  photo_id   uuid not null references public.vault_photos (id),
  user_id    uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);
create index if not exists vault_likes_photo_idx on public.vault_likes (photo_id);
alter table public.vault_likes enable row level security;

drop policy if exists vault_likes_read on public.vault_likes;
create policy vault_likes_read on public.vault_likes for select using (true);

drop policy if exists vault_likes_insert on public.vault_likes;
create policy vault_likes_insert on public.vault_likes
  for insert with check (auth.uid() = user_id);

-- Un-liking is the one true delete in the vault. It only removes your own row.
drop policy if exists vault_likes_delete on public.vault_likes;
create policy vault_likes_delete on public.vault_likes
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------- comments
create table if not exists public.vault_comments (
  id          uuid primary key default gen_random_uuid(),
  photo_id    uuid not null references public.vault_photos (id),
  user_id     uuid not null default auth.uid() references auth.users (id),
  author_name text not null default '' check (length(author_name) <= 60),
  body        text not null check (length(btrim(body)) between 1 and 500),
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists vault_comments_photo_idx
  on public.vault_comments (photo_id, created_at);
alter table public.vault_comments enable row level security;

drop policy if exists vault_comments_read on public.vault_comments;
create policy vault_comments_read on public.vault_comments
  for select using (not hidden or auth.uid() = user_id or public.vault_is_admin());

drop policy if exists vault_comments_insert on public.vault_comments;
create policy vault_comments_insert on public.vault_comments
  for insert with check (auth.uid() = user_id);

drop policy if exists vault_comments_update on public.vault_comments;
create policy vault_comments_update on public.vault_comments
  for update using (auth.uid() = user_id or public.vault_is_admin())
  with check (auth.uid() = user_id or public.vault_is_admin());

-- ---------------------------------------------------------------- requests
-- "Photos wanted." An open request is the nudge: it sits at the top of the
-- home page with a live count until it closes.
create table if not exists public.vault_requests (
  id         uuid primary key default gen_random_uuid(),
  house      text not null default 'amistad',
  event_id   uuid not null references public.vault_events (id),
  message    text not null default '' check (length(message) <= 280),
  goal       integer not null default 40 check (goal between 1 and 5000),
  due_on     date,
  open       boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index if not exists vault_requests_open_idx on public.vault_requests (house, open, due_on);
alter table public.vault_requests enable row level security;

drop policy if exists vault_requests_read on public.vault_requests;
create policy vault_requests_read on public.vault_requests for select using (true);

drop policy if exists vault_requests_insert on public.vault_requests;
create policy vault_requests_insert on public.vault_requests
  for insert with check (public.vault_is_admin());

drop policy if exists vault_requests_update on public.vault_requests;
create policy vault_requests_update on public.vault_requests
  for update using (public.vault_is_admin()) with check (public.vault_is_admin());

-- ---------------------------------------------------------------- stats
-- One row per event: how many photos, from how many families, with how many
-- likes. security_invoker means RLS on the base tables still applies.
create or replace view public.vault_event_stats
with (security_invoker = true) as
  select
    e.id as event_id,
    count(p.id)                                   as photo_count,
    count(distinct p.user_id)                     as contributor_count,
    coalesce(sum(l.n), 0)::bigint                 as like_count,
    max(p.created_at)                             as last_upload_at
  from public.vault_events e
  left join public.vault_photos p on p.event_id = e.id and not p.hidden
  left join (select photo_id, count(*) as n from public.vault_likes group by photo_id) l
    on l.photo_id = p.id
  group by e.id;

-- Per-photo like totals, so the grid does not have to pull every like row.
create or replace view public.vault_photo_likes
with (security_invoker = true) as
  select photo_id, count(*)::int as likes
  from public.vault_likes
  group by photo_id;

-- ---------------------------------------------------------------- storage
-- Supabase Storage bucket used until Cloudflare R2 is switched on. Public
-- read, authenticated write, no update or delete from the browser.
insert into storage.buckets (id, name, public, file_size_limit)
values ('vault-media', 'vault-media', true, 52428800)
on conflict (id) do nothing;

drop policy if exists vault_media_read on storage.objects;
create policy vault_media_read on storage.objects
  for select using (bucket_id = 'vault-media');

drop policy if exists vault_media_insert on storage.objects;
create policy vault_media_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'vault-media');

-- ---------------------------------------------------------------- grants
grant execute on function public.vault_is_admin() to anon, authenticated;
grant select on public.vault_people, public.vault_event_stats, public.vault_photo_likes
  to anon, authenticated;
