create table public.london_accounts (
 user_id uuid primary key references auth.users(id),
 sharing_token text not null unique default encode(extensions.gen_random_bytes(32),'hex'),
 created_at timestamptz not null default now()
);
alter table public.london_accounts enable row level security;
revoke all on public.london_accounts from anon,authenticated;
create or replace function public.london_claim_account(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); t text; old_owner text; new_owner text; n text; g text;
begin
 if u is null then raise exception 'Please sign in first'; end if;
 if length(coalesce(p_token,''))<32 then raise exception 'Invalid browser identity'; end if;
 if exists(select 1 from public.london_accounts where sharing_token=p_token and user_id<>u) then raise exception 'This browser belongs to another signed-in account'; end if;
 insert into public.london_accounts(user_id) values(u) on conflict do nothing;
 select sharing_token into t from public.london_accounts where user_id=u for update;
 old_owner:=public.m3_hash(p_token);new_owner:=public.m3_hash(t);
 select display_name,team into n,g from public.m3_profiles where owner=new_owner and vault='london-2028';
 if n is null then
  select display_name,team into n,g from public.m3_profiles where owner=old_owner and vault='london-2028';
  if n is not null then insert into public.m3_profiles(owner,vault,display_name,team) values(new_owner,'london-2028',n,coalesce(g,'')) on conflict do nothing; end if;
 end if;
 if old_owner<>new_owner then
  update public.m3_photos set owner=new_owner,uploader_name=coalesce(n,uploader_name) where owner=old_owner and vault='london-2028';
  update public.m3_comments c set owner=new_owner from public.m3_photos p where c.photo_id=p.id and p.vault='london-2028' and c.owner=old_owner;
  insert into public.m3_likes(photo_id,owner) select l.photo_id,new_owner from public.m3_likes l join public.m3_photos p on p.id=l.photo_id where l.owner=old_owner and p.vault='london-2028' on conflict do nothing;
  delete from public.m3_likes l using public.m3_photos p where l.photo_id=p.id and p.vault='london-2028' and l.owner=old_owner;
  insert into public.london_reactions select photo_id,new_owner,reaction from public.london_reactions where owner=old_owner on conflict do nothing;
  delete from public.london_reactions where owner=old_owner;
 end if;
 return jsonb_build_object('token',t,'name',n,'group',coalesce(g,''));
end $$;
revoke all on function public.london_claim_account(text) from public;
grant execute on function public.london_claim_account(text) to authenticated;

create or replace function public.london_save_profile(p_token text, p_name text, p_group text default '')
returns public.m3_people language plpgsql security definer set search_path = '' as $$
declare o text := public.m3_hash(p_token); r public.m3_people;
begin
  if length(coalesce(p_token,'')) < 16 then raise exception 'Bad token'; end if;
  if length(btrim(coalesce(p_name,''))) = 0 then raise exception 'Name required'; end if;
  insert into public.m3_profiles (owner, vault, display_name, team)
  values (o, 'london-2028', left(btrim(p_name),60), left(btrim(coalesce(p_group,'')),40))
  on conflict (owner) do update set display_name = excluded.display_name, team = excluded.team, updated_at = now()
  where public.m3_profiles.vault = 'london-2028';
  if not found then raise exception 'Please use a London sharing profile'; end if;
  update public.m3_photos set uploader_name=left(btrim(p_name),60) where owner=o and vault='london-2028';
  update public.m3_comments c set author_name=left(btrim(p_name),60) from public.m3_photos p where c.photo_id=p.id and p.vault='london-2028' and c.owner=o;
  select * into r from public.m3_people where owner = o and vault = 'london-2028';
  return r;
end $$;
revoke all on function public.london_save_profile(text,text,text) from public;
grant execute on function public.london_save_profile(text,text,text) to anon, authenticated;
create or replace function public.london_verified_owner()
returns text language sql stable security definer set search_path='' as $$
 select public.m3_hash(sharing_token) from public.london_accounts where user_id=auth.uid();
$$;
revoke all on function public.london_verified_owner() from public;
grant execute on function public.london_verified_owner() to authenticated;
