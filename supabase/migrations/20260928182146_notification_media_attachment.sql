-- Optional first-party image attachment. Existing notifications remain plain SMS.
alter table public.ue_notifications add column media_url text
  check (media_url is null or media_url ~ '^https://wearercap[.]org/images/[A-Za-z0-9/_-]+[.](jpg|jpeg|png)$');
