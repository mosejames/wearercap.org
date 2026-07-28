-- ---------------------------------------------------------------------------
-- 0026_holder_welcome.sql — nobody should be handed a bin and left guessing.
--
-- Adding someone as a bin holder now says so: a text and an email, both
-- carrying their private page, both with a subject and wording they can search
-- for months later when they've forgotten where the link went.
--
-- The notifications table grows an email channel so both live in one queue with
-- one sender and one retry story.
-- ---------------------------------------------------------------------------

alter table public.ue_notifications
  add column if not exists channel text not null default 'sms'
    check (channel in ('sms', 'email')),
  add column if not exists email   text not null default '',
  add column if not exists subject text not null default '';

alter table public.ue_notifications alter column phone set default '';

alter table public.ue_holders
  add column if not exists availability_set_at timestamptz,
  add column if not exists welcomed_at timestamptz;

alter table public.ue_notifications drop constraint if exists ue_notifications_kind_check;
alter table public.ue_notifications add constraint ue_notifications_kind_check check (kind in
  ('request_received','request_waitlist','ready_at_desk','offer_received',
   'holder_request','holder_offer','handoff_set','handoff_sent','handoff_done',
   'access_link','holder_link','holder_welcome'));

-- Saving availability is the signal that step two of setup is done.
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
    student        = coalesce(p_student, student),
    availability_set_at = now()
  where id = p_id;
  if not found then raise exception 'Holder not found'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- The welcome itself.
-- ---------------------------------------------------------------------------
create or replace function public.ue_welcome_holder(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  h public.ue_holders%rowtype;
  link text;
  ph text;
  first_name text;
begin
  select * into h from public.ue_holders where id = p_id;
  if not found then return; end if;

  link := 'https://wearercap.org/uniform-exchange/#/holder/' || h.token;
  first_name := split_part(btrim(h.name), ' ', 1);
  ph := ue_phone(h.phone);

  if ph <> '' then
    insert into public.ue_notifications (kind, channel, phone, body)
    values ('holder_welcome', 'sms', ph,
      'Welcome to the RCAP Uniform Exchange, ' || first_name || ' — you''re now a bin holder. ' ||
      'This link is your page: set up your bin, add what you already have, and say which ' ||
      'mornings work for you. We''ll text you whenever a family requests something. ' || link);
  end if;

  if btrim(coalesce(h.email, '')) <> '' then
    insert into public.ue_notifications (kind, channel, email, phone, subject, body)
    values ('holder_welcome', 'email', btrim(h.email), '',
      'RCAP Uniform Exchange — your bin holder page',
      'Welcome to the RCAP Uniform Exchange, ' || first_name || '!' || E'\n\n' ||
      'Thank you for holding a bin. Uniforms that would have sat in a closet now get a ' ||
      'second run at RCA because of people doing exactly what you just signed up for.' || E'\n\n' ||
      'This is your own page — no password, the link is the key. Keep this email; it''s the ' ||
      'easiest way to find your way back:' || E'\n\n' ||
      link || E'\n\n' ||
      'THREE THINGS TO DO WHEN YOU OPEN IT' || E'\n\n' ||
      '1. Count what you already have. Under "My bins" there''s a grid — type roughly what''s ' ||
      'in the bin and hit save. Rough is fine; these are bins, not inventory systems.' || E'\n\n' ||
      '2. Say when you''re around. Under "My setup," tap the mornings that are easy for you ' ||
      'and add how a family will spot you at carline ("blue Highlander, I park by the gym"). ' ||
      'Handoffs happen at morning drop-off. You can also offer to send items in with your ' ||
      'own student, which skips the carpool line entirely.' || E'\n\n' ||
      '3. Then just watch for texts. When a family requests something from your bin, we text ' ||
      'you — what it is, who it''s for, and the morning they picked. Bag it, hand it over, ' ||
      'and tap "Handed it off." That''s the whole job.' || E'\n\n' ||
      'Questions any time: hello@wearercap.org' || E'\n\n' ||
      '— RCAP');
  end if;

  update public.ue_holders set welcomed_at = now() where id = p_id;
end;
$$;

-- New holder with a way to reach them: welcome them.
create or replace function public.ue_holder_welcome_trigger()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(ue_phone(new.phone), '') <> '' or btrim(coalesce(new.email, '')) <> '' then
    perform ue_welcome_holder(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists ue_holder_welcome_insert on public.ue_holders;
create trigger ue_holder_welcome_insert
  after insert on public.ue_holders
  for each row execute function public.ue_holder_welcome_trigger();

-- Added without contact details, then given them later — welcome them then.
create or replace function public.ue_holder_welcome_late()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.welcomed_at is null
     and (coalesce(ue_phone(new.phone), '') <> '' or btrim(coalesce(new.email, '')) <> '')
     and (coalesce(old.phone, '') is distinct from coalesce(new.phone, '')
          or coalesce(old.email, '') is distinct from coalesce(new.email, '')) then
    perform ue_welcome_holder(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists ue_holder_welcome_update on public.ue_holders;
create trigger ue_holder_welcome_update
  after update on public.ue_holders
  for each row execute function public.ue_holder_welcome_late();

-- And a way to send it again by hand.
create or replace function public.ue_admin_welcome_holder(p_pass text, p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;
  perform ue_welcome_holder(p_id);
end;
$$;
grant execute on function public.ue_admin_welcome_holder(text, uuid) to anon, authenticated;

-- Existing holders who already have contact details get one too.
do $$
declare r record;
begin
  for r in select id from public.ue_holders
           where welcomed_at is null
             and (ue_phone(phone) <> '' or btrim(coalesce(email, '')) <> '')
  loop
    perform ue_welcome_holder(r.id);
  end loop;
end $$;

-- The holder page needs to know how far along setup is.
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
      'availability_set_at', h.availability_set_at),

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
