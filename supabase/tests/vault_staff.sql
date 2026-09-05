begin;
do $$
declare u uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); a uuid:=gen_random_uuid();
begin
 insert into auth.users(id,phone,phone_confirmed_at) values(u,'15550008701',now()),(v,'15550008702',now()),(a,'15550008703',now());
 perform set_config('request.jwt.claim.sub',u::text,true); perform public.vault_join(''); perform public.vault_save_member_profile('Staff owner fixture','',false);
 insert into vault_private.staff values(u,'owner',now());
 perform set_config('request.jwt.claim.sub',v::text,true); perform public.vault_join(''); perform public.vault_save_member_profile('Moderator fixture','',false);
 perform set_config('request.jwt.claim.sub',a::text,true); perform public.vault_join(''); perform public.vault_save_member_profile('Admin fixture','',false);
 begin perform public.vault_staff_set(a,'admin'); raise exception 'Contributor granted access'; exception when others then if sqlerrm='Contributor granted access' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',u::text,true); perform public.vault_staff_set(v,'moderator'); perform public.vault_staff_set(a,'admin');
 begin perform public.vault_staff_set(u,null); raise exception 'Owner removed'; exception when others then if sqlerrm='Owner removed' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',v::text,true);
 if not public.vault_moderation_ok('amistad','') or public.vault_pass_ok('amistad','') then raise exception 'Moderator privileges wrong'; end if;
 perform public.vault_review_reports(''); perform public.vault_banned_members('');
 begin perform public.vault_staff_set(a,'moderator'); raise exception 'Moderator changed staff'; exception when others then if sqlerrm='Moderator changed staff' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',a::text,true);
 if not public.vault_pass_ok('amistad','') then raise exception 'Admin denied'; end if;
 begin perform public.vault_staff_list(); raise exception 'Admin managed roles'; exception when others then if sqlerrm='Admin managed roles' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',u::text,true); perform public.vault_staff_set(a,null);
 perform set_config('request.jwt.claim.sub',a::text,true);
 if public.vault_pass_ok('amistad','') then raise exception 'Revoked admin retained access'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 if public.vault_staff_role() is not null then raise exception 'Anonymous role'; end if;
 begin perform public.vault_staff_list(); raise exception 'Anonymous staff list'; exception when others then if sqlerrm='Anonymous staff list' then raise; end if; end;
end $$;
rollback;
