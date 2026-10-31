alter table vault_private.photo_reactions drop constraint photo_reactions_reaction_check;
alter table vault_private.photo_reactions add constraint photo_reactions_reaction_check check(reaction in ('celebrate','thanks','amazing','bravo','spooky','costume','fun'));

create or replace function vault_private.photo_reactions_api(p_photo uuid,p_action text,p_reaction text,p_active boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare event_slug text;
begin
 if not exists(select 1 from public.vault_photos p join public.vault_events e on e.id=p.event_id
   where p.id=p_photo and p.house='rcap' and e.house='rcap' and not p.hidden and p.removed_at is null and not e.hidden) then
  raise exception 'This photo is unavailable';
 end if;
 select e.slug into event_slug from public.vault_photos p join public.vault_events e on e.id=p.event_id where p.id=p_photo;
 if p_action='set' then
  if auth.uid() is null or vault_private.active_owner() is null then raise exception 'Sign in to leave a reaction'; end if;
  if p_reaction is null or p_reaction not in ('love','celebrate','thanks','amazing','bravo','spooky','costume','fun') or p_active is null then raise exception 'Choose a positive reaction'; end if;
  -- Love always uses existing vault_likes, just like the viewer's original
  -- onLike handler. It is deliberately not a new extra-reaction row.
  if p_reaction='love' then
   if p_active then
    if not exists(select 1 from public.vault_likes where photo_id=p_photo and vault_private.owns(owner)) then
     insert into public.vault_likes(photo_id,owner) values(p_photo,vault_private.active_owner()) on conflict do nothing;
    end if;
   else
    delete from public.vault_likes where photo_id=p_photo and vault_private.owns(owner);
   end if;
  else
  if event_slug in ('rcap-trunk-or-treat-2026','rcap-trunk-or-treat-photo-booth') then
   if p_reaction not in ('spooky','costume','fun','thanks') then raise exception 'Choose a Trunk or Treat reaction'; end if;
  elsif p_reaction in ('spooky','costume','fun') then raise exception 'Choose a reaction for this gallery'; end if;
  insert into vault_private.photo_reactions(photo_id,actor,reaction,active) values(p_photo,auth.uid(),p_reaction,p_active)
  on conflict(photo_id,actor,reaction) do update set active=excluded.active,updated_at=now();
  end if;
 elsif p_action is distinct from 'read' then raise exception 'Unknown reaction action';
 end if;
 return coalesce((select jsonb_agg(to_jsonb(t) order by t.reaction) from
  (select reaction,count(*) as count,bool_or(actor=auth.uid()) as mine from vault_private.photo_reactions where photo_id=p_photo and active group by reaction)t),'[]'::jsonb);
end $$;
