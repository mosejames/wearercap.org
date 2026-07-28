-- ---------------------------------------------------------------------------
-- 0024_private_requests.sql — your requests are yours.
--
-- The requests page was listing every family's name, student and phone number
-- to anyone who opened the link. That was wrong, and it was my mistake: the
-- table has been readable by the anon key since day one.
--
-- The fix, without making parents keep another password:
--   * Each phone number gets a private token. Every text we send links to
--     /#/my/<token>, which shows that number's requests and nothing else.
--   * Nobody can list requests any more. The anon key can insert one and read
--     an anonymous commitments view (bin/item/size only, no people) that the
--     matcher needs. Everything else goes through a function.
--   * Lost the link? Type your number and we text a fresh one. We never say
--     whether that number is known to us.
--   * Bin holders see the queue for their own bin. Admins see everything.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- One private token per phone number.
-- ---------------------------------------------------------------------------
create table if not exists public.ue_access (
  -- gen_random_uuid is core Postgres; gen_random_bytes lives in the extensions
  -- schema and isn't on the search path when this table is created.
  token      text primary key default replace(gen_random_uuid()::text, '-', ''),
  phone      text not null unique,
  created_at timestamptz not null default now(),
  last_seen  timestamptz
);

alter table public.ue_access enable row level security;
-- No policies at all: reachable only through the functions below.

