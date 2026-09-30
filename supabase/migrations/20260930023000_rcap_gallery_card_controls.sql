alter table public.vault_events
  add column if not exists gallery_cards text[];

alter table public.vault_events
  drop constraint if exists vault_events_gallery_cards_check;

alter table public.vault_events
  add constraint vault_events_gallery_cards_check check (
    gallery_cards is null or gallery_cards <@ array[
      'upload-more-photos',
      'karaoke-feedback',
      'karaoke-sept-27',
      'membership-2026',
      'karaoke-booth-gallery',
      'karaoke-event-gallery',
      'collective',
      'suggestion-box'
    ]::text[]
  );

create or replace function public.vault_admin_save_event(
  p_pass text,
  p_id uuid,
  p jsonb,
  p_house text default 'amistad'
)
returns public.vault_events
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  r public.vault_events;
  selected_cards text[];
begin
  if not public.vault_pass_ok(p_house, p_pass) then raise exception 'Wrong passcode'; end if;

  if p ? 'gallery_cards' then
    select coalesce(array_agg(distinct value), '{}'::text[])
      into selected_cards
      from jsonb_array_elements_text(p->'gallery_cards') as cards(value);
  end if;

  if p_id is null then
    insert into public.vault_events (
      house, slug, title, blurb, kind, starts_on, ends_on, open, featured, hidden, gallery_cards
    ) values (
      p_house, p->>'slug', p->>'title', coalesce(p->>'blurb',''), coalesce(p->>'kind','house'),
      (p->>'starts_on')::date, nullif(p->>'ends_on','')::date,
      coalesce((p->>'open')::boolean, true), coalesce((p->>'featured')::boolean, false),
      coalesce((p->>'hidden')::boolean, false), selected_cards
    ) returning * into r;
  else
    update public.vault_events set
      slug = p->>'slug',
      title = p->>'title',
      blurb = coalesce(p->>'blurb',''),
      kind = coalesce(p->>'kind', kind),
      starts_on = (p->>'starts_on')::date,
      ends_on = nullif(p->>'ends_on','')::date,
      open = coalesce((p->>'open')::boolean, open),
      featured = coalesce((p->>'featured')::boolean, featured),
      hidden = coalesce((p->>'hidden')::boolean, hidden),
      gallery_cards = case when p ? 'gallery_cards' then selected_cards else gallery_cards end
    where id = p_id and house = p_house
    returning * into r;
    if r.id is null then raise exception 'Event not found'; end if;
  end if;

  update public.vault_events set
    category = case when p ? 'category' then nullif(p->>'category','') else category end,
    ongoing = coalesce((p->>'ongoing')::boolean, ongoing)
  where id = r.id
  returning * into r;
  return r;
end
$$;

grant execute on function public.vault_admin_save_event(text,uuid,jsonb,text)
  to anon, authenticated, service_role;
