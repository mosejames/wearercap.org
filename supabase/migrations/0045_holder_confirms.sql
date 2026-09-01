-- ---------------------------------------------------------------------------
-- 0045_holder_confirms.sql — the holder says "I'll be there."
--
-- Until now a family picking a morning got a text that read like a promise —
-- "your handoff is set, Wednesday with Shekita" — when all that had happened
-- was a row changing status. The holder was told, and silence was taken as
-- yes. Defensible (they only ever pick from mornings the holder offered), but
-- a parent standing in a carline can't tell "she's seen it" from "the text
-- went to a phone nobody looked at."
--
-- So: one tap for the holder. It stamps holder_confirmed_at on every item in
-- that bag and texts the family that a person, not a database, confirmed.
-- Nothing is cancelled by silence — the evening before, an unconfirmed
-- handoff earns the holder one reminder, and that's all.
--
-- Two smaller things ride along. A holder moving the day is a confirmation
-- by definition (they picked it), so it stamps too. And a holder moving a
-- student-to-student handoff keeps it student-to-student rather than being
-- silently turned into a carline meeting.
-- ---------------------------------------------------------------------------

alter table public.ue_requests
  add column if not exists holder_confirmed_at timestamptz,
  add column if not exists confirm_nudged_at   timestamptz;

-- Every kind, listed. (0038 dropped one and the digest died for two days.)
alter table public.ue_notifications drop constraint if exists ue_notifications_kind_check;
alter table public.ue_notifications add constraint ue_notifications_kind_check check (kind in
  ('request_received','request_waitlist','ready_at_desk','offer_received',
   'holder_request','holder_offer','handoff_set','handoff_sent','handoff_done',
   'access_link','holder_link','holder_welcome','holder_digest','holder_nudge',
   'handoff_moved','handoff_released','contact_shared',
   'handoff_confirmed','handoff_unconfirmed'));

create or replace function public.ue_notify_subject(p_kind text)
returns text
language sql immutable
as $$
  select case p_kind
    when 'holder_request'      then 'RCAP Uniform Exchange — a request for your bin'
    when 'holder_offer'        then 'RCAP Uniform Exchange — someone has clothes to drop off'
    when 'handoff_set'         then 'RCAP Uniform Exchange — a handoff is set'
    when 'handoff_done'        then 'RCAP Uniform Exchange — an item made it home'
    when 'handoff_unconfirmed' then 'RCAP Uniform Exchange — a handoff is tomorrow morning'
    when 'contact_shared'      then 'RCAP Uniform Exchange — a number was shared with you'
    when 'holder_digest'       then 'RCAP Uniform Exchange — today''s round-up'
    when 'holder_nudge'        then 'RCAP Uniform Exchange — your bin has things waiting'
    else 'RCAP Uniform Exchange'
  end;
$$;

