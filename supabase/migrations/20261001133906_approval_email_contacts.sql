-- Named choices for optional approval confirmation recipients.
-- Addresses are organization data, not bundled into public client code.
create table public.cr_approval_email_contacts (
 email text primary key check (email=lower(email) and email ~ '^[^[:space:]@,<>]+@[^[:space:]@,<>]+\.[^[:space:]@,<>]+$'),
 name text not null check (length(trim(name)) between 2 and 100),
 sort_order integer not null default 100,
 active boolean not null default true
);
alter table public.cr_approval_email_contacts enable row level security;
revoke all on public.cr_approval_email_contacts from anon,authenticated;

create function cr_private.approval_email_contacts()
returns table(name text,email text,automatic boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(cr_private.role(),'') not in ('treasurer','secretary','manager','board','approver') then
  raise exception 'Board access is required.';
 end if;
 return query
  select c.name,c.email,c.email=any(coalesce(cfg.notify_to,'{}'))
  from public.cr_approval_email_contacts c cross join cr_private.config cfg
  where c.active and cfg.id
  order by c.sort_order,c.name;
end $$;
revoke all on function cr_private.approval_email_contacts() from public,anon,authenticated;
grant execute on function cr_private.approval_email_contacts() to authenticated;

create function public.cr_approval_email_contacts()
returns table(name text,email text,automatic boolean)
language sql stable security invoker set search_path='' as $$
 select * from cr_private.approval_email_contacts();
$$;
revoke all on function public.cr_approval_email_contacts() from public,anon;
grant execute on function public.cr_approval_email_contacts() to authenticated;
