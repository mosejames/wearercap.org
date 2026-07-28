-- ---------------------------------------------------------------------------
-- 0023_size_sets.sql — pants don't size like polos.
--
-- Girls' bottoms run 7, 8, 10, 12, 14, 16 (plus half sizes). Boys' bottoms run
-- 8 through 20, with slim and husky cuts, and then straight into young men's
-- waist sizes once a kid outgrows 20. Lumping all of that under YS/YM/YL was
-- costing us real matches: a parent looking for "girls 10" and a parent who
-- logged "YM" were describing different clothes.
--
-- Each item type now names the size set it uses, so the size dropdown changes
-- with the item. Sizes stay free text in movements and requests, so nothing
-- already logged breaks.
--
-- Sizing verified against Tommy Hilfiger's kids size guide (Big Boys 8-20,
-- Big Girls 7-16) — RCA bottoms are Hilfiger-only.
-- ---------------------------------------------------------------------------

alter table public.ue_item_types
  add column if not exists size_set text not null default 'tops'
    check (size_set in ('tops', 'girls-bottoms', 'boys-bottoms'));

-- Tops keep the letter sizes; they were fine.
update public.ue_item_types set size_set = 'tops'
where id in ('polo', 'dress-shirt', 'vest', 'sweater', 'house', 'ski', 'other');

-- The generic bottoms step aside for gendered ones. Hidden, not deleted, so
-- anything already logged against them keeps its history.
update public.ue_item_types set hidden = true where id in ('pants', 'shorts', 'bottoms');

update public.ue_item_types set size_set = 'girls-bottoms' where id = 'skirt';

insert into public.ue_item_types (id, label, housed, hidden, sort, size_set) values
  ('pants-girls',  'Khaki Pants · Girls',  false, false, 40, 'girls-bottoms'),
  ('pants-boys',   'Khaki Pants · Boys',   false, false, 42, 'boys-bottoms'),
  ('shorts-girls', 'Khaki Shorts · Girls', false, false, 50, 'girls-bottoms'),
  ('shorts-boys',  'Khaki Shorts · Boys',  false, false, 52, 'boys-bottoms')
on conflict (id) do update set
  label = excluded.label, hidden = excluded.hidden,
  sort = excluded.sort, size_set = excluded.size_set;

update public.ue_item_types set sort = 60 where id = 'skirt';

-- Admin can set the size set when adding or editing a type.
create or replace function public.ue_admin_item_type(
  p_pass text, p_id text,
  p_label text default null, p_housed boolean default null,
  p_hidden boolean default null, p_sort integer default null,
  p_size_set text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pass is distinct from 'rcap2026' then
    raise exception 'Wrong passcode';
  end if;
  insert into public.ue_item_types (id, label, housed, hidden, sort, size_set)
  values (p_id, coalesce(p_label, p_id), coalesce(p_housed, false),
          coalesce(p_hidden, false), coalesce(p_sort, 100), coalesce(p_size_set, 'tops'))
  on conflict (id) do update set
    label    = coalesce(p_label,  ue_item_types.label),
    housed   = coalesce(p_housed, ue_item_types.housed),
    hidden   = coalesce(p_hidden, ue_item_types.hidden),
    sort     = coalesce(p_sort,   ue_item_types.sort),
    size_set = coalesce(p_size_set, ue_item_types.size_set);
end;
$$;

revoke all on function public.ue_admin_item_type(text, text, text, boolean, boolean, integer, text) from public;
grant execute on function public.ue_admin_item_type(text, text, text, boolean, boolean, integer, text) to anon, authenticated;