-- ---------------------------------------------------------------------------
-- The tap.
-- ---------------------------------------------------------------------------
create or replace function public.ue_handoff_confirm(p_token text, p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  h public.ue_holders%rowtype;
  r public.ue_requests%rowtype;
  b public.ue_bins%rowtype;
  lbl text; item text; spot text; extra integer; first text;
begin
  select * into h from public.ue_holders where token = p_token;
  if not found then raise exception 'Not your page'; end if;

  select * into r from public.ue_requests where id = p_id;
  if not found then raise exception 'Request not found'; end if;
  select * into b from public.ue_bins where id = r.bin_id;
  if b.holder_id is distinct from h.id then raise exception 'That is not one of your bins'; end if;
  if r.status <> 'scheduled' then raise exception 'Nothing to confirm yet'; end if;
  if r.holder_confirmed_at is not null then return; end if;

  -- The whole bag: everything this family has scheduled with this person for
  -- the same trip.
  update public.ue_requests o set holder_confirmed_at = now()
  from public.ue_bins ob
  where ob.id = o.bin_id
    and ob.holder_id = h.id
    and o.status = 'scheduled'
    and o.holder_confirmed_at is null
    and ue_phone(o.contact) = ue_phone(r.contact)
    and o.handoff_mode is not distinct from r.handoff_mode
    and o.handoff_date is not distinct from r.handoff_date;
  get diagnostics extra = row_count;
  extra := greatest(extra - 1, 0);

  first := split_part(coalesce(nullif(h.name, ''), b.holder_name, 'Your bin holder'), ' ', 1);
  spot  := coalesce(nullif(h.carline_spot, ''), b.carline_spot, '');
  lbl   := ue_slot_label(r.handoff_date, r.handoff_slot, r.handoff_mode);
  item  := trim(ue_type_label(r.item_type) || ' · ' || r.size);
  if extra > 0 then item := item || ' (and ' || extra || ' more of yours)'; end if;

  if ue_phone(r.contact) <> '' then
    insert into ue_notifications (kind, phone, body, request_id)
    values ('handoff_confirmed', ue_phone(r.contact),
      'RCAP Uniform Exchange: ' || first || ' confirmed — your ' || item ||
      case when r.handoff_mode = 'student'
           then ' is coming in with ' || coalesce(nullif(h.student, ''), 'their student') ||
                case when coalesce(r.student, '') <> '' then ' for ' || r.student else '' end || '.'
           else ' handoff is on for ' || lbl ||
                case when spot <> '' then '. Look for ' || spot else '' end || '.' end ||
      ' Tap "Got it" once it''s in your hands: ' || ue_my_url(r.contact),
      r.id);
  end if;
end;
$$;
grant execute on function public.ue_handoff_confirm(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The family picking (or re-picking) a time asks the holder afresh.
-- Same body as 0039 plus the reset.
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
    due_at       = coalesce((p_date + interval '1 day')::timestamptz, now() + interval '3 days'),
    holder_confirmed_at = null,
    confirm_nudged_at   = null
  where id = p_id and status in ('assigned','scheduled')
  returning * into r;
  if not found then raise exception 'Request is not ready to be scheduled'; end if;

  select * into b from public.ue_bins where id = r.bin_id;
  select * into h from public.ue_holders where id = b.holder_id;

  update public.ue_requests o set
    handoff_mode = r.handoff_mode,
    handoff_date = r.handoff_date,
    handoff_slot = r.handoff_slot,
    status       = 'scheduled',
    due_at       = r.due_at,
    holder_confirmed_at = null,
    confirm_nudged_at   = null
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

  -- Honest about what has and hasn't happened: the time is picked; the
  -- person hasn't answered yet.
  if ue_phone(r.contact) <> '' then
    insert into ue_notifications (kind, phone, body, request_id)
    values ('handoff_set', ue_phone(r.contact),
      'RCAP Uniform Exchange: you picked ' || lbl || ' for your ' || item ||
      case when p_mode = 'student' then ', so it''ll come home in a backpack. '
           else ' with ' || hname ||
                case when spot <> '' then ' (' || spot || ')' else '' end || '. ' end ||
      'We''ve asked ' || split_part(hname, ' ', 1) || ' to confirm and will text you when they do. ' ||
      'Your requests: ' || ue_my_url(r.contact),
      r.id);
  end if;

  if b.id is not null then
    perform ue_notify_holder(b.id, 'handoff_set',
      r.parent_name || ' picked a handoff for the ' || item || ' — ' || lbl ||
      case when p_mode = 'student' and coalesce(r.student,'') <> ''
           then '. Send it in with your student for ' || r.student || '.'
           else '.' end ||
      ' Tap "I''ll be there" on your page so they know you''ve seen it.',
      r.id, null);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The holder moving the day. Any school morning now (the page decides what
-- to offer), the mode survives, and the move counts as confirmed.
-- ---------------------------------------------------------------------------
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
  lbl text; item text; mode text;
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
    if p_date <= (now() at time zone 'America/New_York')::date then
      raise exception 'Pick a morning that hasn''t happened yet';
    end if;
    if extract(isodow from p_date) > 5 then
      raise exception 'Handoffs happen on school mornings';
    end if;
    mode := case when r.handoff_mode = 'student' then 'student' else 'carline' end;

    update public.ue_requests o set
      handoff_date = p_date,
      handoff_slot = coalesce(nullif(p_slot, ''), 'am'),
      handoff_mode = mode,
      status       = 'scheduled',
      due_at       = (p_date + interval '1 day')::timestamptz,
      holder_confirmed_at = now()
    from public.ue_bins ob
    where ob.id = o.bin_id
      and ob.holder_id = h.id
      and o.status in ('assigned','scheduled')
      and ue_phone(o.contact) = ue_phone(r.contact);

    lbl := case when mode = 'student'
                then to_char(p_date, 'Dy, Mon FMDD') || ' (in a backpack)'
                else ue_slot_label(p_date, coalesce(nullif(p_slot, ''), 'am'), 'carline') end;
    if ue_phone(r.contact) <> '' then
      insert into ue_notifications (kind, phone, body, request_id)
      values ('handoff_moved', ue_phone(r.contact),
        'RCAP Uniform Exchange: ' || split_part(h.name, ' ', 1) || ' moved your ' ||
        item || ' handoff to ' || lbl || ' and will be there.' ||
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
      due_at       = now() + interval '3 days',
      holder_confirmed_at = null,
      confirm_nudged_at   = null
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

-- ---------------------------------------------------------------------------
-- The evening before, one reminder to a holder who hasn't answered. Runs
-- from the hourly sweeper; does nothing outside 5–9pm Atlanta time, and
-- never twice for the same bag.
-- ---------------------------------------------------------------------------
create or replace function public.ue_nudge_unconfirmed()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_local timestamp := now() at time zone 'America/New_York';
  v_tomorrow date := (v_local::date + 1);
  g record;
  n integer := 0;
begin
  if extract(hour from v_local) < 17 or extract(hour from v_local) >= 21 then return 0; end if;

  for g in
    select b.holder_id, ue_phone(r.contact) as fam, min(r.bin_id) as bin_id,
           min(r.parent_name) as parent_name, count(*) as items,
           min(r.id) as req_id, min(r.handoff_mode) as mode, min(r.handoff_slot) as slot
    from public.ue_requests r
    join public.ue_bins b on b.id = r.bin_id
    where r.status = 'scheduled'
      and r.handoff_date = v_tomorrow
      and r.holder_confirmed_at is null
      and r.confirm_nudged_at is null
      and b.holder_id is not null
    group by b.holder_id, ue_phone(r.contact)
  loop
    perform ue_notify_holder(g.bin_id, 'handoff_unconfirmed',
      g.parent_name || ' is expecting ' ||
      case when g.items = 1 then 'an item' else g.items || ' items' end ||
      ' from you tomorrow — ' || ue_slot_label(v_tomorrow, g.slot, g.mode) ||
      '. Tap "I''ll be there" on your page so they know, or "Change the day" if it doesn''t work.',
      g.req_id, null);

    update public.ue_requests r set confirm_nudged_at = now()
    from public.ue_bins b
    where b.id = r.bin_id and b.holder_id = g.holder_id
      and ue_phone(r.contact) = g.fam
      and r.status = 'scheduled' and r.handoff_date = v_tomorrow;
    n := n + 1;
  end loop;
  return n;
end;
$$;
grant execute on function public.ue_nudge_unconfirmed() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Both pages learn the new state.
-- ---------------------------------------------------------------------------
drop function if exists public.ue_my_requests(text);
create function public.ue_my_requests(p_token text)
returns table (
  id uuid, parent_name text, student text, contact text,
  item_type text, size text, house text, qty integer, note text,
  status text, bin_id uuid, due_at timestamptz,
  handoff_mode text, handoff_date date, handoff_slot text,
  handed_off_at timestamptz, fulfilled_at timestamptz, created_at timestamptz,
  family_shared boolean, holder_shared boolean,
  holder_name text, holder_photo text, holder_spot text,
  holder_student text, holder_phone text,
  holder_confirmed_at timestamptz
)
language plpgsql security definer set search_path = public
as $$
declare v_ph text;
begin
  select a.phone into v_ph from public.ue_access a where a.token = p_token;
  if v_ph is null then return; end if;

  update public.ue_access set last_seen = now() where token = p_token;

  return query
  select r.id, r.parent_name, r.student, r.contact,
         r.item_type, r.size, r.house, r.qty, r.note,
         r.status, r.bin_id, r.due_at,
         r.handoff_mode, r.handoff_date, r.handoff_slot,
         r.handed_off_at, r.fulfilled_at, r.created_at,
         r.family_shared, r.holder_shared,
         coalesce(h.name, b.holder_name, ''),
         coalesce(h.photo_url, ''),
         coalesce(nullif(h.carline_spot, ''), b.carline_spot, ''),
         coalesce(h.student, ''),
         case when r.holder_shared then ue_phone_pretty(coalesce(h.phone, '')) else '' end,
         r.holder_confirmed_at
  from public.ue_requests r
  left join public.ue_bins b on b.id = r.bin_id
  left join public.ue_holders h on h.id = b.holder_id
  where ue_phone(r.contact) = v_ph
  order by r.created_at desc;
end;
$$;
grant execute on function public.ue_my_requests(text) to anon, authenticated;

create or replace function public.ue_holder_home(p_token text)
returns json
language plpgsql security definer set search_path = public
as $$
declare h public.ue_holders%rowtype;
begin
  select * into h from public.ue_holders where token = p_token;
  if not found then return null; end if;

  return json_build_object(
    'holder', json_build_object(
      'id', h.id, 'name', h.name, 'phone', h.phone, 'email', h.email,
      'house', h.house, 'student', h.student, 'note', h.note,
      'offers_carline', h.offers_carline, 'offers_student', h.offers_student,
      'carline_days', h.carline_days, 'carline_when', h.carline_when,
      'carline_spot', h.carline_spot, 'notify_mode', h.notify_mode,
      'special_arrangements', h.special_arrangements, 'special_note', h.special_note,
      'photo_url', h.photo_url, 'max_handoff_days', h.max_handoff_days),

    'bins', coalesce((
      select json_agg(row_to_json(b) order by b.code) from (
        select id, code, name, focus, retired
        from public.ue_bins where holder_id = h.id
      ) b), '[]'::json),

    'inventory', coalesce((
      select json_agg(row_to_json(i)) from (
        select v.bin_id, v.item_type, v.size, v.house, v.qty
        from public.ue_inventory v
        join public.ue_bins bb on bb.id = v.bin_id
        where bb.holder_id = h.id
      ) i), '[]'::json),

    'queue', coalesce((
      select json_agg(row_to_json(q)) from (
        select r.id, r.parent_name, r.student, r.item_type, r.size, r.house,
               r.qty, r.note, r.status, r.bin_id, r.due_at,
               r.handoff_mode, r.handoff_date, r.handoff_slot,
               r.family_shared, r.holder_shared, r.holder_confirmed_at,
               case when r.family_shared then ue_phone_pretty(r.contact) else '' end family_phone
        from public.ue_requests r
        join public.ue_bins bb on bb.id = r.bin_id
        where bb.holder_id = h.id
          and r.status in ('assigned','scheduled','handed_off')
        order by r.due_at nulls last
      ) q), '[]'::json),

    'pickups', coalesce((
      select json_agg(row_to_json(o)) from (
        select f.id, f.parent_name, f.contact, f.house, f.items_desc, f.status, f.bin_id
        from public.ue_offers f
        join public.ue_bins bb on bb.id = f.bin_id
        where bb.holder_id = h.id and f.status in ('open','scheduled')
        order by f.created_at
      ) o), '[]'::json)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- "Handed it off" was the right button with the wrong name for a bag that
-- went into a backpack. The text the family gets now says how it travelled.
-- ---------------------------------------------------------------------------
create or replace function public.ue_handoff_sent(p_id uuid, p_actor text default '')
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.ue_requests%rowtype;
  h public.ue_holders%rowtype;
  how text;
begin
  select * into r from public.ue_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status not in ('assigned','scheduled') then raise exception 'Request is not open for handoff'; end if;

  select h.* into h from public.ue_holders h
  join public.ue_bins b on b.holder_id = h.id where b.id = r.bin_id;

  if not exists (select 1 from public.ue_movements where request_id = r.id) then
    insert into public.ue_movements
      (bin_id, item_type, size, house, qty_delta, kind, actor_name, note, request_id)
    values (r.bin_id, r.item_type, r.size, r.house, -r.qty, 'fulfill',
            coalesce(nullif(btrim(p_actor), ''), r.parent_name),
            'Handed off to ' || r.parent_name, r.id);
  end if;

  update public.ue_requests set status = 'handed_off', handed_off_at = now() where id = p_id;

  how := case
    when r.handoff_mode = 'student' then
      ' went in this morning with ' || coalesce(nullif(h.student, ''), 'their student') ||
      case when coalesce(r.student, '') <> '' then ' for ' || r.student else '' end || '.'
    else ' is on its way (' || ue_slot_label(r.handoff_date, r.handoff_slot, r.handoff_mode) || ').'
  end;

  if ue_phone(r.contact) <> '' then
    insert into ue_notifications (kind, phone, body, request_id)
    values ('handoff_sent', ue_phone(r.contact),
      'RCAP Uniform Exchange: your ' || trim(ue_type_label(r.item_type) || ' · ' || r.size) || how ||
      ' Tap "Got it" when it''s in your hands: ' || ue_my_url(r.contact),
      r.id);
  end if;
end;
$$;
