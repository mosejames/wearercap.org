-- Committee names for payment requests are editable by finance staff without
-- changing the public volunteer committee directory.
create table public.cr_payment_committees (
 name text primary key check (length(trim(name)) between 2 and 100),
 created_at timestamptz not null default now(),
 added_by text
);
create unique index cr_payment_committees_name_ci
 on public.cr_payment_committees (lower(name));
alter table public.cr_payment_committees enable row level security;
revoke all on public.cr_payment_committees from public, anon, authenticated;
grant select(name) on public.cr_payment_committees to anon, authenticated;
create policy cr_payment_committees_read on public.cr_payment_committees
 for select to anon, authenticated using (true);

insert into public.cr_payment_committees(name) values
 ('Fall Raffle'), ('Trunk or Treat'), ('Teacher Appreciation Week'),
 ('4 Days of Christmas'), ('Holiday Decor'), ('Concessions'),
 ('Uniform Swap'), ('Marketing and Communications'), ('Community Service'),
 ('EXP Support'), ('Audit Team'), ('Men of RCAP'),
 ('General RCAP'), ('Other RCAP expense');
insert into public.cr_payment_committees(name)
 select distinct trim(committee) from public.cr_approval_routes
 where length(trim(committee)) between 2 and 100
 on conflict do nothing;

alter table public.cr_approval_routes
 add constraint cr_approval_routes_committee_fk
 foreign key (committee) references public.cr_payment_committees(name);

create function cr_private.add_payment_committee(p_name text)
 returns text language plpgsql security definer set search_path = '' as $$
declare
 label text := regexp_replace(trim(coalesce(p_name, '')), '[[:space:]]+', ' ', 'g');
 who text := cr_private.email();
begin
 if auth.uid() is null or who is null or
    coalesce(cr_private.role(), '') not in ('treasurer', 'secretary', 'manager') then
  raise exception 'Finance settings access is required.';
 end if;
 if length(label) not between 2 and 100 then
  raise exception 'Enter a committee name between 2 and 100 characters.';
 end if;
 if exists (select 1 from public.cr_payment_committees where lower(name) = lower(label)) then
  raise exception 'That committee is already listed.';
 end if;
 insert into public.cr_payment_committees(name, added_by)
 values(label, who);
 return label;
end $$;
revoke all on function cr_private.add_payment_committee(text)
 from public, anon;
grant execute on function cr_private.add_payment_committee(text)
 to authenticated;

create function public.cr_add_payment_committee(p_name text)
 returns text language sql security invoker set search_path = '' as $$
 select cr_private.add_payment_committee(p_name);
$$;
revoke all on function public.cr_add_payment_committee(text)
 from public, anon;
grant execute on function public.cr_add_payment_committee(text)
 to authenticated;
