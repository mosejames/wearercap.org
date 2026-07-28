-- ---------------------------------------------------------------------------
-- 0019_holders.sql — a parent can hold several bins.
-- We had it backwards: the holder's name, phone and schedule lived ON the bin,
-- so a parent with a shirt bin and a pants bin was two copies of one person.
-- Now the person is the record, and bins hang off them. Edit a phone once.
-- Availability moves to the person too — you have one carpool schedule, not
-- one per bin.
-- ---------------------------------------------------------------------------

create table if not exists public.ue_holders (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(btrim(name)) between 1 and 60),
  phone          text not null default '' check (length(phone) <= 40),
  email          text not null default '' check (length(email) <= 120),
  house          text not null default ''
                   check (house in ('', 'altruismo','amistad','isibindi','reveur')),
  student        text not null default '' check (length(student) <= 80),
  note           text not null default '' check (length(note) <= 200),
  offers_carline boolean not null default true,
  offers_student boolean not null default true,
  carline_days   integer[] not null default '{1,2,3,4,5}',
  carline_when   text not null default 'pm' check (carline_when in ('am','pm','both')),
  carline_spot   text not null default '' check (length(carline_spot) <= 120),
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

alter table public.ue_holders enable row level security;
drop policy if exists ue_holders_read on public.ue_holders;
create policy ue_holders_read on public.ue_holders for select using (true);

-- A bin now points at a person, and can say what it's mostly full of.
alter table public.ue_bins
  add column if not exists holder_id uuid references public.ue_holders (id),
  add column if not exists focus text not null default '' check (length(focus) <= 40);

-- ---------------------------------------------------------------------------
-- Carry every existing bin's holder across, one row per distinct person.
-- ---------------------------------------------------------------------------
-- distinct on, not aggregates: carline_days is itself an array, and array_agg
-- of an array builds a 2-D array you can't subscript back out. One row per
-- person, taking their most recently created bin's settings.
insert into public.ue_holders
  (name, phone, email, house, student, note,
   offers_carline, offers_student, carline_days, carline_when, carline_spot)
select distinct on (b.holder_name)
  b.holder_name, b.holder_phone, b.holder_email, b.holder_house,
  b.holder_student, b.holder_note,
  b.offers_carline, b.offers_student, b.carline_days, b.carline_when, b.carline_spot
from public.ue_bins b
where btrim(coalesce(b.holder_name, '')) <> ''
  and not exists (select 1 from public.ue_holders h where h.name = b.holder_name)
order by b.holder_name, b.created_at desc;

update public.ue_bins b
set holder_id = h.id
from public.ue_holders h
where b.holder_id is null and h.name = b.holder_name;

