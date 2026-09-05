-- Release announcements are a separate, voluntary choice from sign-in texts.
alter table vault_private.members add column release_opt_in boolean not null default false;
create table vault_private.release_consent (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id), opted_in boolean not null,
 wording text not null default 'Text me about future Vault releases.',
 recorded_at timestamptz not null default now()
);
alter table vault_private.release_consent enable row level security;
create function public.vault_release_preference() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select release_opt_in from vault_private.members where user_id=auth.uid()),false)
$$;
create function public.vault_save_member_profile(p_name text,p_student text,p_release_opt_in boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.vault_people; old_choice boolean;
begin
 if auth.uid() is null or vault_private.active_owner() is null then raise exception 'Verify your mobile number to continue'; end if;
 select release_opt_in into old_choice from vault_private.members where user_id=auth.uid() for update;
 select * into p from public.vault_save_profile('',p_name,p_student,'');
 if old_choice is distinct from coalesce(p_release_opt_in,false) or not exists(select 1 from vault_private.release_consent where user_id=auth.uid()) then
  insert into vault_private.release_consent(user_id,opted_in) values(auth.uid(),coalesce(p_release_opt_in,false));
 end if;
 update vault_private.members set release_opt_in=coalesce(p_release_opt_in,false) where user_id=auth.uid();
 return to_jsonb(p)||jsonb_build_object('release_opt_in',coalesce(p_release_opt_in,false));
end $$;
revoke all on function public.vault_release_preference(),public.vault_save_member_profile(text,text,boolean) from public;
grant execute on function public.vault_release_preference(),public.vault_save_member_profile(text,text,boolean) to authenticated;
