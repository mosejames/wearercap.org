-- ---------------------------------------------------------------------------
-- 0047_carline_off_autoclose.sql — backpacks only, and "Got it" closes itself.
--
-- Carline meetups are switched off site-wide (Storage Room → Settings), the
-- same way the front desk is. The bin holders' students carry every bag.
-- Holders' carline availability stays in the table for when that changes.
--
-- And six requests had been sitting in handed_off since early August because
-- nobody taps "Got it." A bag that left a holder's hands four days ago and
-- hasn't been moved, disputed or cancelled is done; say so.
-- ---------------------------------------------------------------------------

insert into public.ue_settings (key, value) values ('carline_enabled', 'false')
on conflict (key) do nothing;

create or replace function public.ue_autoclose_handoffs()
returns integer
language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  update public.ue_requests
  set status = 'fulfilled', fulfilled_at = now()
  where status = 'handed_off'
    and coalesce(handed_off_at, due_at, created_at) < now() - interval '4 days';
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.ue_autoclose_handoffs() to anon, authenticated;

-- Close out the ones already sitting there.
select public.ue_autoclose_handoffs();
