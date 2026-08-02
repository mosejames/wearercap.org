-- ---------------------------------------------------------------------------
-- 0036_ties_and_housed_vests.sql — two things that belong to a house.
--
-- The vest carries the house name embroidered on it, so an Amistad family
-- needs an Amistad vest and nothing else will do. I'd read the navy photo on
-- the order page as "one vest for everyone" and marked it house-neutral in
-- 0035 — wrong, and the kind of wrong that quietly hands somebody the wrong
-- house's vest at carline.
--
-- And the tie was missing from the list altogether. Same story: one per house.
--
-- Both are 'coed' — the same garment whichever student wears it — but housed,
-- so the matcher keeps an Amistad tie for an Amistad family and a request for
-- one never gets answered out of a Rêveur bin.
-- ---------------------------------------------------------------------------

alter table public.ue_item_types drop constraint if exists ue_item_types_size_set_check;
alter table public.ue_item_types add constraint ue_item_types_size_set_check
  check (size_set in ('tops', 'girls-tops', 'neckwear', 'girls-bottoms', 'boys-bottoms'));

insert into public.ue_item_types (id, label, gender, housed, hidden, sort, size_set) values
  ('vest', 'Sweater Vest', 'coed', true, false, 30, 'tops'),
  ('tie',  'House Tie',    'coed', true, false, 32, 'neckwear')
on conflict (id) do update set
  label    = excluded.label,
  gender   = excluded.gender,
  housed   = excluded.housed,
  hidden   = excluded.hidden,
  sort     = excluded.sort,
  size_set = excluded.size_set;
