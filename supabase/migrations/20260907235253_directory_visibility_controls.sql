begin;
create table public.directory_admins (user_id uuid primary key references auth.users(id));
alter table public.directory_admins enable row level security;
grant select on public.directory_admins to authenticated;
create policy "Read own directory admin membership" on public.directory_admins for select to authenticated using(user_id = (select auth.uid()));
insert into public.directory_admins select id from auth.users where lower(email) = 'mose@mosejames.com';
create table public.directory_settings (
 id boolean primary key default true check(id),
 partner_heading boolean not null default false,
 student_spotlight boolean not null default false,
 student_invitation boolean not null default true,
 house_filter boolean not null default false,
 collaboration boolean not null default true
);
insert into public.directory_settings(id) values(true);
alter table public.directory_settings enable row level security;
grant select on public.directory_settings to anon, authenticated;
grant update on public.directory_settings to authenticated;
create policy "Read directory visibility" on public.directory_settings for select to anon, authenticated using(true);
create policy "Admins manage directory visibility" on public.directory_settings for update to authenticated using(exists(select 1 from public.directory_admins where user_id=(select auth.uid()))) with check(exists(select 1 from public.directory_admins where user_id=(select auth.uid())));
commit;
