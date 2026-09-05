create function public.vault_public_badges() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_object_agg(l.owner,b.milestone),'{}'::jsonb) from vault_private.owner_links l join (select user_id,max(milestone) milestone from vault_private.badges group by user_id) b using(user_id) join vault_private.members m using(user_id) where not exists(select 1 from vault_private.bans x where x.phone_hash=m.phone_hash)
$$;
revoke all on function public.vault_public_badges() from public;
grant execute on function public.vault_public_badges() to anon,authenticated;
