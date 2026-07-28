-- ---------------------------------------------------------------------------
-- 0025_holder_home.sql — a place of their own.
--
-- A bin holder's only view was the bin page behind a QR code. That works when
-- you're standing over one bin, but it isn't a home: someone carrying a shirt
-- bin and a pants bin had two pages and no way to see everything they owe, and
-- setting up a bin for the first time meant logging items one at a time.
--
-- So: one private page per person, at /#/holder/<token>, with everything they
-- hold, everything queued to them, their availability, and a grid for punching
-- in a whole bin's worth of numbers at once.
-- ---------------------------------------------------------------------------

alter table public.ue_holders add column if not exists token text;

update public.ue_holders
set token = replace(gen_random_uuid()::text, '-', '')
where token is null;

alter table public.ue_holders
  alter column token set default replace(gen_random_uuid()::text, '-', '');

create unique index if not exists ue_holders_token_idx on public.ue_holders (token);

-- The token is the key, so it must never come back with the public list — and
-- while we're here, a volunteer's cell and email shouldn't either. The public
-- needs a holder's name, house and availability; the admin gets the rest
-- through ue_admin_data.
revoke select on public.ue_holders from anon, authenticated;
grant select (id, name, house, student, note, offers_carline, offers_student,
              carline_days, carline_when, carline_spot, active, created_at)
  on public.ue_holders to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Everything one person needs, in one call.
-- ---------------------------------------------------------------------------
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
      'carline_spot', h.carline_spot),

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

-- ---------------------------------------------------------------------------
-- Bulk counts. The holder tells us what's in the bin NOW; we work out the
-- difference and log that, so the movement history stays the honest record of
-- what changed rather than being overwritten.
--
-- p_lines: [{"bin_id":…,"item_type":…,"size":…,"house":…,"qty":N}, …]
-- ---------------------------------------------------------------------------
create or replace function public.ue_holder_set_inventory(
  p_token text, p_lines json, p_actor text default ''
) returns integer
language plpgsql security definer set search_path = public
as $$
declare
  h public.ue_holders%rowtype;
  ln json;
  v_bin uuid; v_type text; v_size text; v_house text; v_target integer;
  v_now integer; v_delta integer; v_changed integer := 0;
begin
  select * into h from public.ue_holders where token = p_token;
  if not found then raise exception 'Not your page'; end if;

  for ln in select * from json_array_elements(p_lines) loop
    v_bin   := (ln ->> 'bin_id')::uuid;
    v_type  := ln ->> 'item_type';
    v_size  := ln ->> 'size';
    v_house := coalesce(ln ->> 'house', '');
    v_target := greatest(0, coalesce((ln ->> 'qty')::integer, 0));

    -- only bins this person actually carries
    if not exists (select 1 from public.ue_bins where id = v_bin and holder_id = h.id) then
      continue;
    end if;
    if coalesce(btrim(v_type), '') = '' or coalesce(btrim(v_size), '') = '' then
      continue;
    end if;

    select coalesce(sum(qty_delta), 0) into v_now
    from public.ue_movements
    where bin_id = v_bin and item_type = v_type and size = v_size
      and coalesce(house, '') = v_house;

    v_delta := v_target - v_now;
    if v_delta = 0 then continue; end if;

    insert into public.ue_movements
      (bin_id, item_type, size, house, qty_delta, kind, actor_name, note)
    values (v_bin, v_type, v_size, v_house, v_delta,
            case when v_delta > 0 then 'add' else 'adjust' end,
            coalesce(nullif(btrim(p_actor), ''), h.name),
            'Counted the bin');
    v_changed := v_changed + 1;
  end loop;

  return v_changed;
end;
$$;
grant execute on function public.ue_holder_set_inventory(text, json, text) to anon, authenticated;

-- Availability, gated by the same token.
create or replace function public.ue_holder_availability_by_token(
  p_token text,
  p_offers_carline boolean default null, p_offers_student boolean default null,
  p_days integer[] default null, p_when text default null,
  p_spot text default null, p_student text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare h_id uuid;
begin
  select id into h_id from public.ue_holders where token = p_token;
  if h_id is null then raise exception 'Not your page'; end if;
  perform ue_holder_availability(h_id, p_offers_carline, p_offers_student,
                                 p_days, p_when, p_spot, p_student);
end;
$$;
grant execute on function public.ue_holder_availability_by_token(text, boolean, boolean, integer[], text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The admin hands out these links, and can text one straight to a holder.
-- ---------------------------------------------------------------------------
create or replace function public.ue_admin_holder_links(p_pass text)
returns json
language plpgsql security definer set search_path = public
as $$
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;
  return coalesce((
    select json_object_agg(id::text, token) from public.ue_holders
  ), '{}'::json);
end;
$$;
grant execute on function public.ue_admin_holder_links(text) to anon, authenticated;

create or replace function public.ue_admin_text_holder_link(p_pass text, p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare h public.ue_holders%rowtype; ph text;
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;
  select * into h from public.ue_holders where id = p_id;
  if not found then raise exception 'Holder not found'; end if;
  ph := ue_phone(h.phone);
  if ph = '' then raise exception 'No cell number on file for %', h.name; end if;

  insert into public.ue_notifications (kind, phone, body)
  values ('holder_link', ph,
    'RCAP Uniform Exchange: thank you for holding a bin! This is your private page — ' ||
    'your bins, anything queued to you, and where you can update your counts: ' ||
    'https://wearercap.org/uniform-exchange/#/holder/' || h.token ||
    ' (just for you, no password)');
end;
$$;
grant execute on function public.ue_admin_text_holder_link(text, uuid) to anon, authenticated;

alter table public.ue_notifications drop constraint if exists ue_notifications_kind_check;
alter table public.ue_notifications add constraint ue_notifications_kind_check check (kind in
  ('request_received','request_waitlist','ready_at_desk','offer_received',
   'holder_request','holder_offer','handoff_set','handoff_sent','handoff_done',
   'access_link','holder_link'));

-- The back office gets whole holder records, tokens and all.
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
    'holders',  coalesce((select json_agg(row_to_json(h) order by h.name)
                          from public.ue_holders h), '[]'::json),
    'notifications', coalesce((select json_agg(row_to_json(n))
                               from (select * from public.ue_notifications
                                     order by created_at desc limit 40) n), '[]'::json)
  );
end;
$$;
grant execute on function public.ue_admin_data(text) to anon, authenticated;
