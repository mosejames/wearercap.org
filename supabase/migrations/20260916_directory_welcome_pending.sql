-- Published listings that never got the welcome email, with the owner's
-- account email, for the admin "Send welcome" list. Admins only.
create or replace function public.directory_admin_welcome_pending()
returns table (id uuid, name text, account_email text, published_at timestamptz)
language sql security definer set search_path = ''
as $$
  select l.id, l.name, u.email::text, l.created_at
  from public.directory_listings l
  join auth.users u on u.id = l.owner_id
  where l.published
    and l.welcome_sent_at is null
    and exists (select 1 from public.directory_admins a where a.user_id = auth.uid())
  order by l.created_at;
$$;

revoke all on function public.directory_admin_welcome_pending() from public, anon;
grant execute on function public.directory_admin_welcome_pending() to authenticated;
