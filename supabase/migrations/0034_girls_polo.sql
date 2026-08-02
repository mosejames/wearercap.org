-- ---------------------------------------------------------------------------
-- 0034_girls_polo.sql — the house polo comes in two cuts.
--
-- We had one "RCA House Polo" on the youth scale (YXS–YXL). It turns out the
-- house polos are sold in a girls' version too, and a girls' top doesn't size
-- like a youth top: Tommy Hilfiger runs girls' tops XXS–XL across sizes 4–16
-- (Big Girls S=7, M=8–10, L=12–14, XL=16) and then straight into juniors.
-- Asking a mother of a 6th-grade girl to translate her daughter into "YM" is
-- asking her to guess.
--
-- So: two item types, each with its own scale, exactly the way khaki pants
-- already split. Nothing already counted moves — the existing `polo` keeps its
-- id and its history, and only its label changes.
-- ---------------------------------------------------------------------------

alter table public.ue_item_types drop constraint if exists ue_item_types_size_set_check;
alter table public.ue_item_types add constraint ue_item_types_size_set_check
  check (size_set in ('tops', 'girls-tops', 'girls-bottoms', 'boys-bottoms'));

-- Same id, same inventory, clearer name.
update public.ue_item_types
set label = 'RCA House Polo · Boys'
where id = 'polo';

insert into public.ue_item_types (id, label, housed, hidden, sort, size_set) values
  ('polo-girls', 'RCA House Polo · Girls', true, false, 12, 'girls-tops')
on conflict (id) do update set
  label = excluded.label, housed = excluded.housed, hidden = excluded.hidden,
  sort = excluded.sort, size_set = excluded.size_set;

-- Boys' polo sits just above it in the list.
update public.ue_item_types set sort = 10 where id = 'polo';
