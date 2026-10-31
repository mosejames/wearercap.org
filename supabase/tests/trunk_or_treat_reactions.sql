begin;
do $$
declare uid uuid; pid uuid; r jsonb; n bigint; rejected boolean; tested integer:=0;
begin
 select m.user_id into uid from vault_private.members m join auth.users u on u.id=m.user_id
 where u.phone_confirmed_at is not null and nullif(u.phone,'') is not null and m.phone_hash=public.vault_hash(u.phone)
 and not exists(select 1 from vault_private.bans b where b.phone_hash=m.phone_hash) limit 1;
 perform set_config('request.jwt.claim.sub',uid::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
 for pid in select p.id from public.vault_events e cross join lateral (select id from public.vault_photos where event_id=e.id and not hidden and removed_at is null limit 1)p
 where e.house='rcap' and not e.hidden and e.slug in ('rcap-trunk-or-treat-2026','rcap-trunk-or-treat-photo-booth') loop
  tested:=tested+1;
  set local role authenticated;
  perform public.vault_photo_reactions(pid,'set','spooky',true);
  perform public.vault_photo_reactions(pid,'set','costume',true);
  perform public.vault_photo_reactions(pid,'set','fun',true);
  r:=public.vault_photo_reactions(pid,'set','thanks',true);
  if (select count(*) from jsonb_array_elements(r) x where (x->>'mine')::boolean)<>4 then raise exception 'The four contextual reactions did not save'; end if;
  rejected:=false;begin perform public.vault_photo_reactions(pid,'set','bravo',true);exception when others then rejected:=true;end;
  if not rejected then raise exception 'Noncontextual reaction accepted'; end if;
  perform public.vault_photo_reactions(pid,'set','love',true);
  select count(*) into n from public.vault_likes where photo_id=pid;
  perform public.vault_photo_reactions(pid,'set','love',true);
  if (select count(*) from public.vault_likes where photo_id=pid)<>n then raise exception 'Love duplicated a heart'; end if;
  perform public.vault_photo_reactions(pid,'set','love',false);
  if exists(select 1 from public.vault_likes where photo_id=pid and vault_private.owns(owner)) then raise exception 'Love undo failed'; end if;
  r:=public.vault_photo_reactions(pid,'set','spooky',false);
  if exists(select 1 from jsonb_array_elements(r) x where x->>'reaction'='spooky' and (x->>'mine')::boolean) then raise exception 'Spooky undo failed'; end if;
  reset role;
 end loop;
 if tested<>2 then raise exception 'Both Trunk or Treat galleries must be verified'; end if;
end $$;
rollback;
select 'PASS: both Trunk or Treat albums support Love, Spooky, Great costume, So much fun, Thank you and undo' as verification;
