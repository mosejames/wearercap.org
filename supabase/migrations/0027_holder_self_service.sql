-- ---------------------------------------------------------------------------
-- 0027_holder_self_service.sql — a holder runs their own settings.
--
--   * They can fix their own cell and email. Nobody should have to email the
--     admin to change a phone number.
--   * They choose how they hear from us: every request as it lands, or one
--     round-up at the end of the day. Volunteers who get pinged all afternoon
--     stop reading the pings.
--   * They can say they're open to arranging a time outside morning carline —
--     which deliberately shares their cell with that one family, because the
--     app is stepping out of the way for that case.
--   * And they can get back in on their own: type your cell on the Storage
--     Room door and we text your page.
-- ---------------------------------------------------------------------------

alter table public.ue_holders
  add column if not exists notify_mode text not null default 'instant'
    check (notify_mode in ('instant', 'daily')),
  add column if not exists special_arrangements boolean not null default false,
  add column if not exists special_note text not null default ''
    check (length(special_note) <= 200);

-- A held message waits until its time; null means send it now.
alter table public.ue_notifications
  add column if not exists deliver_after timestamptz;

create index if not exists ue_notifications_due_idx
  on public.ue_notifications (status, deliver_after);

alter table public.ue_requests drop constraint if exists ue_requests_handoff_mode_check;
alter table public.ue_requests add constraint ue_requests_handoff_mode_check
  check (handoff_mode in ('', 'carline', 'student', 'desk', 'other'));

alter table public.ue_notifications drop constraint if exists ue_notifications_kind_check;
alter table public.ue_notifications add constraint ue_notifications_kind_check check (kind in
  ('request_received','request_waitlist','ready_at_desk','offer_received',
   'holder_request','holder_offer','handoff_set','handoff_sent','handoff_done',
   'access_link','holder_link','holder_welcome','holder_digest'));

-- ---------------------------------------------------------------------------
-- Hold a message until the end of the day for holders who asked for that.
-- ---------------------------------------------------------------------------
create or replace function public.ue_end_of_day()
returns timestamptz
language plpgsql stable
as $$
declare
  v_local timestamp := now() at time zone 'America/New_York';
  v_target timestamp := date_trunc('day', v_local) + interval '17 hours';
begin
  if v_target <= v_local then v_target := v_target + interval '1 day'; end if;
  return v_target at time zone 'America/New_York';
end;
$$;

