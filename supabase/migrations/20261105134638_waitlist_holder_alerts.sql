-- Khaki responsibility is independent of the family's house and recorded stock.
alter table public.ue_item_types add column request_holder_id uuid
  references public.ue_holders(id) on delete set null;

update public.ue_item_types set request_holder_id = (
  select id from public.ue_holders where name = 'Shekita James' and active
) where id in ('pants', 'pants-boys', 'pants-girls', 'pants-girls-boot',
  'shorts', 'shorts-boys', 'shorts-girls', 'skirt', 'bottoms');

do $$ begin
  if exists (select 1 from public.ue_item_types
    where id = 'pants-boys' and request_holder_id is null) then
    raise exception 'An active khaki holder must be configured';
  end if;
end $$;

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
create trigger ue_alert_request_holders after insert on public.ue_requests
for each row execute function public.ue_alert_request_holders();
