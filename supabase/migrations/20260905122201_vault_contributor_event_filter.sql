-- Public gallery metadata only; private identity links never leave this function.
create function public.vault_contributor_gallery_filtered(p_owner text, p_offset integer default 0, p_event uuid default null)
returns jsonb language sql stable security definer set search_path='' as $$
with target as (
 select coalesce(m.owner,p.owner) owner
 from public.vault_profiles p left join vault_private.owner_links l on l.owner=p.owner
 left join vault_private.members m on m.user_id=l.user_id
 where p.owner=p_owner and p.house='amistad'
 and not exists(select 1 from vault_private.bans b where b.phone_hash=m.phone_hash)
), visible as (
 select p.id,p.created_at,p.event_id from public.vault_photos p
 join public.vault_events e on e.id=p.event_id
 left join vault_private.owner_links l on l.owner=p.owner
 left join vault_private.members m on m.user_id=l.user_id
 where coalesce(m.owner,p.owner)=(select owner from target)
 and p.house='amistad' and not p.hidden and p.removed_at is null and not e.hidden
 and not exists(select 1 from vault_private.bans b where b.phone_hash=m.phone_hash)
), filtered as (select * from visible where p_event is null or event_id=p_event), page as (
 select id,created_at from filtered order by created_at desc,id limit 60 offset greatest(coalesce(p_offset,0),0)
)
select jsonb_build_object('owner',t.owner,'name',p.display_name,'total',(select count(*) from filtered), 'events',(select coalesce(jsonb_agg(distinct event_id),'[]'::jsonb) from visible),
 'ids',coalesce((select jsonb_agg(id order by created_at desc,id) from page),'[]'::jsonb))
from target t join public.vault_profiles p on p.owner=t.owner
$$;
revoke all on function public.vault_contributor_gallery_filtered(text,integer,uuid) from public,anon,authenticated;
grant execute on function public.vault_contributor_gallery_filtered(text,integer,uuid) to anon,authenticated;
