-- One-time, user-authorized retirement. Deploy the notice UI before running.
-- Retains crew, memberships, requests, and profiles. No emails or new memberships.
begin;
lock table public.groups, public.join_requests, public.memberships in share row exclusive mode;
do $$
declare target public.groups%rowtype; n integer;
begin
  select g.* into strict target from public.groups g
  join public.members m on m.user_id=g.created_by
  where g.name='College Park Carpool Crew' and m.email='mose@mosejames.com';
  if target.retired_at is not null then raise exception 'Crew already retired'; end if;
  if exists(select 1 from public.memberships where group_id=target.id and user_id<>target.created_by) then
    raise exception 'Crew has other members; stop for review';
  end if;
  select count(*) into n from public.join_requests where group_id=target.id and status='pending';
  if n<>2 then raise exception 'Expected two waiting requests, found %; stop for review',n; end if;
  if exists(select 1 from public.join_requests r left join public.members m on m.user_id=r.user_id
    where r.group_id=target.id and r.status='pending' and
    (m.approval is distinct from 'approved' or m.can_organize is distinct from true)) then
    raise exception 'Requester permissions changed; stop for review';
  end if;
  insert into public.carpool_retirement_notices(user_id,group_id,group_name)
    select user_id,target.id,target.name from public.join_requests
    where group_id=target.id and status='pending';
  update public.join_requests set status='retired',decided_at=now()
    where group_id=target.id and status='pending';
  update public.groups set retired_at=now() where id=target.id;
end $$;
commit;