create or replace function public.ue_notify_holder(
  p_bin uuid, p_kind text, p_body_after text, p_request uuid, p_offer uuid
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  b public.ue_bins%rowtype;
  h public.ue_holders%rowtype;
  ph text;
  hold timestamptz;
begin
  select * into b from public.ue_bins where id = p_bin;
  if not found then return; end if;
  select * into h from public.ue_holders where id = b.holder_id;

  ph := ue_phone(coalesce(nullif(h.phone, ''), b.holder_phone));
  if ph = '' then return; end if;

  -- End-of-day people get their messages parked; the sweeper rolls them into
  -- one round-up when the time comes.
  if coalesce(h.notify_mode, 'instant') = 'daily' then
    hold := ue_end_of_day();
  end if;

  insert into ue_notifications (kind, phone, body, request_id, offer_id, deliver_after)
  values (p_kind, ph,
    'RCAP Uniform Exchange (' || b.code || '): ' || p_body_after ||
    ' Your bin page: https://wearercap.org/uniform-exchange/#/bin/' || b.code,
    p_request, p_offer, hold);
end;
$$;

-- Only send straight away if it isn't being held.
create or replace function public.ue_dispatch_notification()
returns trigger
language plpgsql security definer set search_path = public, private, extensions
as $$
declare v_url text; v_secret text;
begin
  if new.status <> 'pending' then return new; end if;
  if new.deliver_after is not null and new.deliver_after > now() then return new; end if;

  select value into v_url    from private.config where key = 'notify_url';
  select value into v_secret from private.config where key = 'notify_secret';
  if v_url is null then return new; end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-ue-secret', coalesce(v_secret, '')),
    body    := jsonb_build_object('id', new.id),
    timeout_milliseconds := 4000
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Roll the day's held messages into one text per person.
-- ---------------------------------------------------------------------------
create or replace function public.ue_send_digests()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_sent integer := 0;
  v_lines text;
  v_count integer;
begin
  for r in
    select phone, array_agg(id) as ids, count(*) as n
    from public.ue_notifications
    where status = 'pending' and deliver_after is not null and deliver_after <= now()
    group by phone
  loop
    select count(*), string_agg('• ' || regexp_replace(
             regexp_replace(body, '^RCAP Uniform Exchange \(', '', 'g'),
             '\s*Your bin page:.*$', '', 'g'), E'\n')
      into v_count, v_lines
    from public.ue_notifications
    where id = any(r.ids);

    insert into public.ue_notifications (kind, phone, body)
    values ('holder_digest', r.phone,
      'RCAP Uniform Exchange — today''s round-up (' || v_count || ' update' ||
      case when v_count = 1 then '' else 's' end || '):' || E'\n' || v_lines || E'\n' ||
      'Open your page: https://wearercap.org/uniform-exchange/#/requests');

    update public.ue_notifications
    set status = 'skipped', detail = 'rolled into the daily round-up', sent_at = now()
    where id = any(r.ids);

    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;
grant execute on function public.ue_send_digests() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- A holder editing their own details.
-- ---------------------------------------------------------------------------
create or replace function public.ue_holder_update_self(
  p_token text,
  p_phone text default null, p_email text default null,
  p_notify_mode text default null,
  p_special boolean default null, p_special_note text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare h_id uuid;
begin
  select id into h_id from public.ue_holders where token = p_token;
  if h_id is null then raise exception 'Not your page'; end if;
  if p_notify_mode is not null and p_notify_mode not in ('instant','daily') then
    raise exception 'Unknown notification setting';
  end if;

  update public.ue_holders set
    phone = coalesce(btrim(p_phone), phone),
    email = coalesce(btrim(p_email), email),
    notify_mode = coalesce(p_notify_mode, notify_mode),
    special_arrangements = coalesce(p_special, special_arrangements),
    special_note = coalesce(btrim(p_special_note), special_note)
  where id = h_id;
end;
$$;
grant execute on function public.ue_holder_update_self(text, text, text, text, boolean, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The holder door: type your cell, we text your page. Says nothing about
-- whether that number is a holder, and won't pester.
-- ---------------------------------------------------------------------------
create or replace function public.ue_holder_request_link(p_phone text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  h public.ue_holders%rowtype;
  v_ph text := ue_phone(p_phone);
begin
  if v_ph = '' then return; end if;
  select * into h from public.ue_holders
  where ue_phone(phone) = v_ph and active is not false
  limit 1;
  if not found then return; end if;

  if exists (
    select 1 from public.ue_notifications
    where phone = v_ph and kind = 'holder_link' and created_at > now() - interval '10 minutes'
  ) then return; end if;

  insert into public.ue_notifications (kind, phone, body)
  values ('holder_link', v_ph,
    'RCAP Uniform Exchange: here''s your bin holder page — your bins, anything queued ' ||
    'to you, and where you update your counts: ' ||
    'https://wearercap.org/uniform-exchange/#/holder/' || h.token ||
    ' (just for you; no password needed)');
end;
$$;
grant execute on function public.ue_holder_request_link(text) to anon, authenticated;

-- The holder page needs the new settings.
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
      'carline_spot', h.carline_spot,
      'availability_set_at', h.availability_set_at,
      'notify_mode', h.notify_mode,
      'special_arrangements', h.special_arrangements,
      'special_note', h.special_note),

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
               r.handoff_mode, r.handoff_date, r.handoff_slot
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
grant execute on function public.ue_holder_home(text) to anon, authenticated;

-- Bins carry the holder's special-arrangement offer so the handoff sheet can
-- show it. (holder_id is already on the bin; this is read through ue_bins.)
grant select (id, name, house, student, note, offers_carline, offers_student,
              carline_days, carline_when, carline_spot, active, created_at,
              special_arrangements, special_note)
  on public.ue_holders to anon, authenticated;

create or replace function public.ue_slot_label(p_date date, p_slot text, p_mode text)
returns text
language sql immutable
as $$
  select case
    when p_mode = 'student' then 'student to student'
    when p_mode = 'other' then 'a time you two arranged'
    when p_date is null then 'a time to be picked'
    else to_char(p_date, 'Dy, Mon FMDD') ||
         case p_slot when 'pm' then ' afternoon carline'
                     else ' morning carline' end
  end;
$$;
