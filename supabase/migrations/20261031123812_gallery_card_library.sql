-- Custom cards are data, not a growing list of allowed names in source code.
create table vault_private.gallery_cards (
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 1 and 120),
 eyebrow text not null default '' check(length(eyebrow)<=80),
 body text not null default '' check(length(body)<=600),
 cta text not null check(length(trim(cta)) between 1 and 60),
 href text not null,
 image text not null default '',
 status text not null default 'draft' check(status in ('draft','published','archived')),
 starts_on date,
 ends_on date,
 event_ids uuid[] not null default '{}',
 priority integer not null default 0 check(priority between 0 and 999),
 legacy_key text unique,
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 check(ends_on is null or starts_on is null or ends_on>=starts_on)
);
alter table vault_private.gallery_cards enable row level security;
revoke all on vault_private.gallery_cards from public,anon,authenticated;

create function vault_private.gallery_card_url_ok(v text) returns boolean
language sql immutable set search_path='' as $$
 select v is not null and length(v) between 1 and 2000
 and v !~ '[[:space:]\\]'
 and (v ~ '^/($|[^/\\])' or v ~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#].*)?$')
$$;
alter table vault_private.gallery_cards add constraint gallery_cards_link_check check(vault_private.gallery_card_url_ok(href));
alter table vault_private.gallery_cards add constraint gallery_cards_image_check check(image='' or vault_private.gallery_card_url_ok(image));

-- Anonymous visitors can read only currently published cards for a visible RCAP
-- album. Every management action uses the existing verified-owner/passcode gate.
create function vault_private.gallery_cards_api(p_action text,p_payload jsonb,p_pass text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c vault_private.gallery_cards; v jsonb:=p_payload; ids uuid[]; rid uuid;
 today date := (now() at time zone 'America/New_York')::date;
begin
 if p_action='for_event' then
  if not exists(select 1 from public.vault_events where id=(v->>'event')::uuid and house='rcap' and not hidden) then
   return jsonb_build_object('cards','[]'::jsonb,'legacy_keys','[]'::jsonb);
  end if;
  return jsonb_build_object(
   'cards',coalesce((select jsonb_agg(to_jsonb(t)-'event_ids'-'legacy_key'-'revision'-'updated_at' order by t.priority,t.updated_at,t.id)
    from vault_private.gallery_cards t where (v->>'event')::uuid=any(t.event_ids) and t.status='published'
    and (t.starts_on is null or t.starts_on<=today) and (t.ends_on is null or t.ends_on>=today)),'[]'::jsonb),
   'legacy_keys',coalesce((select jsonb_agg(legacy_key) from vault_private.gallery_cards where legacy_key is not null),'[]'::jsonb));
 end if;
 if not public.vault_pass_ok('rcap',coalesce(p_pass,'')) then raise exception 'Admin access required'; end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.updated_at desc,t.id) from vault_private.gallery_cards t),'[]'::jsonb);
 elsif p_action='save' then
  if v->>'id' is not null then
   rid:=(v->>'id')::uuid;
   select * into c from vault_private.gallery_cards where id=rid for update;
   if not found then raise exception 'Card not found'; end if;
   if (v->>'revision')::integer is distinct from c.revision then raise exception 'This card changed. Close the editor and refresh before saving.'; end if;
  else rid:=gen_random_uuid(); end if;
  select coalesce(array_agg(distinct x::uuid),'{}'::uuid[]) into ids from jsonb_array_elements_text(coalesce(v->'event_ids','[]'::jsonb)) x;
  if cardinality(ids)>500 or exists(select 1 from unnest(ids) x where not exists(select 1 from public.vault_events e where e.id=x and e.house='rcap')) then raise exception 'Choose RCAP galleries only'; end if;
  if v->>'status'='published' and cardinality(ids)=0 then raise exception 'Choose at least one gallery before publishing'; end if;
  if coalesce(v->>'title','') ~ '—' or coalesce(v->>'body','') ~ '—' or coalesce(v->>'eyebrow','') ~ '—' or coalesce(v->>'cta','') ~ '—' then raise exception 'Please use a comma or sentence break instead of an em dash'; end if;
  insert into vault_private.gallery_cards(id,title,eyebrow,body,cta,href,image,status,starts_on,ends_on,event_ids,priority)
  values(rid,trim(v->>'title'),trim(coalesce(v->>'eyebrow','')),trim(coalesce(v->>'body','')),trim(v->>'cta'),trim(v->>'href'),trim(coalesce(v->>'image','')),v->>'status',nullif(v->>'starts_on','')::date,nullif(v->>'ends_on','')::date,ids,coalesce((v->>'priority')::integer,0))
  on conflict(id) do update set title=excluded.title,eyebrow=excluded.eyebrow,body=excluded.body,cta=excluded.cta,href=excluded.href,image=excluded.image,status=excluded.status,starts_on=excluded.starts_on,ends_on=excluded.ends_on,event_ids=excluded.event_ids,priority=excluded.priority,revision=gallery_cards.revision+1,updated_at=now()
  returning * into c;
  return to_jsonb(c);
 end if;
 raise exception 'Unknown card action';
end $$;
revoke all on function vault_private.gallery_card_url_ok(text) from public;
revoke all on function vault_private.gallery_cards_api(text,jsonb,text) from public;
grant usage on schema vault_private to anon,authenticated;
grant execute on function vault_private.gallery_cards_api(text,jsonb,text) to anon,authenticated;
create function public.vault_gallery_cards(p_action text,p_payload jsonb default '{}',p_pass text default '')
returns jsonb language sql security invoker set search_path='' as $$
 select vault_private.gallery_cards_api(p_action,p_payload,p_pass)
$$;
revoke all on function public.vault_gallery_cards(text,jsonb,text) from public;
grant execute on function public.vault_gallery_cards(text,jsonb,text) to anon,authenticated;

-- Move the two newest cards into the editable library without duplicating them.
insert into vault_private.gallery_cards(title,eyebrow,body,cta,href,status,ends_on,event_ids,legacy_key)
select 'A little GOAL. A big possibility.','Supporting RCA students','Learn how Georgia GOAL supports financial aid at RCA through a state tax credit. RCA signup deadline: December 18.','Learn about Georgia GOAL','/georgia-goal/','published','2026-12-18',array_agg(id),'georgia-goal'
from public.vault_events where house='rcap' and 'georgia-goal'=any(gallery_cards) having count(*)>0;
insert into vault_private.gallery_cards(title,eyebrow,body,cta,href,status,event_ids,legacy_key)
select 'Costumes. Cameras. Big smiles.','More Trunk or Treat memories','Your photo booth moments are in the Capsule too. Find your family’s poses and keep the fun going.','See the photo booth photos','/rcap-capsule/#/e/rcap-trunk-or-treat-photo-booth','published',array_agg(id),'trunk-booth-gallery'
from public.vault_events where house='rcap' and 'trunk-booth-gallery'=any(gallery_cards) having count(*)>0;
