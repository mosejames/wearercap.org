-- ---------------------------------------------------------------------------
-- 0014_exchange_houses.sql — Uniforms are broken up by houses.
-- An item in the exchange is really type + size + house: an Isibindi polo
-- only helps an Isibindi family. House-neutral items (white dress shirts,
-- Hilfiger bottoms, ski gear) use the empty string, shown as "Any house".
-- ---------------------------------------------------------------------------

alter table public.ue_movements
  add column if not exists house text not null default ''
    check (house in ('', 'altruismo','amistad','isibindi','reveur'));

alter table public.ue_requests
  add column if not exists house text not null default ''
    check (house in ('', 'altruismo','amistad','isibindi','reveur'));

drop index if exists ue_movements_item_idx;
create index if not exists ue_movements_item_idx
  on public.ue_movements (item_type, size, house);

-- Inventory now groups by house as well. Postgres can't reorder a view's
-- columns in place, so drop and recreate.
drop view if exists public.ue_inventory;
create view public.ue_inventory as
  select bin_id, item_type, size, house, sum(qty_delta)::int as qty
  from public.ue_movements
  group by bin_id, item_type, size, house;

-- Fulfillment carries the request's house into the outgoing movement.
create or replace function public.ue_fulfill_request(p_id uuid, p_actor text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.ue_requests%rowtype;
begin
  select * into r from public.ue_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'assigned' then raise exception 'Request is not open for fulfillment'; end if;
  if r.bin_id is null then raise exception 'Request has no bin'; end if;

  insert into public.ue_movements (bin_id, item_type, size, house, qty_delta, kind, actor_name, note, request_id)
  values (r.bin_id, r.item_type, r.size, r.house, -r.qty, 'fulfill',
          coalesce(nullif(btrim(p_actor), ''), r.parent_name),
          'Delivered to front desk for ' || r.parent_name, r.id);

  update public.ue_requests
  set status = 'fulfilled', fulfilled_at = now()
  where id = p_id;
end;
$$;
