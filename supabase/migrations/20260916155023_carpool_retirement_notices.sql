-- Retire a crew without deleting its history or changing any family profile.
alter table public.groups add column if not exists retired_at timestamptz;

-- Applies even to clients still running an older build.
create policy groups_hide_retired on public.groups as restrictive
  for select to authenticated using (retired_at is null);

alter table public.join_requests drop constraint join_requests_status_check;
alter table public.join_requests add constraint join_requests_status_check
  check (status in ('pending', 'accepted', 'declined', 'retired'));

create table public.carpool_retirement_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.groups(id),
  group_name text not null,
  created_at timestamptz not null default now(),
  dismissed_at timestamptz,
  unique (user_id, group_id)
);
alter table public.carpool_retirement_notices enable row level security;
revoke all on public.carpool_retirement_notices from anon, authenticated;
grant select on public.carpool_retirement_notices to authenticated;
grant update (dismissed_at) on public.carpool_retirement_notices to authenticated;
create policy notices_read_own on public.carpool_retirement_notices
  for select to authenticated using (user_id = (select auth.uid()) and public.is_approved_member());
create policy notices_dismiss_own on public.carpool_retirement_notices
  for update to authenticated
  using (user_id = (select auth.uid()) and public.is_approved_member())
  with check (user_id = (select auth.uid()) and public.is_approved_member());

-- Invoker trigger also runs inside the existing privileged join/accept RPCs.
-- The explicit retired_at check therefore matters even when RLS is bypassed.
-- Retirement runs with table write locks so existing operations finish first.
create function public.carpool_require_active_group()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.groups g
  where g.id = new.group_id and g.retired_at is null;
  if not found then
    raise exception 'This crew has been retired. Explore nearby families or start your own crew.';
  end if;
  return new;
end;
$$;
revoke all on function public.carpool_require_active_group() from public, anon, authenticated;
create trigger carpool_request_active_group before insert on public.join_requests
  for each row execute function public.carpool_require_active_group();
create trigger carpool_membership_active_group before insert on public.memberships
  for each row execute function public.carpool_require_active_group();
