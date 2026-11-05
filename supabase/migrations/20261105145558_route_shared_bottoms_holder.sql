-- One shared bottoms bin. Its responsibility follows the bin when reassigned.
create unique index if not exists ue_one_shared_bottoms_bin
  on public.ue_bins (focus) where focus = 'Bottoms only' and not retired;

create or replace function public.ue_sync_bottoms_holder()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.ue_item_types set request_holder_id = (
    select b.holder_id from public.ue_bins b
    where b.focus = 'Bottoms only' and not b.retired limit 1
  ) where size_set in ('girls-bottoms', 'boys-bottoms')
    or id in ('pants', 'shorts', 'bottoms', 'skirt');
  return new;
end;
$$;
revoke all on function public.ue_sync_bottoms_holder() from public, anon, authenticated;
create trigger ue_sync_bottoms_holder
  after insert or update of holder_id, focus, retired on public.ue_bins
  for each row execute function public.ue_sync_bottoms_holder();
-- Refresh the routing for an already configured shared bin.
update public.ue_bins set focus = 'Bottoms only'
where name = 'Bottoms' and not retired;

-- The shared holder does not also receive every request for their own house.
create or replace function public.ue_alert_request_holders()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  owner_id uuid;
  target record;
  request_house text := coalesce(nullif(new.house, ''), new.requester_house, '');
  item text := ue_type_label(new.item_type) || ' · ' || new.size;
  message text;
begin
  select request_holder_id into owner_id from ue_item_types where id = new.item_type;
  if new.status <> 'open' and owner_id is null then return new; end if;
  if new.status not in ('open', 'assigned') then return new; end if;

  if new.status = 'open' then
    message := 'Someone just requested something that is not in our inventory: ' ||
      new.qty || ' ' || item ||
      case when new.house <> '' then ' (' || ue_house_label(new.house) || ')' else '' end ||
      '. Requested by ' || new.parent_name || '. The request is waitlisted.';
  else
    message := 'Someone just requested ' || new.qty || ' ' || item ||
      '. Requested by ' || new.parent_name || '. It is assigned to a bin.';
  end if;

  -- One alert per active person, even if they manage several bins.
  for target in
    select distinct on (h.id) h.id holder_id, b.id bin_id
    from public.ue_holders h join public.ue_bins b on b.holder_id = h.id
    where h.active and not b.retired
      and (owner_id is not null or b.focus <> 'Bottoms only')
      and ((owner_id is not null and h.id = owner_id)
        or (owner_id is null and request_house <> '' and h.house = request_house))
      -- Assigned requests already notify their actual bin holder.
      and not (new.status = 'assigned' and exists (
        select 1 from public.ue_bins assigned
        where assigned.id = new.bin_id and assigned.holder_id = h.id))
    order by h.id, b.code
  loop
    perform public.ue_notify_holder(target.bin_id, 'holder_request', message, new.id, null);
  end loop;
  return new;
end;
$$;
revoke all on function public.ue_alert_request_holders() from public, anon, authenticated;
