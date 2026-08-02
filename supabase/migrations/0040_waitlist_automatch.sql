-- ---------------------------------------------------------------------------
-- 0040_waitlist_automatch.sql — the waitlist picks itself up.
--
-- A family asks for a polo and a pair of khakis. Shekita has the polo, nobody
-- has the khakis. That splits, correctly: the polo is assigned to Shekita and
-- she's told about it; the khakis sit `open` with no bin and the family is told
-- they're on the list. Neither waits on the other, and Shekita is never asked
-- about khakis she doesn't have.
--
-- The hole was the other end. When khakis DID turn up in somebody's bin,
-- nothing happened. That request sat there until a human noticed — which, on a
-- Tuesday in October, means it sat there. A family who was told "we'll text you
-- the moment one turns up" was relying on me remembering.
--
-- So: counting something in now looks at the waitlist. Oldest request first,
-- only what's genuinely free after everything already promised out of that bin,
-- and it goes through ue_assign_request so both sides get the same texts they'd
-- get if a human had done it.
-- ---------------------------------------------------------------------------

create or replace function public.ue_match_waitlist(p_bin uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_free integer;
  v_matched integer := 0;
begin
  if p_bin is null then return 0; end if;

  -- Longest wait first. A family that asked in August shouldn't lose a polo to
  -- one that asked this morning.
  for r in
    select q.id, q.item_type, q.size, q.house, q.qty
    from public.ue_requests q
    where q.status = 'open' and q.bin_id is null
    order by q.created_at
  loop
    -- What this bin actually holds of that exact thing...
    select coalesce(sum(m.qty_delta), 0) into v_free
    from public.ue_movements m
    where m.bin_id = p_bin
      and m.item_type = r.item_type
      and m.size = r.size
      and coalesce(m.house, '') = coalesce(r.house, '');

    -- ...minus everything already promised out of it and not yet handed over.
    v_free := v_free - coalesce((
      select sum(o.qty) from public.ue_requests o
      where o.bin_id = p_bin
        and o.status in ('assigned', 'scheduled', 'handed_off')
        and o.item_type = r.item_type
        and o.size = r.size
        and coalesce(o.house, '') = coalesce(r.house, '')
    ), 0);

    if v_free >= r.qty then
      -- Same path a human would take, so the same two texts go out.
      perform ue_assign_request(r.id, p_bin);
      v_matched := v_matched + 1;
    end if;
  end loop;

  return v_matched;
end;
$$;
grant execute on function public.ue_match_waitlist(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Anything added to a bin gets checked against the waitlist. Only additions —
-- taking something out can't answer a request, and a correction downward
-- certainly can't.
-- ---------------------------------------------------------------------------
create or replace function public.ue_movement_matches_waitlist()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.qty_delta > 0 then
    perform ue_match_waitlist(new.bin_id);
  end if;
  return new;
end;
$$;

drop trigger if exists ue_movements_automatch on public.ue_movements;
create trigger ue_movements_automatch
  after insert on public.ue_movements
  for each row execute function public.ue_movement_matches_waitlist();

-- A bin that already had stock sitting in it while someone waited: sweep once
-- now, so nothing is stranded by the fact that this arrived late.
do $$
declare b record;
begin
  for b in select id from public.ue_bins where not retired loop
    perform ue_match_waitlist(b.id);
  end loop;
end;
$$;