create or replace function public.ue_token_for(p_phone text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_ph text := ue_phone(p_phone);
  v_tok text;
begin
  if v_ph = '' then return ''; end if;
  insert into public.ue_access (phone) values (v_ph) on conflict (phone) do nothing;
  select token into v_tok from public.ue_access where phone = v_ph;
  return coalesce(v_tok, '');
end;
$$;
-- Deliberately NOT granted to anon: handing out a token for any number you
-- typed would be exactly the leak we're closing.
revoke all on function public.ue_token_for(text) from public, anon, authenticated;

create or replace function public.ue_my_url(p_phone text)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_tok text := ue_token_for(p_phone);
begin
  if v_tok = '' then return 'https://wearercap.org/uniform-exchange/'; end if;
  return 'https://wearercap.org/uniform-exchange/#/my/' || v_tok;
end;
$$;
revoke all on function public.ue_my_url(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- What the matcher needs, with the people stripped out.
-- ---------------------------------------------------------------------------
create or replace view public.ue_commitments as
  select bin_id, item_type, size, house, qty, status
  from public.ue_requests
  where status = 'assigned';

grant select on public.ue_commitments to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Close the doors.
-- ---------------------------------------------------------------------------
drop policy if exists ue_requests_read on public.ue_requests;
drop policy if exists ue_requests_insert on public.ue_requests;
drop policy if exists ue_offers_read on public.ue_offers;
drop policy if exists ue_offers_insert on public.ue_offers;
drop policy if exists ue_notifications_read on public.ue_notifications;

-- ---------------------------------------------------------------------------
-- Creating a request now returns just enough to show the confirmation, and
-- hands back the private link so the parent can bookmark it immediately.
-- ---------------------------------------------------------------------------
create or replace function public.ue_create_request(
  p_parent_name text, p_contact text, p_student text,
  p_item_type text, p_size text, p_house text, p_requester_house text,
  p_qty integer, p_note text, p_bin uuid
) returns json
language plpgsql security definer set search_path = public
as $$
declare r public.ue_requests%rowtype;
begin
  if btrim(coalesce(p_parent_name, '')) = '' then
    raise exception 'A name is required';
  end if;

  insert into public.ue_requests
    (parent_name, contact, student, item_type, size, house, requester_house, qty, note, bin_id)
  values
    (btrim(p_parent_name), btrim(coalesce(p_contact, '')), btrim(coalesce(p_student, '')),
     p_item_type, p_size, coalesce(p_house, ''), coalesce(p_requester_house, ''),
     greatest(1, least(5, coalesce(p_qty, 1))), btrim(coalesce(p_note, '')), p_bin)
  returning * into r;

  return json_build_object(
    'id', r.id, 'status', r.status, 'item_type', r.item_type, 'size', r.size,
    'house', r.house, 'qty', r.qty, 'bin_id', r.bin_id, 'due_at', r.due_at,
    'my_url', case when ue_phone(r.contact) <> '' then ue_my_url(r.contact) else '' end
  );
end;
$$;
grant execute on function public.ue_create_request(text, text, text, text, text, text, text, integer, text, uuid) to anon, authenticated;

create or replace function public.ue_create_offer(
  p_parent_name text, p_contact text, p_house text, p_items_desc text, p_bin uuid
) returns json
language plpgsql security definer set search_path = public
as $$
declare o public.ue_offers%rowtype;
begin
  if btrim(coalesce(p_parent_name, '')) = '' then raise exception 'A name is required'; end if;
  if btrim(coalesce(p_items_desc, '')) = '' then raise exception 'Tell us what you have'; end if;

  insert into public.ue_offers (parent_name, contact, house, items_desc, bin_id)
  values (btrim(p_parent_name), btrim(coalesce(p_contact, '')), coalesce(p_house, ''),
          btrim(p_items_desc), p_bin)
  returning * into o;

  return json_build_object('id', o.id, 'status', o.status, 'bin_id', o.bin_id);
end;
$$;
grant execute on function public.ue_create_offer(text, text, text, text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- My requests — everything tied to the token's phone number, nothing else.
-- ---------------------------------------------------------------------------
create or replace function public.ue_my_requests(p_token text)
returns table (
  id uuid, parent_name text, student text, contact text,
  item_type text, size text, house text, qty integer, note text,
  status text, bin_id uuid, due_at timestamptz,
  handoff_mode text, handoff_date date, handoff_slot text,
  handed_off_at timestamptz, fulfilled_at timestamptz, created_at timestamptz
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
         r.handed_off_at, r.fulfilled_at, r.created_at
  from public.ue_requests r
  where ue_phone(r.contact) = v_ph
  order by r.created_at desc;
end;
$$;
grant execute on function public.ue_my_requests(text) to anon, authenticated;

-- Lost the link: we text a fresh one. The answer is identical whether or not
-- the number is known, so this can't be used to fish for who's on the list.
create or replace function public.ue_request_access(p_phone text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_ph text := ue_phone(p_phone);
  v_count integer;
begin
  if v_ph = '' then return; end if;

  -- nothing to send if this number has never made a request
  select count(*) into v_count from public.ue_requests where ue_phone(contact) = v_ph;
  if v_count = 0 then return; end if;

  -- one link text per ten minutes, so this can't be used to pester anyone
  if exists (
    select 1 from public.ue_notifications
    where phone = v_ph and kind = 'access_link' and created_at > now() - interval '10 minutes'
  ) then return; end if;

  insert into public.ue_notifications (kind, phone, body)
  values ('access_link', v_ph,
    'RCAP Uniform Exchange: here''s your private link to your requests — ' ||
    ue_my_url(v_ph) || ' (just for you; no password needed)');
end;
$$;
grant execute on function public.ue_request_access(text) to anon, authenticated;

alter table public.ue_notifications drop constraint if exists ue_notifications_kind_check;
alter table public.ue_notifications add constraint ue_notifications_kind_check check (kind in
  ('request_received','request_waitlist','ready_at_desk','offer_received',
   'holder_request','holder_offer','handoff_set','handoff_sent','handoff_done',
   'access_link'));

-- ---------------------------------------------------------------------------
-- A bin holder sees the queue for their own bin — that's the whole point of
-- the QR code. Still no wider list.
-- ---------------------------------------------------------------------------
create or replace function public.ue_bin_queue(p_code text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_bin uuid;
begin
  select id into v_bin from public.ue_bins where code = upper(p_code);
  if v_bin is null then return json_build_object('requests', '[]'::json, 'offers', '[]'::json); end if;

  return json_build_object(
    'requests', coalesce((
      select json_agg(row_to_json(x)) from (
        select r.id, r.parent_name, r.student, r.contact, r.item_type, r.size, r.house,
               r.qty, r.note, r.status, r.bin_id, r.due_at,
               r.handoff_mode, r.handoff_date, r.handoff_slot
        from public.ue_requests r
        where r.bin_id = v_bin and r.status in ('assigned','scheduled','handed_off')
        order by r.due_at nulls last
      ) x), '[]'::json),
    'offers', coalesce((
      select json_agg(row_to_json(y)) from (
        select o.id, o.parent_name, o.contact, o.house, o.items_desc, o.status, o.bin_id
        from public.ue_offers o
        where o.bin_id = v_bin and o.status in ('open','scheduled')
        order by o.created_at
      ) y), '[]'::json)
  );
end;
$$;
grant execute on function public.ue_bin_queue(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The back office, behind the passcode it already uses.
-- ---------------------------------------------------------------------------
create or replace function public.ue_admin_data(p_pass text)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;
  return json_build_object(
    'requests', coalesce((select json_agg(row_to_json(r) order by r.created_at desc)
                          from public.ue_requests r), '[]'::json),
    'offers',   coalesce((select json_agg(row_to_json(o) order by o.created_at desc)
                          from public.ue_offers o), '[]'::json),
    'notifications', coalesce((select json_agg(row_to_json(n))
                               from (select * from public.ue_notifications
                                     order by created_at desc limit 40) n), '[]'::json)
  );
end;
$$;
grant execute on function public.ue_admin_data(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Every text that points a parent at their requests now points at THEIR page.
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
  link text := '';
begin
  if new.bin_id is not null then
    select coalesce(holder_name,'') into hn from public.ue_bins where id = new.bin_id;
  end if;

  if ph <> '' then
    link := ue_my_url(new.contact);
    if new.status = 'assigned' then
      insert into ue_notifications (kind, phone, body, request_id)
      values ('request_received', ph,
        'RCAP Uniform Exchange: we found your ' || item ||
        case when hn <> '' then ' — ' || hn || ' has it' else '' end ||
        '. Pick a handoff time that works for you: ' || link,
        new.id);
    else
      insert into ue_notifications (kind, phone, body, request_id)
      values ('request_waitlist', ph,
        'RCAP Uniform Exchange: we received your request for a ' || item ||
        '. Nothing in the bins right now, so you''re on the waitlist — the moment a match ' ||
        'comes in we''ll text you to set up a handoff. ' || link,
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

create or replace function public.ue_handoff_sent(p_id uuid, p_actor text default '')
returns void
language plpgsql security definer set search_path = public
as $$
declare r public.ue_requests%rowtype;
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

  update public.ue_requests set status = 'handed_off', handed_off_at = now() where id = p_id;

  if ue_phone(r.contact) <> '' then
    insert into ue_notifications (kind, phone, body, request_id)
    values ('handoff_sent', ue_phone(r.contact),
      'RCAP Uniform Exchange: your ' || trim(ue_type_label(r.item_type) || ' · ' || r.size) ||
      ' is on its way (' || ue_slot_label(r.handoff_date, r.handoff_slot, r.handoff_mode) ||
      '). Tap "Got it" when it''s in your hands: ' || ue_my_url(r.contact),
      r.id);
  end if;
end;
$$;

create or replace function public.ue_assign_request(p_id uuid, p_bin uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare r public.ue_requests%rowtype;
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
      '. Pick a handoff time: ' || ue_my_url(r.contact),
      r.id);
  end if;

  perform ue_notify_holder(p_bin, 'holder_request',
    'a request is queued to your bin — ' ||
    trim(ue_type_label(r.item_type) || ' · ' || r.size) || ' for ' || r.parent_name ||
    '. They''re picking a handoff time from your availability now.',
    r.id, null);
end;
$$;

create or replace function public.ue_admin_reassign(p_pass text, p_id uuid, p_bin uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare r public.ue_requests%rowtype; item text;
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;

  update public.ue_requests set
    bin_id = p_bin, status = 'assigned', assigned_at = now(),
    due_at = now() + interval '5 days',
    handoff_mode = '', handoff_date = null, handoff_slot = '', handed_off_at = null
  where id = p_id and status in ('open','assigned','scheduled','handed_off')
  returning * into r;
  if not found then raise exception 'Request not found or already closed'; end if;

  item := trim(ue_type_label(r.item_type) || ' · ' || r.size);

  if ue_phone(r.contact) <> '' then
    insert into ue_notifications (kind, phone, body, request_id)
    values ('request_received', ue_phone(r.contact),
      'RCAP Uniform Exchange: your ' || item || ' moved to another RCAP bin. ' ||
      'Pick a new handoff time here: ' || ue_my_url(r.contact),
      r.id);
  end if;

  perform ue_notify_holder(p_bin, 'holder_request',
    'a request moved to your bin — ' || item || ' for ' || r.parent_name ||
    '. They''re picking a handoff time from your availability now.',
    r.id, null);
end;
$$;
