-- members: one row per authenticated user; the authorization record.
create table if not exists public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'parent' check (role in ('parent', 'admin')),
  approval text not null default 'pending' check (approval in ('pending', 'approved')),
  created_at timestamptz not null default now()
);

alter table public.members enable row level security;

-- Helper: is the calling user an approved admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.user_id = auth.uid()
      and m.role = 'admin'
      and m.approval = 'approved'
  );
$$;

-- Read: a user sees their own row; admins see all.
create policy members_select_self_or_admin
  on public.members for select
  using (user_id = auth.uid() or public.is_admin());

-- Insert: a user may create ONLY their own row, and only as a pending parent.
create policy members_insert_self_pending
  on public.members for insert
  with check (
    user_id = auth.uid()
    and role = 'parent'
    and approval = 'pending'
  );

-- Update: admins only (this is what makes self-approval impossible).
create policy members_update_admin_only
  on public.members for update
  using (public.is_admin())
  with check (public.is_admin());
