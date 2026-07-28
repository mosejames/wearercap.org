-- ---------------------------------------------------------------------------
-- 0018_handoff.sql — how the item actually changes hands.
-- RCA wants to stay hands-off, so the front desk is no longer the default
-- route. Instead the two families meet where they already are every day:
-- carline. The holder sets standing availability ONCE on their bin; each
-- requester picks a concrete date from it. Or the whole thing rides in a
-- backpack, student to student, which needs no adults in the same place.
--
-- Completion is the REQUESTER tapping "Got it" — receipt is the only signal
-- that means it truly landed.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Site settings — front desk stays built but switched off.
-- ---------------------------------------------------------------------------
create table if not exists public.ue_settings (
  key   text primary key,
  value text not null default ''
);

alter table public.ue_settings enable row level security;
drop policy if exists ue_settings_read on public.ue_settings;
create policy ue_settings_read on public.ue_settings for select using (true);

insert into public.ue_settings (key, value)
values ('front_desk_enabled', 'false')
on conflict (key) do nothing;

create or replace function public.ue_admin_setting(p_pass text, p_key text, p_value text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;
  insert into public.ue_settings (key, value) values (p_key, p_value)
  on conflict (key) do update set value = excluded.value;
end;
$$;
revoke all on function public.ue_admin_setting(text, text, text) from public;
grant execute on function public.ue_admin_setting(text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Holder availability, set once, lives on the bin.
-- carline_days: ISO weekdays 1=Mon … 5=Fri.
-- ---------------------------------------------------------------------------
alter table public.ue_bins
  add column if not exists offers_carline boolean not null default true,
  add column if not exists offers_student boolean not null default true,
  add column if not exists carline_days   integer[] not null default '{1,2,3,4,5}',
  add column if not exists carline_when   text not null default 'pm'
    check (carline_when in ('am','pm','both')),
  add column if not exists carline_spot   text not null default ''
    check (length(carline_spot) <= 120),
  add column if not exists holder_student text not null default ''
    check (length(holder_student) <= 80);

-- The holder edits their own availability from their bin page — no passcode,
-- same trust model as the rest of the site. Deliberately narrow: this
-- function can ONLY touch availability fields, never the holder's identity.
create or replace function public.ue_bin_availability(
  p_id uuid,
  p_offers_carline boolean default null, p_offers_student boolean default null,
  p_days integer[] default null, p_when text default null,
  p_spot text default null, p_holder_student text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.ue_bins set
    offers_carline = coalesce(p_offers_carline, offers_carline),
    offers_student = coalesce(p_offers_student, offers_student),
    carline_days   = coalesce(p_days, carline_days),
    carline_when   = coalesce(p_when, carline_when),
    carline_spot   = coalesce(p_spot, carline_spot),
    holder_student = coalesce(p_holder_student, holder_student)
  where id = p_id;
  if not found then raise exception 'Bin not found'; end if;
end;
$$;
revoke all on function public.ue_bin_availability(uuid, boolean, boolean, integer[], text, text, text) from public;
grant execute on function public.ue_bin_availability(uuid, boolean, boolean, integer[], text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Requests grow a handoff plan.
-- ---------------------------------------------------------------------------
alter table public.ue_requests
  add column if not exists handoff_mode text not null default ''
    check (handoff_mode in ('', 'carline', 'student', 'desk')),
  add column if not exists handoff_date date,
  add column if not exists handoff_slot text not null default ''
    check (handoff_slot in ('', 'am', 'pm')),
  add column if not exists handed_off_at timestamptz;

alter table public.ue_requests drop constraint if exists ue_requests_status_check;
alter table public.ue_requests add constraint ue_requests_status_check
  check (status in ('open','assigned','scheduled','handed_off','fulfilled','canceled'));

create or replace function public.ue_slot_label(p_date date, p_slot text, p_mode text)
returns text
language sql immutable
as $$
  select case
    when p_mode = 'student' then 'student to student'
    when p_date is null then 'a time to be picked'
    else to_char(p_date, 'Dy, Mon FMDD') ||
         case p_slot when 'am' then ' morning carline'
                     when 'pm' then ' afternoon carline'
                     else '' end
  end;
$$;

-- ---------------------------------------------------------------------------
-- 1. The requester picks a slot (or student-to-student).
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
  lbl text;
  item text;
begin
  if p_mode not in ('carline','student','desk') then raise exception 'Unknown handoff mode'; end if;

  update public.ue_requests set
    handoff_mode = p_mode,
    handoff_date = p_date,
    handoff_slot = coalesce(p_slot, ''),
    student      = coalesce(nullif(btrim(p_student), ''), student),
    status       = 'scheduled',
    -- the deadline is now the day you two agreed, plus a day of grace
    due_at       = coalesce((p_date + interval '1 day')::timestamptz, now() + interval '3 days')
  where id = p_id and status in ('assigned','scheduled')
  returning * into r;
  if not found then raise exception 'Request is not ready to be scheduled'; end if;

  select * into b from public.ue_bins where id = r.bin_id;
  lbl := ue_slot_label(r.handoff_date, r.handoff_slot, r.handoff_mode);
  item := trim(ue_type_label(r.item_type) || ' · ' || r.size);

  -- the requester
  if ue_phone(r.contact) <> '' then
    insert into ue_notifications (kind, phone, body, request_id)
    values ('handoff_set', ue_phone(r.contact),
      'RCAP Uniform Exchange: your ' || item || ' handoff is set — ' || lbl ||
      case when p_mode = 'student' then
        ', so it''ll come home in a backpack. '
      else
        ' with ' || coalesce(nullif(b.holder_name,''), 'your bin holder') ||
        case when coalesce(b.carline_spot,'') <> '' then ' (' || b.carline_spot || ')' else '' end || '. '
      end ||
      'Tap "Got it" once it''s in your hands: https://wearercap.org/uniform-exchange/#/requests',
      r.id);
  end if;

  -- the holder
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

-- ---------------------------------------------------------------------------
-- 2. The holder hands it over. The item physically leaves the bin here, so
--    this is where the movement logs.
-- ---------------------------------------------------------------------------
create or replace function public.ue_handoff_sent(p_id uuid, p_actor text default '')
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.ue_requests%rowtype;
begin
  select * into r from public.ue_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status not in ('assigned','scheduled') then raise exception 'Request is not open for handoff'; end if;

  if not exists (select 1 from public.ue_movements where request_id = r.id) then
    insert into public.ue_movements
      (bin_id, item_type, size, house, qty_delta, kind, actor_name, note, request_id)
    values (r.bin_id, r.item_type, r.size, r.house, -r.qty, 'fulfill',
            coalesce(nullif(btrim(p_actor), ''), r.parent_name),
            'Handed off to ' || r.parent_name, r.id);
  end if;

  update public.ue_requests
  set status = 'handed_off', handed_off_at = now()
  where id = p_id;

  if ue_phone(r.contact) <> '' then
    insert into ue_notifications (kind, phone, body, request_id)
    values ('handoff_sent', ue_phone(r.contact),
      'RCAP Uniform Exchange: your ' || trim(ue_type_label(r.item_type) || ' · ' || r.size) ||
      ' is on its way (' || ue_slot_label(r.handoff_date, r.handoff_slot, r.handoff_mode) ||
      '). Tap "Got it" when it''s in your hands: https://wearercap.org/uniform-exchange/#/requests',
      r.id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The requester confirms receipt. THIS is what closes the loop.
-- ---------------------------------------------------------------------------
create or replace function public.ue_handoff_received(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.ue_requests%rowtype;
begin
  select * into r from public.ue_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status = 'fulfilled' then return; end if;
  if r.status not in ('assigned','scheduled','handed_off') then
    raise exception 'Request is not open';
  end if;

  if not exists (select 1 from public.ue_movements where request_id = r.id) then
    insert into public.ue_movements
      (bin_id, item_type, size, house, qty_delta, kind, actor_name, note, request_id)
    values (r.bin_id, r.item_type, r.size, r.house, -r.qty, 'fulfill',
            r.parent_name, 'Received by ' || r.parent_name, r.id);
  end if;

  update public.ue_requests
  set status = 'fulfilled', fulfilled_at = now()
  where id = p_id;

  if r.bin_id is not null then
    perform ue_notify_holder(r.bin_id, 'handoff_done',
      r.parent_name || ' confirmed they got the ' ||
      trim(ue_type_label(r.item_type) || ' · ' || r.size) || '. Thank you! 💚',
      r.id, null);
  end if;
end;
$$;

alter table public.ue_notifications drop constraint if exists ue_notifications_kind_check;
alter table public.ue_notifications add constraint ue_notifications_kind_check check (kind in
  ('request_received','request_waitlist','ready_at_desk','offer_received',
   'holder_request','holder_offer','handoff_set','handoff_sent','handoff_done'));

revoke all on function public.ue_handoff_schedule(uuid, text, date, text, text) from public;
revoke all on function public.ue_handoff_sent(uuid, text) from public;
revoke all on function public.ue_handoff_received(uuid) from public;
grant execute on function public.ue_handoff_schedule(uuid, text, date, text, text) to anon, authenticated;
grant execute on function public.ue_handoff_sent(uuid, text) to anon, authenticated;
grant execute on function public.ue_handoff_received(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The "we got your request" text now points at picking a time, not the desk.
-- ---------------------------------------------------------------------------
create or replace function public.ue_notify_request()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  ph text := ue_phone(new.contact);
  item text := trim(ue_type_label(new.item_type) || ' ' ||
               case when new.house <> '' then '(' || ue_house_label(new.house) || ') ' else '' end ||
               '· ' || new.size);
  hn text := '';
begin
  if new.bin_id is not null then
    select coalesce(holder_name,'') into hn from public.ue_bins where id = new.bin_id;
  end if;

  if ph <> '' then
    if new.status = 'assigned' then
      insert into ue_notifications (kind, phone, body, request_id)
      values ('request_received', ph,
        'RCAP Uniform Exchange: we found your ' || item ||
        case when hn <> '' then ' — ' || hn || ' has it' else '' end ||
        '. Pick a handoff time that works for you: https://wearercap.org/uniform-exchange/#/requests',
        new.id);
    else
      insert into ue_notifications (kind, phone, body, request_id)
      values ('request_waitlist', ph,
        'RCAP Uniform Exchange: we received your request for a ' || item ||
        '. Nothing in the bins right now, so you''re on the waitlist — the moment a match comes in ' ||
        'we''ll text you to set up a handoff. https://wearercap.org/uniform-exchange/#/requests',
        new.id);
    end if;
  end if;

  if new.status = 'assigned' and new.bin_id is not null then
    perform ue_notify_holder(new.bin_id, 'holder_request',
      'a request is queued to your bin — ' || item || ' for ' || new.parent_name ||
      '. They''re picking a handoff time from your availability now.',
      new.id, null);
  end if;
  return new;
end;
$$;

-- Waitlist assignment: same "go pick a time" framing.
create or replace function public.ue_assign_request(p_id uuid, p_bin uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.ue_requests%rowtype;
begin
  update public.ue_requests
  set status = 'assigned', bin_id = p_bin, assigned_at = now(), due_at = now() + interval '5 days'
  where id = p_id and status = 'open'
  returning * into r;
  if not found then raise exception 'Request not found or not open'; end if;

  if ue_phone(r.contact) <> '' then
    insert into ue_notifications (kind, phone, body, request_id)
    values ('request_received', ue_phone(r.contact),
      'RCAP Uniform Exchange: good news — we found your ' ||
      trim(ue_type_label(r.item_type) || ' · ' || r.size) ||
      '. Pick a handoff time: https://wearercap.org/uniform-exchange/#/requests',
      r.id);
  end if;

  perform ue_notify_holder(p_bin, 'holder_request',
    'a request is queued to your bin — ' ||
    trim(ue_type_label(r.item_type) || ' · ' || r.size) || ' for ' || r.parent_name ||
    '. They''re picking a handoff time from your availability now.',
    r.id, null);
end;
$$;
