-- ---------------------------------------------------------------------------
-- 0010_recap.sql — The RCAP Recap
-- Parent-submitted stories, words and photos from summer EXP.
-- ---------------------------------------------------------------------------

create table if not exists public.recap_entries (
  id           uuid primary key default gen_random_uuid(),
  event_slug   text        not null default 'esp-2026',
  child        text        not null check (length(btrim(child)) between 1 and 40),
  relation     text        not null check (relation in
                 ('Mom','Dad','Grandparent','Auntie','Uncle','Bonus Parent','Guardian')),
  grad_class   text        not null check (grad_class in
                 ('2027','2028','2029','2030','2031','2032')),
  house        text        not null check (house in
                 ('altruismo','amistad','isibindi','reveur','tbd')),
  word         text        not null check (word in
                 ('tired','inspired','proud','welcomed','full','home')),
  story        text        not null default '' check (length(story) <= 400),
  media        jsonb       not null default '[]'::jsonb,
  first_summer boolean     not null default false,
  hidden       boolean     not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists recap_entries_event_created_idx
  on public.recap_entries (event_slug, created_at desc);

alter table public.recap_entries enable row level security;

-- Anyone can read. Hidden rows are filtered in the client; nothing here is
-- sensitive (first names and a relation only), and this keeps the back office
-- working on the anon key without a second auth path.
drop policy if exists recap_entries_read on public.recap_entries;
create policy recap_entries_read
  on public.recap_entries for select
  using (true);

-- Anyone can add their own piece. No update or delete policy exists, so rows
-- cannot be edited or removed from the browser.
drop policy if exists recap_entries_insert on public.recap_entries;
create policy recap_entries_insert
  on public.recap_entries for insert
  with check (true);

-- ---------------------------------------------------------------------------
-- Hiding an entry runs through a function so the passcode is checked in the
-- database, not the browser. Change the passcode on the line below.
-- ---------------------------------------------------------------------------
create or replace function public.recap_set_hidden(
  p_id uuid, p_hidden boolean, p_pass text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pass is distinct from 'rcap2026' then
    raise exception 'Wrong passcode';
  end if;
  update public.recap_entries set hidden = p_hidden where id = p_id;
end;
$$;

revoke all on function public.recap_set_hidden(uuid, boolean, text) from public;
grant execute on function public.recap_set_hidden(uuid, boolean, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage for photos and video.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('recap-media', 'recap-media', true)
on conflict (id) do nothing;

drop policy if exists recap_media_read on storage.objects;
create policy recap_media_read
  on storage.objects for select
  using (bucket_id = 'recap-media');

drop policy if exists recap_media_insert on storage.objects;
create policy recap_media_insert
  on storage.objects for insert
  with check (bucket_id = 'recap-media');
