-- Treasurer asked (Sept 23, 2026) that rcapfinance@ronclarkacademy.com be removed entirely;
-- the treasurer seat and all notices use lemeri@abc-seniors.com. Applied to production Sept 23.
insert into public.cr_staff(email,name,role) values('lemeri@abc-seniors.com','Latasha Emeri','treasurer')
  on conflict(email) do update set name=excluded.name, role=excluded.role;
update public.cr_requests set approver_email='lemeri@abc-seniors.com', updated_at=now()
  where approver_email='rcapfinance@ronclarkacademy.com';
delete from public.cr_staff where email='rcapfinance@ronclarkacademy.com';
update cr_private.config set notify_to=array_remove(notify_to,'rcapfinance@ronclarkacademy.com') where id;
