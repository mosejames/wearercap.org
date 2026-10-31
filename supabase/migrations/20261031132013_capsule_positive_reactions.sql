-- Hearts stay in vault_likes, preserving existing counts and leaderboard rules.
-- Extra positive reactions never expose contributor identities or award points.
create table vault_private.photo_reactions (
 photo_id uuid not null references public.vault_photos(id) on delete cascade,
 actor uuid not null references auth.users(id) on delete cascade,
 reaction text not null check(reaction in ('celebrate','thanks','amazing','bravo')),
 active boolean not null default true,
 updated_at timestamptz not null default now(),
 primary key(photo_id,actor,reaction)
);
alter table vault_private.photo_reactions enable row level security;
revoke all on vault_private.photo_reactions from public,anon,authenticated;

create function vault_private.photo_reactions_api(p_photo uuid,p_action text,p_reaction text,p_active boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.vault_photos p join public.vault_events e on e.id=p.event_id
   where p.id=p_photo and p.house='rcap' and e.house='rcap' and not p.hidden and p.removed_at is null and not e.hidden) then
  raise exception 'This photo is unavailable';
 end if;
 if p_action='set' then
  if auth.uid() is null or vault_private.active_owner() is null then raise exception 'Sign in to leave a reaction'; end if;
  if p_reaction is null or p_reaction not in ('celebrate','thanks','amazing','bravo') or p_active is null then raise exception 'Choose a positive reaction'; end if;
  insert into vault_private.photo_reactions(photo_id,actor,reaction,active) values(p_photo,auth.uid(),p_reaction,p_active)
  on conflict(photo_id,actor,reaction) do update set active=excluded.active,updated_at=now();
 elsif p_action is distinct from 'read' then raise exception 'Unknown reaction action';
 end if;
 return coalesce((select jsonb_agg(to_jsonb(t) order by t.reaction) from
  (select reaction,count(*) as count,bool_or(actor=auth.uid()) as mine from vault_private.photo_reactions where photo_id=p_photo and active group by reaction)t),'[]'::jsonb);
end $$;
create function public.vault_photo_reactions(p_photo uuid,p_action text default 'read',p_reaction text default '',p_active boolean default true)
returns jsonb language sql security invoker set search_path='' as $$
 select vault_private.photo_reactions_api(p_photo,p_action,p_reaction,p_active)
$$;
create function vault_private.reaction_counts(p_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if cardinality(p_ids)>500 then raise exception 'Request up to 500 photos at a time'; end if;
 return coalesce((select jsonb_agg(to_jsonb(t)) from (
 select r.photo_id,r.reaction,count(*) as count from vault_private.photo_reactions r
 join public.vault_photos p on p.id=r.photo_id join public.vault_events e on e.id=p.event_id
 where r.photo_id=any(p_ids) and r.active and p.house='rcap' and e.house='rcap' and not p.hidden and p.removed_at is null and not e.hidden
 group by r.photo_id,r.reaction)t),'[]'::jsonb);
end $$;
create function public.vault_reaction_counts(p_ids uuid[]) returns jsonb
language sql security invoker set search_path='' as $$select vault_private.reaction_counts(p_ids)$$;
revoke all on function vault_private.photo_reactions_api(uuid,text,text,boolean),vault_private.reaction_counts(uuid[]) from public;
revoke all on function public.vault_photo_reactions(uuid,text,text,boolean),public.vault_reaction_counts(uuid[]) from public;
grant usage on schema vault_private to anon,authenticated;
grant execute on function vault_private.photo_reactions_api(uuid,text,text,boolean),vault_private.reaction_counts(uuid[]) to anon,authenticated;
grant execute on function public.vault_photo_reactions(uuid,text,text,boolean),public.vault_reaction_counts(uuid[]) to anon,authenticated;
