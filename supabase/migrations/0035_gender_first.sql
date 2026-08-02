-- ---------------------------------------------------------------------------
-- 0035_gender_first.sql — ask who it's for, then show what they wear.
--
-- Reading the actual RCA order page rather than guessing: a girl at RCA can be
-- wearing one of two polos, one of two pant cuts, a skort, bermuda shorts or an
-- oxford blouse. A boy has one polo, one pant, one short, one oxford shirt. And
-- two pieces — the interlock co-ed polo and the v-neck sweater vest — are the
-- same garment for either, which the old flat list had no way to say.
--
-- So item types carry a gender now, and the screens ask for the student first.
-- A 'coed' type appears on both lists as ONE type: twenty-five counted by a
-- girl's family and twenty-five by a boy's are fifty of one thing, not two
-- piles of twenty-five. That falls out for free — same id, same movement log,
-- same total — which is exactly why it's one type and not a flag on two.
--
-- Nothing already counted moves. Every id that existed still exists and keeps
-- its history; ids only gained a gender and clearer labels.
-- ---------------------------------------------------------------------------

alter table public.ue_item_types
  add column if not exists gender text not null default 'coed';

alter table public.ue_item_types drop constraint if exists ue_item_types_gender_check;
alter table public.ue_item_types add constraint ue_item_types_gender_check
  check (gender in ('girls', 'boys', 'coed'));

-- ---------------------------------------------------------------------------
-- The list as the school actually sells it.
--
--   polo         was "RCA House Polo", the only polo there was — so it is the
--                co-ed interlock, and everything logged against it stays put.
--   polo-girls   added yesterday; becomes the fem fit.
--   dress-shirt  was the white dress shirt; that's the boys' oxford.
--   blouse       new — the girls' long sleeve oxford buttondown.
--   pants-girls  becomes the straight leg (the common one), and bootcut is new.
--   vest         is navy on the order page under a house program, so it is not
--                house-coloured after all.
-- ---------------------------------------------------------------------------
insert into public.ue_item_types (id, label, gender, housed, hidden, sort, size_set) values
  ('polo',             'House Polo · Co-Ed',     'coed',  true,  false, 10, 'tops'),
  ('polo-girls',       'House Polo · Fem Fit',   'girls', true,  false, 12, 'girls-tops'),
  ('blouse',           'Oxford Blouse',          'girls', false, false, 20, 'girls-tops'),
  ('dress-shirt',      'Oxford Shirt',           'boys',  false, false, 22, 'tops'),
  ('vest',             'Sweater Vest',           'coed',  false, false, 30, 'tops'),
  ('pants-girls',      'Khaki Pants · Straight', 'girls', false, false, 40, 'girls-bottoms'),
  ('pants-girls-boot', 'Khaki Pants · Bootcut',  'girls', false, false, 41, 'girls-bottoms'),
  ('shorts-girls',     'Khaki Bermuda Shorts',   'girls', false, false, 50, 'girls-bottoms'),
  ('skirt',            'Pleated Skort',          'girls', false, false, 60, 'girls-bottoms'),
  ('pants-boys',       'Khaki Pants',            'boys',  false, false, 44, 'boys-bottoms'),
  ('shorts-boys',      'Khaki Shorts',           'boys',  false, false, 54, 'boys-bottoms')
on conflict (id) do update set
  label    = excluded.label,
  gender   = excluded.gender,
  housed   = excluded.housed,
  hidden   = excluded.hidden,
  sort     = excluded.sort,
  size_set = excluded.size_set;

-- Anything retired earlier stays retired, and stays out of the way.
update public.ue_item_types set hidden = true
where id in ('pants', 'shorts', 'bottoms', 'sweater', 'cardigan', 'house-apparel');

-- The admin can set a gender when adding or editing a type.
create or replace function public.ue_admin_item_type(
  p_pass text, p_id text,
  p_label text default null,
  p_housed boolean default null,
  p_hidden boolean default null,
  p_sort integer default null,
  p_size_set text default null,
  p_gender text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;
  if btrim(coalesce(p_id, '')) = '' then raise exception 'An id is required'; end if;

  insert into public.ue_item_types (id, label, housed, hidden, sort, size_set, gender)
  values (btrim(p_id), coalesce(btrim(p_label), btrim(p_id)), coalesce(p_housed, false),
          coalesce(p_hidden, false), coalesce(p_sort, 100), coalesce(p_size_set, 'tops'),
          coalesce(p_gender, 'coed'))
  on conflict (id) do update set
    label    = coalesce(p_label,  ue_item_types.label),
    housed   = coalesce(p_housed, ue_item_types.housed),
    hidden   = coalesce(p_hidden, ue_item_types.hidden),
    sort     = coalesce(p_sort,   ue_item_types.sort),
    size_set = coalesce(p_size_set, ue_item_types.size_set),
    gender   = coalesce(p_gender, ue_item_types.gender);
end;
$$;
grant execute on function public.ue_admin_item_type(text, text, text, boolean, boolean, integer, text, text) to anon, authenticated;
