-- families: one row per member; the family's carpool profile.
-- PROTECTED columns (address, lat, lng, contact_*) are readable only by the
-- family itself and admins. EXPOSED area_* columns (zip centroid) are what a
-- later phase will surface to other families. RLS enforces this.
create table if not exists public.families (
  user_id uuid primary key references auth.users (id) on delete cascade,
  parent_name text not null,
  child_names text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  area_lat double precision not null,
  area_lng double precision not null,
  area_label text not null,
  direction text not null check (direction in ('am', 'pm', 'both')),
  weekdays text[] not null check (weekdays <@ array['mon','tue','wed','thu','fri']),
  contact_phone text,
  contact_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.families enable row level security;

-- Helper: is the caller an approved member? (SECURITY DEFINER to bypass RLS on
-- members and avoid any policy recursion, mirroring is_admin().)
create or replace function public.is_approved_member()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.user_id = auth.uid()
      and m.approval = 'approved'
  );
$$;

-- Read: only your own row; admins read all. No path to read another family here.
create policy families_select_self_or_admin
  on public.families for select
  using (user_id = auth.uid() or public.is_admin());

-- Insert: only your own row, and only if you are an approved member.
create policy families_insert_self_approved
  on public.families for insert
  with check (user_id = auth.uid() and public.is_approved_member());

-- Update: only your own row, and only while an approved member.
create policy families_update_self_approved
  on public.families for update
  using (user_id = auth.uid() and public.is_approved_member())
  with check (user_id = auth.uid() and public.is_approved_member());

-- No delete policy: deletes are denied by default (admin removal is Phase 4).
