-- A booth excluded from the race may reserve uploads without a house.
-- Keep all existing verified-account, album, duplicate and rate-limit gates.
create or replace function public.vault_reserve_uploads(p_slug text, p_ids uuid[], p_house text default 'amistad'::text)
returns void language plpgsql security definer set search_path to '' as $function$
declare ev public.vault_events; n int;
begin
 if vault_private.active_owner() is null then raise exception 'This account cannot upload'; end if;
 n:=coalesce(array_length(p_ids,1),0);
 if n<1 or n>40 then raise exception 'Select between 1 and 40 files per batch'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,9));
 if (select count(*) from vault_private.upload_slots where user_id=auth.uid() and created_at>now()-interval '1 hour')+n>200 then raise exception 'Upload limit reached. Please try again later.'; end if;
 select * into ev from public.vault_events where slug=p_slug and house=p_house and open and not hidden;
 if ev.id is null then raise exception 'This album is not accepting uploads'; end if;
 if p_house<>'amistad'
   and (select rca_house from public.vault_profiles where owner=vault_private.active_owner()) is null
   and not coalesce((select exclude_from_race from public.vault_profiles where owner=vault_private.active_owner()),false)
 then raise exception 'Choose your RCA house before adding photos'; end if;
 if exists(select 1 from public.vault_photos where id=any(p_ids)) then raise exception 'An upload with this ID already exists'; end if;
 insert into vault_private.upload_slots(id,user_id,event_id,slug) select unnest(p_ids),auth.uid(),ev.id,ev.slug;
end $function$;
