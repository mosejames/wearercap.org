-- ---------------------------------------------------------------------------
-- 0037_order_limits.sql — how much of one thing, and how many things.
--
-- A family needing a polo and a pair of khakis had to fill the whole form
-- twice. Now they build an order — but a shallow bin empties fast, so it's
-- bounded on both axes:
--
--   per item   a cap on the type. A student wears one vest and one tie, so
--              asking for two of either is asking for somebody else's. Polos
--              go through the wash daily, so two is fair.
--   per order  two different items, enforced in the screen. Send them and
--              come back tomorrow — nothing stops a family asking again.
--
-- The cap lives on the item type so it's the admin's to change, and it's
-- enforced here as well as in the form, because ue_create_request is public.
-- ---------------------------------------------------------------------------

alter table public.ue_item_types
  add column if not exists max_qty integer not null default 1
    check (max_qty between 1 and 5);

update public.ue_item_types set max_qty = 2 where id in ('polo', 'polo-girls');
update public.ue_item_types set max_qty = 1 where id not in ('polo', 'polo-girls');

create or replace function public.ue_create_request(
  p_parent_name text, p_contact text, p_student text,
  p_item_type text, p_size text, p_house text, p_requester_house text,
  p_qty integer, p_note text, p_bin uuid
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  r public.ue_requests%rowtype;
  v_phone text := ue_phone(p_contact);
  v_max integer;
begin
  if btrim(coalesce(p_parent_name, '')) = '' then
    raise exception 'We need your name.';
  end if;
  if btrim(coalesce(p_student, '')) = '' then
    raise exception 'We need your student''s name — that''s who the bin holder is handing it to.';
  end if;
  if v_phone = '' then
    raise exception 'We need a cell number we can text — that''s how you get your item.';
  end if;

  -- Quietly clamp rather than refuse: an over-count is a misunderstanding
  -- about the bins, not something worth throwing a family out of the form for.
  select max_qty into v_max from public.ue_item_types where id = p_item_type;
  v_max := greatest(1, coalesce(v_max, 1));

  insert into public.ue_requests
    (parent_name, contact, student, item_type, size, house, requester_house, qty, note, bin_id)
  values
    (btrim(p_parent_name), v_phone, btrim(p_student),
     p_item_type, p_size, coalesce(p_house, ''), coalesce(p_requester_house, ''),
     greatest(1, least(v_max, coalesce(p_qty, 1))), btrim(coalesce(p_note, '')), p_bin)
  returning * into r;

  return json_build_object(
    'id', r.id, 'status', r.status, 'item_type', r.item_type, 'size', r.size,
    'house', r.house, 'qty', r.qty, 'bin_id', r.bin_id, 'due_at', r.due_at,
    'my_url', ue_my_url(r.contact)
  );
end;
$$;
grant execute on function public.ue_create_request(text, text, text, text, text, text, text, integer, text, uuid) to anon, authenticated;

-- And the admin can move a cap without a deploy.
create or replace function public.ue_admin_item_type(
  p_pass text, p_id text,
  p_label text default null,
  p_housed boolean default null,
  p_hidden boolean default null,
  p_sort integer default null,
  p_size_set text default null,
  p_gender text default null,
  p_max_qty integer default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;
  if btrim(coalesce(p_id, '')) = '' then raise exception 'An id is required'; end if;

  insert into public.ue_item_types (id, label, housed, hidden, sort, size_set, gender, max_qty)
  values (btrim(p_id), coalesce(btrim(p_label), btrim(p_id)), coalesce(p_housed, false),
          coalesce(p_hidden, false), coalesce(p_sort, 100), coalesce(p_size_set, 'tops'),
          coalesce(p_gender, 'coed'), coalesce(p_max_qty, 1))
  on conflict (id) do update set
    label    = coalesce(p_label,  ue_item_types.label),
    housed   = coalesce(p_housed, ue_item_types.housed),
    hidden   = coalesce(p_hidden, ue_item_types.hidden),
    sort     = coalesce(p_sort,   ue_item_types.sort),
    size_set = coalesce(p_size_set, ue_item_types.size_set),
    gender   = coalesce(p_gender, ue_item_types.gender),
    max_qty  = coalesce(p_max_qty, ue_item_types.max_qty);
end;
$$;
grant execute on function public.ue_admin_item_type(text, text, text, boolean, boolean, integer, text, text, integer) to anon, authenticated;
