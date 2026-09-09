alter table public.directory_listings
  add column if not exists welcome_sent_at timestamptz;

create or replace function public.directory_admin_export()
returns table (
  name text, account_email text, business_email text, phone text,
  category text, venture text, house text, website text,
  published_at timestamptz, updated_at timestamptz
)
language sql security definer set search_path = ''
as $$
  select l.name, u.email::text, l.email, l.phone, l.category, l.venture,
         l.house, l.website, l.created_at, l.updated_at
  from public.directory_listings l
  join auth.users u on u.id = l.owner_id
  where l.published
    and exists (select 1 from public.directory_admins a where a.user_id = auth.uid())
  order by l.created_at desc;
$$;

revoke all on function public.directory_admin_export() from public, anon;
grant execute on function public.directory_admin_export() to authenticated;
