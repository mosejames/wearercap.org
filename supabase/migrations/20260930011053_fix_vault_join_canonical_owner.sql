-- Return the member's persisted canonical owner after an account recovery.
-- The previous function derived and returned a new owner from auth.uid() even
-- when ON CONFLICT kept the member's older owner. The client then stamped new
-- photos with that derived value while active_owner() correctly returned the
-- persisted one, so every insert failed after the files reached storage.
create or replace function public.vault_join(p_token text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare u auth.users; o text; proposed text; legacy text; linked uuid; reservation record;
begin
 select * into u from auth.users where id=auth.uid();
 if u.id is null or u.phone_confirmed_at is null or nullif(u.phone,'') is null then raise exception 'Verify your mobile number first'; end if;
 proposed:=public.vault_hash(u.id::text);
 insert into vault_private.members(user_id,owner,phone_hash) values(u.id,proposed,public.vault_hash(u.phone))
 on conflict(user_id) do update set phone_hash=excluded.phone_hash
 returning owner into o;
 insert into vault_private.owner_links(owner,user_id) values(o,u.id) on conflict do nothing;
 -- Only a verified phone can claim an administrator-reserved legacy identity.
 for reservation in select * from vault_private.reserved_owners where phone_hash=public.vault_hash(u.phone) for update loop
  insert into vault_private.owner_links(owner,user_id) values(reservation.owner,u.id) on conflict do nothing;
  select user_id into linked from vault_private.owner_links where owner=reservation.owner;
  if linked<>u.id then raise exception 'These uploads are already linked. Contact the house.'; end if;
  insert into public.vault_profiles(owner,display_name,student)
   select o,display_name,student from public.vault_profiles where owner=reservation.owner on conflict do nothing;
  update vault_private.reserved_owners set claimed_by=u.id,claimed_at=coalesce(claimed_at,now()) where owner=reservation.owner;
 end loop;
 -- Possession of the old secret lets a family recover this browser's earlier uploads.
 if length(coalesce(p_token,''))>=16 then
  legacy:=public.vault_hash(p_token);
  if (exists(select 1 from public.vault_profiles where owner=legacy) or exists(select 1 from public.vault_photos where owner=legacy)) and not exists(select 1 from vault_private.reserved_owners r where r.owner=legacy and r.phone_hash<>public.vault_hash(u.phone)) then
   insert into vault_private.owner_links(owner,user_id) values(legacy,u.id) on conflict do nothing;
   select user_id into linked from vault_private.owner_links where owner=legacy;
   if linked=u.id then
    insert into public.vault_profiles(owner,display_name,student)
     select o,display_name,student from public.vault_profiles where owner=legacy on conflict do nothing;
   end if;
  end if;
 end if;
 return jsonb_build_object('owner',o,'owners',(select jsonb_agg(owner) from vault_private.owner_links where user_id=u.id));
end $$;

revoke all on function public.vault_join(text) from public,anon;
grant execute on function public.vault_join(text) to authenticated;
