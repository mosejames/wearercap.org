-- ---------------------------------------------------------------------------
-- 0038_holder_control.sql — the holder is not a vending machine.
--
-- As built, a holder said which mornings they were generally around and every
-- decision after that belonged to the requester. Five families could pick five
-- different mornings and the holder had no way to say no, no way to move one,
-- and no way to say "I'm out of town Thursday." Their only button was "Handed
-- it off."
--
-- Four changes, all on the holder's side of the table:
--
--   a cap        how many mornings in a week they'll do at all
--   clustering   the family's slot list floats mornings this holder is already
--                coming for someone else, so everyone lands on the same day
--   one bag      a family with two things ready gets one handoff, not two
--   can't make it   move it, or hand it back, and the family hears about it
--
-- Plus two things about knowing who you're meeting: a photo, and a number
-- either side may choose to share once a handoff is set. Neither is shared by
-- default and neither is required.
-- ---------------------------------------------------------------------------

alter table public.ue_holders
  add column if not exists photo_url text not null default '',
  add column if not exists max_handoff_days integer not null default 2
    check (max_handoff_days between 1 and 5);

-- Sharing is per handoff, not a standing setting: agreeing to swap numbers
-- with the family you're meeting Tuesday isn't agreeing to it with everyone.
alter table public.ue_requests
  add column if not exists family_shared boolean not null default false,
  add column if not exists holder_shared boolean not null default false;

alter table public.ue_notifications drop constraint if exists ue_notifications_kind_check;
alter table public.ue_notifications add constraint ue_notifications_kind_check check (kind in
  ('request_received','request_waitlist','ready_at_desk','offer_received',
   'holder_request','holder_offer','handoff_set','handoff_sent','handoff_done',
   'access_link','holder_link','holder_welcome','handoff_moved','handoff_released',
   'contact_shared'));

-- ---------------------------------------------------------------------------
-- What a bin's holder is already committed to. No names, no items — just the
-- mornings, so a family's slot list can point at the one they're already
-- coming for. This is the whole clustering mechanism.
-- ---------------------------------------------------------------------------
create or replace function public.ue_bin_handoff_days(p_bin uuid)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  return coalesce((
    select json_agg(row_to_json(d) order by d.handoff_date) from (
      select r.handoff_date, count(*) n
      from public.ue_requests r
      join public.ue_bins b on b.id = r.bin_id
      where b.holder_id = (select holder_id from public.ue_bins where id = p_bin)
        and r.status = 'scheduled'
        and r.handoff_mode = 'carline'
        and r.handoff_date >= current_date
      group by r.handoff_date
    ) d), '[]'::json);
