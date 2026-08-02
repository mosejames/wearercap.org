-- ---------------------------------------------------------------------------
-- 0039_one_bag_per_holder.sql — one trip is one person, not one bin.
--
-- 0038 batched a family's items by bin: pick a morning for one thing and
-- everything else of yours in THAT BIN came along. But a holder can carry
-- several bins — Shekita might keep polos in one tub and ties in another — and
-- both of those are the same car at the same window on the same morning.
-- Keyed on the bin, that family got told to come twice for one trip.
--
-- So the unit is the holder. Everything of yours that person is holding moves
-- together, however many tubs it's spread across. Two different holders is
-- still two handoffs, which is honest — that really is two cars.
-- ---------------------------------------------------------------------------

create or replace function public.ue_handoff_schedule(
  p_id uuid, p_mode text, p_date date default null, p_slot text default '',
  p_student text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.ue_requests%rowtype;
  b public.ue_bins%rowtype;
  h public.ue_holders%rowtype;
  lbl text; item text; hname text; spot text; extra integer;
begin
  if p_mode not in ('carline','student','desk') then raise exception 'Unknown handoff mode'; end if;

  update public.ue_requests set
    handoff_mode = p_mode,
    handoff_date = p_date,
    handoff_slot = coalesce(p_slot, ''),
    student      = coalesce(nullif(btrim(p_student), ''), student),
    status       = 'scheduled',
    due_at       = coalesce((p_date + interval '1 day')::timestamptz, now() + interval '3 days')
  where id = p_id and status in ('assigned','scheduled')
  returning * into r;
  if not found then raise exception 'Request is not ready to be scheduled'; end if;

  select * into b from public.ue_bins where id = r.bin_id;
  select * into h from public.ue_holders where id = b.holder_id;

  -- Everything else this family is waiting on from THIS PERSON rides along,
  -- whichever of their tubs it happens to be sitting in.
  update public.ue_requests o set
    handoff_mode = r.handoff_mode,
    handoff_date = r.handoff_date,
    handoff_slot = r.handoff_slot,
    status       = 'scheduled',
    due_at       = r.due_at
  from public.ue_bins ob
  where ob.id = o.bin_id
    and o.id <> r.id
    and ob.holder_id = b.holder_id
    and b.holder_id is not null
    and o.status = 'assigned'
    and ue_phone(o.contact) = ue_phone(r.contact)
    and ue_phone(r.contact) <> '';
  get diagnostics extra = row_count;

  hname := coalesce(nullif(h.name, ''), nullif(b.holder_name, ''), 'your bin holder');
  spot  := coalesce(nullif(h.carline_spot, ''), b.carline_spot, '');
  lbl   := ue_slot_label(r.handoff_date, r.handoff_slot, r.handoff_mode);
  item  := trim(ue_type_label(r.item_type) || ' · ' || r.size);
  if extra > 0 then
    item := item || ' (and ' || extra || ' more of yours)';
  end if;

  if ue_phone(r.contact) <> '' then
    insert into ue_notifications (kind, phone, body, request_id)
    values ('handoff_set', ue_phone(r.contact),
      'RCAP Uniform Exchange: your ' || item || ' handoff is set — ' || lbl ||
      case when p_mode = 'student' then ', so it''ll come home in a backpack. '
           else ' with ' || hname ||
                case when spot <> '' then ' (' || spot || ')' else '' end || '. ' end ||
      'Tap "Got it" once it''s in your hands: ' || ue_my_url(r.contact),
      r.id);
  end if;

  if b.id is not null then
    perform ue_notify_holder(b.id, 'handoff_set',
      r.parent_name || ' picked a handoff for the ' || item || ' — ' || lbl ||
      case when p_mode = 'student' and coalesce(r.student,'') <> ''
           then '. Send it in with your student for ' || r.student || '.'
           else '.' end,
      r.id, null);
  end if;
end;
$$;
grant execute on function public.ue_handoff_schedule(uuid, text, date, text, text) to anon, authenticated;

-- Moving or handing back travels the same way: it was one trip, so it all
-- moves or it all comes back.
create or replace function public.ue_handoff_reschedule(
  p_token text, p_id uuid, p_date date default null,
  p_slot text default 'am', p_note text default ''
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  h public.ue_holders%rowtype;
  r public.ue_requests%rowtype;
  b public.ue_bins%rowtype;
  note text := btrim(coalesce(p_note, ''));
  lbl text; item text;
begin
  select * into h from public.ue_holders where token = p_token;
  if not found then raise exception 'Not your page'; end if;

  select * into r from public.ue_requests where id = p_id;
  if not found then raise exception 'Request not found'; end if;
  select * into b from public.ue_bins where id = r.bin_id;
  if b.holder_id is distinct from h.id then raise exception 'That is not one of your bins'; end if;
  if r.status not in ('assigned','scheduled') then
    raise exception 'That handoff has already happened';
  end if;

  item := trim(ue_type_label(r.item_type) || ' · ' || r.size);

  if p_date is not null then
    update public.ue_requests o set
      handoff_date = p_date,
      handoff_slot = coalesce(nullif(p_slot, ''), 'am'),
      handoff_mode = 'carline',
      status       = 'scheduled',
      due_at       = (p_date + interval '1 day')::timestamptz
    from public.ue_bins ob
    where ob.id = o.bin_id
      and ob.holder_id = h.id
      and o.status in ('assigned','scheduled')
      and ue_phone(o.contact) = ue_phone(r.contact);

    lbl := ue_slot_label(p_date, coalesce(nullif(p_slot, ''), 'am'), 'carline');
    if ue_phone(r.contact) <> '' then
      insert into ue_notifications (kind, phone, body, request_id)
      values ('handoff_moved', ue_phone(r.contact),
        'RCAP Uniform Exchange: ' || split_part(h.name, ' ', 1) || ' had to move your ' ||
        item || ' handoff to ' || lbl || '.' ||
        case when note <> '' then ' "' || note || '"' else '' end ||
        ' If that doesn''t work, pick another morning here: ' || ue_my_url(r.contact),
        r.id);
    end if;
  else
    update public.ue_requests o set
      handoff_mode = null,
      handoff_date = null,
      handoff_slot = '',
      status       = 'assigned',
      due_at       = now() + interval '3 days'
    from public.ue_bins ob
    where ob.id = o.bin_id
      and ob.holder_id = h.id
      and o.status in ('assigned','scheduled')
      and ue_phone(o.contact) = ue_phone(r.contact);

    if ue_phone(r.contact) <> '' then
      insert into ue_notifications (kind, phone, body, request_id)
      values ('handoff_released', ue_phone(r.contact),
        'RCAP Uniform Exchange: ' || split_part(h.name, ' ', 1) ||
        ' can''t make the morning you picked for your ' || item || '.' ||
        case when note <> '' then ' "' || note || '"' else '' end ||
        ' Your item is still held for you — pick another morning here: ' || ue_my_url(r.contact),
        r.id);
    end if;
  end if;
end;
$$;
grant execute on function public.ue_handoff_reschedule(text, uuid, date, text, text) to anon, authenticated;
