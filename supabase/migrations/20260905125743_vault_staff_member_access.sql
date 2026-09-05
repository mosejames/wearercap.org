-- Staff management is available only to authenticated owners.
revoke execute on function public.vault_staff_list(),public.vault_staff_set(uuid,text) from anon,public;
grant execute on function public.vault_staff_list(),public.vault_staff_set(uuid,text) to authenticated;