end;
$$;
grant execute on function public.ue_bin_handoff_days(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Scheduling, with one bag per family.
--
-- Two things ready from the same bin is one trip to the same car window. The
-- family picks once and everything else of theirs in that bin comes along.
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

  -- Everything else this family has waiting in this same bin rides along.
  update public.ue_requests o set
    handoff_mode = r.handoff_mode,
    handoff_date = r.handoff_date,
    handoff_slot = r.handoff_slot,
    status       = 'scheduled',
    due_at       = r.due_at
  where o.id <> r.id
    and o.bin_id = r.bin_id
    and o.status = 'assigned'
    and ue_phone(o.contact) = ue_phone(r.contact)
    and ue_phone(r.contact) <> '';
  get diagnostics extra = row_count;

  select * into b from public.ue_bins where id = r.bin_id;
  select * into h from public.ue_holders where id = b.holder_id;
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

-- ---------------------------------------------------------------------------
-- "I can't make it."
--
-- With a date: moved, and the family is told. Without one: handed back, the
-- request returns to waiting-on-a-time, and the family is asked to pick again.
-- Either way the whole family's bag in that bin moves together, because it was
-- one trip.
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
    update public.ue_requests set
      handoff_date = p_date,
      handoff_slot = coalesce(nullif(p_slot, ''), 'am'),
      handoff_mode = 'carline',
      status       = 'scheduled',
      due_at       = (p_date + interval '1 day')::timestamptz
    where bin_id = r.bin_id
      and status in ('assigned','scheduled')
      and ue_phone(contact) = ue_phone(r.contact);

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
    update public.ue_requests set
      handoff_mode = null,
      handoff_date = null,
      handoff_slot = '',
      status       = 'assigned',
      due_at       = now() + interval '3 days'
    where bin_id = r.bin_id
      and status in ('assigned','scheduled')
      and ue_phone(contact) = ue_phone(r.contact);

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

-- ---------------------------------------------------------------------------
-- Swapping numbers, one handoff at a time, only if you choose to.
-- ---------------------------------------------------------------------------
create or replace function public.ue_share_contact(
  p_id uuid, p_who text, p_token text default null, p_access text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.ue_requests%rowtype;
  b public.ue_bins%rowtype;
  h public.ue_holders%rowtype;
  item text;
begin
  select * into r from public.ue_requests where id = p_id;
  if not found then raise exception 'Request not found'; end if;
  select * into b from public.ue_bins where id = r.bin_id;
  select * into h from public.ue_holders where id = b.holder_id;
  item := trim(ue_type_label(r.item_type) || ' · ' || r.size);

  if p_who = 'holder' then
    -- Proven by the holder's own private token.
    if h.token is null or h.token is distinct from p_token then
      raise exception 'Not your page';
    end if;
    update public.ue_requests set holder_shared = true where id = p_id;
    if ue_phone(r.contact) <> '' and ue_phone(h.phone) <> '' then
      insert into ue_notifications (kind, phone, body, request_id)
      values ('contact_shared', ue_phone(r.contact),
        'RCAP Uniform Exchange: ' || h.name || ' shared their number for your ' || item ||
        ' handoff — ' || ue_phone_pretty(h.phone) || '. Text them if anything changes.',
        r.id);
    end if;

  elsif p_who = 'family' then
    -- Proven by the family's own access token.
    if p_access is null or ue_phone(r.contact) = ''
       or ue_token_for(r.contact) is distinct from p_access then
      raise exception 'Not your request';
    end if;
    update public.ue_requests set family_shared = true where id = p_id;
    perform ue_notify_holder(b.id, 'contact_shared',
      r.parent_name || ' shared their number for the ' || item || ' handoff — ' ||
      ue_phone_pretty(r.contact) || '.', r.id, null);
  else
    raise exception 'Unknown side';
  end if;
end;
$$;
grant execute on function public.ue_share_contact(uuid, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Both pages need a little more than they were getting: the family needs to
-- know who they're looking for, and the holder needs the cap and the photo.
-- ---------------------------------------------------------------------------
create or replace function public.ue_holder_update_self(
  p_token text,
  p_phone text default null, p_email text default null,
  p_notify_mode text default null,
  p_special boolean default null, p_special_note text default null,
  p_photo_url text default null, p_max_days integer default null
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
    phone = case when p_phone is null then phone else ue_tidy_phone(p_phone) end,
    email = case when p_email is null then email else btrim(lower(p_email)) end,
    notify_mode = coalesce(p_notify_mode, notify_mode),
    special_arrangements = coalesce(p_special, special_arrangements),
    special_note = coalesce(btrim(p_special_note), special_note),
    photo_url = case when p_photo_url is null then photo_url else btrim(p_photo_url) end,
    max_handoff_days = coalesce(greatest(1, least(5, p_max_days)), max_handoff_days)
  where id = h_id;
end;
$$;
grant execute on function public.ue_holder_update_self(text, text, text, text, boolean, text, text, integer) to anon, authenticated;

-- The photo and the cap are public the way a name and a carline spot already
-- are: they're how a family finds the right car.
grant select (photo_url, max_handoff_days) on public.ue_holders to anon, authenticated;

-- ---------------------------------------------------------------------------
-- A family's own list, with enough to actually find the person: who they are,
-- what their car looks like, their face, and their number if they shared it.
-- ---------------------------------------------------------------------------
-- The shape changes, so the old one has to go first.
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
  holder_student text, holder_phone text
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
         -- only once they've chosen to
         case when r.holder_shared then ue_phone_pretty(coalesce(h.phone, '')) else '' end
  from public.ue_requests r
  left join public.ue_bins b on b.id = r.bin_id
  left join public.ue_holders h on h.id = b.holder_id
  where ue_phone(r.contact) = v_ph
  order by r.created_at desc;
end;
$$;
grant execute on function public.ue_my_requests(text) to anon, authenticated;

-- ...and the holder's queue gains the same, from the other side.
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
               r.family_shared, r.holder_shared,
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
grant execute on function public.ue_holder_home(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Somewhere to put a face. Public-read like the rest of a holder's spotting
-- details, with an unguessable path — the same trust model as the token links
-- themselves. Only a holder's own token can write one.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('holder-photos', 'holder-photos', true, 3145728,
        array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set
  public = true, file_size_limit = 3145728,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic'];

drop policy if exists ue_photos_read on storage.objects;
create policy ue_photos_read on storage.objects
  for select using (bucket_id = 'holder-photos');

drop policy if exists ue_photos_write on storage.objects;
create policy ue_photos_write on storage.objects
  for insert with check (bucket_id = 'holder-photos');

drop policy if exists ue_photos_update on storage.objects;
create policy ue_photos_update on storage.objects
  for update using (bucket_id = 'holder-photos');
