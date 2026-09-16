-- Rollback-only verification against the existing test crew, before retirement.
begin;
select set_config('test.group_id', g.id::text, true),
       set_config('test.organizer', g.created_by::text, true)
from public.groups g join public.members m on m.user_id=g.created_by
where g.name='College Park Carpool Crew' and m.email='mose@mosejames.com';
select set_config('test.requester', user_id::text, true), set_config('test.request_id', id::text, true)
from public.join_requests where group_id=current_setting('test.group_id')::uuid and status='pending' order by id limit 1;
insert into public.carpool_retirement_notices(user_id,group_id,group_name)
select r.user_id,g.id,g.name from public.join_requests r join public.groups g on g.id=r.group_id
where g.id=current_setting('test.group_id')::uuid and r.status='pending'
on conflict (user_id,group_id) do nothing;
update public.groups set retired_at=now() where id=current_setting('test.group_id')::uuid;
select set_config('request.jwt.claim.sub',current_setting('test.requester'),true);
set local role authenticated;
do $$
declare n integer;
begin
  select count(*) into n from public.carpool_retirement_notices;
  if n <> 1 then raise exception 'Notice isolation failed: %',n; end if;
  if exists(select 1 from public.groups where id=current_setting('test.group_id')::uuid) then raise exception 'Retired crew still visible'; end if;
  update public.carpool_retirement_notices set dismissed_at=now() where user_id<>auth.uid();
  get diagnostics n=row_count;
  if n<>0 then raise exception 'Cross-family dismissal succeeded'; end if;
  update public.carpool_retirement_notices set dismissed_at=now() where user_id=auth.uid();
  get diagnostics n=row_count;
  if n<>1 then raise exception 'Own dismissal failed'; end if;
  begin
    perform public.request_to_join(current_setting('test.group_id')::uuid);
    raise exception 'TEST FAILED: retired crew accepted a new request';
  exception when others then
    if sqlerrm not like 'This crew has been retired.%' then raise; end if;
  end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.organizer'),true);
do $$
begin
  if exists(select 1 from public.carpool_retirement_notices) then raise exception 'Unaddressed account saw a notice'; end if;
  begin
    perform public.accept_join_request(current_setting('test.request_id')::uuid);
    raise exception 'TEST FAILED: retired crew accepted a member';
  exception when others then
    if sqlerrm not like 'This crew has been retired.%' then raise; end if;
  end;
end $$;
reset role;
rollback;