-- ---------------------------------------------------------------------------
-- Managing people.
-- ---------------------------------------------------------------------------
create or replace function public.ue_admin_holder(
  p_pass text, p_action text, p_id uuid default null,
  p_name text default null, p_phone text default null, p_email text default null,
  p_house text default null, p_student text default null, p_note text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid := p_id;
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;
  if p_action = 'create' then
    insert into public.ue_holders (name, phone, email, house, student, note)
    values (p_name, coalesce(p_phone,''), coalesce(p_email,''), coalesce(p_house,''),
            coalesce(p_student,''), coalesce(p_note,''))
    returning id into v_id;
  elsif p_action = 'update' then
    update public.ue_holders set
      name    = coalesce(p_name, name),
      phone   = coalesce(p_phone, phone),
      email   = coalesce(p_email, email),
      house   = coalesce(p_house, house),
      student = coalesce(p_student, student),
      note    = coalesce(p_note, note)
    where id = p_id;
  elsif p_action = 'deactivate' then
    update public.ue_holders set active = false where id = p_id;
  elsif p_action = 'restore' then
    update public.ue_holders set active = true where id = p_id;
  else
    raise exception 'Unknown action';
  end if;
  return v_id;
end;
$$;
revoke all on function public.ue_admin_holder(text, text, uuid, text, text, text, text, text, text) from public;
grant execute on function public.ue_admin_holder(text, text, uuid, text, text, text, text, text, text) to anon, authenticated;

-- Availability belongs to the person — set it once, every bin they hold follows.
create or replace function public.ue_holder_availability(
  p_id uuid,
  p_offers_carline boolean default null, p_offers_student boolean default null,
  p_days integer[] default null, p_when text default null,
  p_spot text default null, p_student text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.ue_holders set
    offers_carline = coalesce(p_offers_carline, offers_carline),
    offers_student = coalesce(p_offers_student, offers_student),
    carline_days   = coalesce(p_days, carline_days),
    carline_when   = coalesce(p_when, carline_when),
    carline_spot   = coalesce(p_spot, carline_spot),
    student        = coalesce(p_student, student)
  where id = p_id;
  if not found then raise exception 'Holder not found'; end if;
end;
$$;
revoke all on function public.ue_holder_availability(uuid, boolean, boolean, integer[], text, text, text) from public;
grant execute on function public.ue_holder_availability(uuid, boolean, boolean, integer[], text, text, text) to anon, authenticated;

-- Old bin-level availability call now edits the person behind the bin, so any
-- page still holding the previous version keeps working.
create or replace function public.ue_bin_availability(
  p_id uuid,
  p_offers_carline boolean default null, p_offers_student boolean default null,
  p_days integer[] default null, p_when text default null,
  p_spot text default null, p_holder_student text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_holder uuid;
begin
  select holder_id into v_holder from public.ue_bins where id = p_id;
  if v_holder is null then raise exception 'Bin has no holder yet'; end if;
  perform ue_holder_availability(v_holder, p_offers_carline, p_offers_student,
                                 p_days, p_when, p_spot, p_holder_student);
end;
$$;

-- ---------------------------------------------------------------------------
-- Bin admin: assign to a person, say what it holds. Holder contact fields are
-- gone from here — they live on the person now.
-- ---------------------------------------------------------------------------
create or replace function public.ue_admin_bin2(
  p_pass text, p_action text, p_id uuid default null,
  p_code text default null, p_name text default null,
  p_holder_id uuid default null, p_focus text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := p_id;
  v_name text;
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;
  select name into v_name from public.ue_holders where id = p_holder_id;
  if p_action = 'create' then
    insert into public.ue_bins (code, name, holder_id, focus, holder_name, holder_house)
    values (upper(p_code), p_name, p_holder_id, coalesce(p_focus,''),
            coalesce(v_name,''),
            coalesce((select house from public.ue_holders where id = p_holder_id), ''))
    returning id into v_id;
  elsif p_action = 'update' then
    update public.ue_bins set
      name        = coalesce(p_name, name),
      holder_id   = coalesce(p_holder_id, holder_id),
      focus       = coalesce(p_focus, focus),
      holder_name = coalesce(v_name, holder_name)
    where id = p_id;
  elsif p_action = 'retire' then
    update public.ue_bins set retired = true where id = p_id;
  elsif p_action = 'restore' then
    update public.ue_bins set retired = false where id = p_id;
  else
    raise exception 'Unknown action';
  end if;
  return v_id;
end;
$$;
revoke all on function public.ue_admin_bin2(text, text, uuid, text, text, uuid, text) from public;
grant execute on function public.ue_admin_bin2(text, text, uuid, text, text, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Texts to a holder now resolve through the person (falling back to the old
-- per-bin columns for anything not yet migrated).
-- ---------------------------------------------------------------------------
create or replace function public.ue_notify_holder(
  p_bin uuid, p_kind text, p_body_after text, p_request uuid, p_offer uuid
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  b public.ue_bins%rowtype;
  ph text;
  raw text;
begin
  select * into b from public.ue_bins where id = p_bin;
  if not found then return; end if;

  select coalesce(h.phone, '') into raw
  from public.ue_holders h where h.id = b.holder_id;
  ph := ue_phone(coalesce(nullif(raw, ''), b.holder_phone));
  if ph = '' then return; end if;

  insert into ue_notifications (kind, phone, body, request_id, offer_id)
  values (p_kind, ph,
    'RCAP Uniform Exchange (' || b.code || '): ' || p_body_after ||
    ' Your bin page: https://wearercap.org/uniform-exchange/#/bin/' || b.code,
    p_request, p_offer);
end;
$$;

-- The handoff text reads the holder's spotting note off the person.
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
  lbl text; item text; hname text; spot text;
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
  hname := coalesce(nullif(h.name, ''), nullif(b.holder_name, ''), 'your bin holder');
  spot  := coalesce(nullif(h.carline_spot, ''), b.carline_spot, '');
  lbl   := ue_slot_label(r.handoff_date, r.handoff_slot, r.handoff_mode);
  item  := trim(ue_type_label(r.item_type) || ' · ' || r.size);

  if ue_phone(r.contact) <> '' then
    insert into ue_notifications (kind, phone, body, request_id)
    values ('handoff_set', ue_phone(r.contact),
      'RCAP Uniform Exchange: your ' || item || ' handoff is set — ' || lbl ||
      case when p_mode = 'student' then ', so it''ll come home in a backpack. '
           else ' with ' || hname ||
                case when spot <> '' then ' (' || spot || ')' else '' end || '. ' end ||
      'Tap "Got it" once it''s in your hands: https://wearercap.org/uniform-exchange/#/requests',
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

-- ---------------------------------------------------------------------------
-- Pending requests need a place to be fixed: move one to a different bin
-- (because that holder is out of town, or the item turned up elsewhere),
-- nudge it back a step, or close it out by hand.
-- Reassigning resets the handoff — the new holder keeps different hours, so
-- the family picks again from THEIR availability.
-- ---------------------------------------------------------------------------
create or replace function public.ue_admin_reassign(p_pass text, p_id uuid, p_bin uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.ue_requests%rowtype;
  item text;
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;

  update public.ue_requests set
    bin_id       = p_bin,
    status       = 'assigned',
    assigned_at  = now(),
    due_at       = now() + interval '5 days',
    handoff_mode = '',
    handoff_date = null,
    handoff_slot = '',
    handed_off_at = null
  where id = p_id and status in ('open','assigned','scheduled','handed_off')
  returning * into r;
  if not found then raise exception 'Request not found or already closed'; end if;

  item := trim(ue_type_label(r.item_type) || ' · ' || r.size);

  if ue_phone(r.contact) <> '' then
    insert into ue_notifications (kind, phone, body, request_id)
    values ('request_received', ue_phone(r.contact),
      'RCAP Uniform Exchange: your ' || item || ' moved to another RCAP bin. ' ||
      'Pick a new handoff time here: https://wearercap.org/uniform-exchange/#/requests',
      r.id);
  end if;

  perform ue_notify_holder(p_bin, 'holder_request',
    'a request moved to your bin — ' || item || ' for ' || r.parent_name ||
    '. They''re picking a handoff time from your availability now.',
    r.id, null);
end;
$$;

create or replace function public.ue_admin_request(
  p_pass text, p_id uuid, p_status text default null, p_note text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;
  if p_status is not null and p_status not in
     ('open','assigned','scheduled','handed_off','fulfilled','canceled') then
    raise exception 'Unknown status';
  end if;

  update public.ue_requests set
    status = coalesce(p_status, status),
    note   = coalesce(p_note, note),
    fulfilled_at = case when p_status = 'fulfilled' then coalesce(fulfilled_at, now())
                        else fulfilled_at end,
    -- back to the waitlist means it has no bin again
    bin_id = case when p_status = 'open' then null else bin_id end
  where id = p_id;
  if not found then raise exception 'Request not found'; end if;
end;
$$;

revoke all on function public.ue_admin_reassign(text, uuid, uuid) from public;
revoke all on function public.ue_admin_request(text, uuid, text, text) from public;
grant execute on function public.ue_admin_reassign(text, uuid, uuid) to anon, authenticated;
grant execute on function public.ue_admin_request(text, uuid, text, text) to anon, authenticated;
