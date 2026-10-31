begin;
do $$
declare uid uuid; pid uuid; eid uuid; r jsonb; original_hearts bigint; rejected boolean; n bigint;
begin
 select m.user_id into uid from vault_private.members m join auth.users u on u.id=m.user_id
 where u.phone_confirmed_at is not null and nullif(u.phone,'') is not null and m.phone_hash=public.vault_hash(u.phone)
 and not exists(select 1 from vault_private.bans b where b.phone_hash=m.phone_hash) limit 1;
 if uid is null then raise exception 'Verified fixture account required'; end if;
 select p.id,p.event_id into pid,eid from public.vault_photos p join public.vault_events e on e.id=p.event_id
 where p.house='rcap' and not p.hidden and p.removed_at is null and not e.hidden and e.slug not in ('rcap-trunk-or-treat-2026','rcap-trunk-or-treat-photo-booth') limit 1;
 select count(*) into original_hearts from public.vault_likes where photo_id=pid;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 set local role anon;
 perform public.vault_photo_reactions(pid);
 rejected:=false;begin perform public.vault_photo_reactions(pid,'set','celebrate',true);exception when others then rejected:=true;end;
 if not rejected then raise exception 'Guest reaction write allowed'; end if;
 rejected:=false;begin perform count(*) from vault_private.photo_reactions;exception when insufficient_privilege then rejected:=true;end;
 if not rejected then raise exception 'Direct reaction access allowed'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub',uid::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
 set local role authenticated;
 r:=public.vault_photo_reactions(pid,'set','celebrate',true);
 if not exists(select 1 from jsonb_array_elements(r) x where x->>'reaction'='celebrate' and (x->>'mine')::boolean) then raise exception 'Saved reaction missing'; end if;
 select (x->>'count')::bigint into n from jsonb_array_elements(r) x where x->>'reaction'='celebrate';
 r:=public.vault_photo_reactions(pid,'set','celebrate',true);
 if (select (x->>'count')::bigint from jsonb_array_elements(r) x where x->>'reaction'='celebrate')<>n then raise exception 'Retry double-counted'; end if;
 perform public.vault_photo_reactions(pid,'set','thanks',true);perform public.vault_photo_reactions(pid,'set','amazing',true);perform public.vault_photo_reactions(pid,'set','bravo',true);
 r:=public.vault_photo_reactions(pid);
 if (select count(*) from jsonb_array_elements(r) x where (x->>'mine')::boolean)<>4 then raise exception 'Multiple reaction choices failed'; end if;
 r:=public.vault_photo_reactions(pid,'set','celebrate',false);
 if exists(select 1 from jsonb_array_elements(r) x where x->>'reaction'='celebrate' and (x->>'mine')::boolean) then raise exception 'Undo failed'; end if;
 rejected:=false;begin perform public.vault_photo_reactions(pid,'set','unknown',true);exception when others then rejected:=true;end;
 if not rejected then raise exception 'Unsupported reaction accepted'; end if;
 reset role;
 if (select count(*) from public.vault_likes where photo_id=pid)<>original_hearts then raise exception 'Existing hearts changed'; end if;
 update public.vault_photos set hidden=true where id=pid;
 set local role authenticated;
 rejected:=false;begin perform public.vault_photo_reactions(pid,'set','bravo',true);exception when others then rejected:=true;end;
 if not rejected then raise exception 'Hidden photo accepted a reaction'; end if;
 if jsonb_array_length(public.vault_reaction_counts(array[pid]))<>0 then raise exception 'Hidden photo counts leaked'; end if;
 reset role;
 update public.vault_photos set hidden=false where id=pid;update public.vault_events set hidden=true where id=eid;
 set local role authenticated;
 rejected:=false;begin perform public.vault_photo_reactions(pid);exception when others then rejected:=true;end;
 if not rejected then raise exception 'Hidden album reactions leaked'; end if;
 reset role;
end $$;
rollback;
select 'PASS: verified-account writes, guest reads, private records, save/undo/retry, all four extras, hidden photos/albums, and preserved hearts' as verification;
