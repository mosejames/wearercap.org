alter table public.vault_events drop constraint vault_events_category_check;
alter table public.vault_events add constraint vault_events_category_check check(category in('everyday','cheers','exp','sports','clubs'));
alter table vault_private.event_suggestions drop constraint event_suggestions_category_check;
alter table vault_private.event_suggestions add constraint event_suggestions_category_check check(category in('everyday','cheers','exp','sports','clubs'));
insert into public.vault_events(house,slug,title,blurb,kind,starts_on,ends_on,category,ongoing,open)
select 'amistad','clubs','Clubs','Creating, learning, and doing what we love together. Share moments from our clubs.','house',starts_on,ends_on,'clubs',true,true
from public.vault_events where kind='everyday' and house='amistad'
and not exists(select 1 from public.vault_events where house='amistad' and slug='clubs')
order by starts_on desc limit 1;
update public.vault_events set hidden=true where house='amistad' and category='exp' and ongoing;
-- Hidden galleries remain available to admins so they can be switched back on.
create function public.vault_additional_galleries(p_pass text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.vault_pass_ok('amistad',p_pass) then raise exception 'Admin access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'hidden',hidden) order by title) from public.vault_events where house='amistad' and ongoing and category<>'everyday'),'[]');
end $$;
create function public.vault_set_gallery_visibility(p_id uuid,p_visible boolean,p_pass text default '') returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.vault_pass_ok('amistad',p_pass) then raise exception 'Admin access required'; end if;
 if p_visible is null then raise exception 'Choose whether to show this gallery'; end if;
 update public.vault_events set hidden=not p_visible where id=p_id and house='amistad' and ongoing and category<>'everyday';
 if not found then raise exception 'Additional gallery not found'; end if;
end $$;
revoke all on function public.vault_additional_galleries(text),public.vault_set_gallery_visibility(uuid,boolean,text) from public;
grant execute on function public.vault_additional_galleries(text),public.vault_set_gallery_visibility(uuid,boolean,text) to anon,authenticated;
