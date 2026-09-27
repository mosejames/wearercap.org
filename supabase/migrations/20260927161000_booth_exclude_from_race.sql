-- Booth-style contributors sit out the house race.
--
-- A profile flagged exclude_from_race (the OMG Booth account, for example)
-- can upload to RCAP albums without picking a house. Its photos get
-- rca_house = null, which vault_house_board already filters out, so the
-- photos are visible and likable in every album but never move the race.
-- The contributor leaderboard still credits the uploads honestly.

alter table public.vault_profiles
  add column if not exists exclude_from_race boolean not null default false;

create or replace function vault_private.limit_posts()
returns trigger language plpgsql security definer set search_path to '' as $$
declare o text:=vault_private.active_owner(); n bigint; h text; fallback text;
begin
 if o is null or new.owner<>o then raise exception 'Verify your number before contributing'; end if;
 perform pg_advisory_xact_lock(hashtextextended(o,8));
 if tg_table_name='vault_photos' then
  select count(*) into n from public.vault_photos where owner=o and created_at>now()-interval '1 hour';
  if n>=200 then raise exception 'Upload limit reached. Please try again later.'; end if;
  -- The event decides the house, whatever the client sent.
  select e.house into h from public.vault_events e where e.id=new.event_id;
  new.house:=coalesce(h,new.house);
  if new.house='amistad' then new.rca_house:='amistad';
  elsif coalesce((select exclude_from_race from public.vault_profiles where owner=o), false) then
   -- Out of the race: visible in the album, no house stamp.
   new.rca_house:=null;
  else
   new.rca_house:=(select rca_house from public.vault_profiles where owner=o);
   if new.rca_house is null then raise exception 'Choose your RCA house before adding photos'; end if;
  end if;
 else
  select p.house into h from public.vault_photos p where p.id=new.photo_id;
  select count(*) into n from public.vault_comments where owner=o and created_at>now()-interval '1 hour';
  if n>=60 then raise exception 'Please wait before adding more comments'; end if;
 end if;
 new.created_at:=now();
 fallback:=case when coalesce(h,'amistad')='amistad' then 'Amistad family' else 'RCA family' end;
 if tg_table_name='vault_photos' then
  new.uploader_name:=coalesce((select display_name from public.vault_profiles where owner=o),fallback);
 else
  new.author_name:=coalesce((select display_name from public.vault_profiles where owner=o),fallback);
 end if;
 return new;
end $$;
