-- ---------------------------------------------------------------------------
-- 0029_phone_canonical.sql — one form for a phone number.
--
-- People type "+1 404 555 1212", "(404) 555-1212", "404.555.1212" and
-- "14045551212" and mean the same thing. Every comparison already ran through
-- ue_phone(), so nothing was actually broken — but storing whatever was typed
-- means the same person can look like two people to the eye, and any future
-- lookup that forgets to normalise would quietly fail to match.
--
-- So: store E.164 everywhere, and hand the pretty version to screens.
-- ---------------------------------------------------------------------------

create or replace function public.ue_phone_pretty(p text)
returns text
language plpgsql immutable
as $$
declare d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if length(d) = 11 and left(d, 1) = '1' then d := substr(d, 2); end if;
  if length(d) <> 10 then return coalesce(p, ''); end if;
  return '(' || substr(d, 1, 3) || ') ' || substr(d, 4, 3) || '-' || substr(d, 7, 4);
end;
$$;
grant execute on function public.ue_phone_pretty(text) to anon, authenticated;

-- Everything already on file, brought to the canonical form.
update public.ue_holders
set phone = ue_phone(phone)
where ue_phone(phone) <> '' and phone <> ue_phone(phone);

update public.ue_requests
set contact = ue_phone(contact)
where ue_phone(contact) <> '' and contact <> ue_phone(contact);

update public.ue_offers
set contact = ue_phone(contact)
where ue_phone(contact) <> '' and contact <> ue_phone(contact);

-- ---------------------------------------------------------------------------
-- And normalised on the way in, so it stays that way. A value we can't read as
-- a US number is left exactly as typed rather than mangled — somebody might
-- have put an email or a note in a contact field.
-- ---------------------------------------------------------------------------
create or replace function public.ue_tidy_phone(p text)
returns text
language sql immutable
as $$
  select coalesce(nullif(ue_phone(p), ''), btrim(coalesce(p, '')));
$$;

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
    values (btrim(p_name), ue_tidy_phone(p_phone), btrim(lower(coalesce(p_email,''))),
            coalesce(p_house,''), coalesce(p_student,''), coalesce(p_note,''))
    returning id into v_id;
  elsif p_action = 'update' then
    update public.ue_holders set
      name    = coalesce(btrim(p_name), name),
      phone   = case when p_phone is null then phone else ue_tidy_phone(p_phone) end,
      email   = case when p_email is null then email else btrim(lower(p_email)) end,
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
grant execute on function public.ue_admin_holder(text, text, uuid, text, text, text, text, text, text) to anon, authenticated;

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
    phone = case when p_phone is null then phone else ue_tidy_phone(p_phone) end,
    email = case when p_email is null then email else btrim(lower(p_email)) end,
    notify_mode = coalesce(p_notify_mode, notify_mode),
    special_arrangements = coalesce(p_special, special_arrangements),
    special_note = coalesce(btrim(p_special_note), special_note)
  where id = h_id;
end;
$$;
grant execute on function public.ue_holder_update_self(text, text, text, text, boolean, text) to anon, authenticated;

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
    (btrim(p_parent_name), ue_tidy_phone(p_contact), btrim(coalesce(p_student, '')),
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
  values (btrim(p_parent_name), ue_tidy_phone(p_contact), coalesce(p_house, ''),
          btrim(p_items_desc), p_bin)
  returning * into o;

  return json_build_object('id', o.id, 'status', o.status, 'bin_id', o.bin_id);
end;
$$;
grant execute on function public.ue_create_offer(text, text, text, text, uuid) to anon, authenticated;
