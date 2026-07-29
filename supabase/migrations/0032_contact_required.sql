-- ---------------------------------------------------------------------------
-- 0032_contact_required.sql — a request nobody can answer isn't a request.
--
-- The form used to take a name and let the rest go. But every step after
-- submitting arrives by text — the confirmation, the link to pick a handoff,
-- the private page that tracks it — and the token that opens that page is
-- keyed to the phone number. A request with no cell had no way to reach its
-- own outcome; it just sat there waiting for someone to notice by hand.
--
-- Same for the student's name: the holder is putting a bag in a specific
-- child's hands at carline, or sending it in with their own. "For the Johnson
-- family" doesn't get it there.
--
-- And a donation offer with no number is a pickup nobody can arrange.
--
-- The screens ask for all of this now; these are the same rules stated where
-- they can't be skipped, since ue_create_request is callable by anyone.
-- ---------------------------------------------------------------------------

create or replace function public.ue_create_request(
  p_parent_name text, p_contact text, p_student text,
  p_item_type text, p_size text, p_house text, p_requester_house text,
  p_qty integer, p_note text, p_bin uuid
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  r public.ue_requests%rowtype;
  v_phone text := ue_phone(p_contact);
begin
  if btrim(coalesce(p_parent_name, '')) = '' then
    raise exception 'We need your name.';
  end if;
  if btrim(coalesce(p_student, '')) = '' then
    raise exception 'We need your student''s name — that''s who the bin holder is handing it to.';
  end if;
  if v_phone = '' then
    raise exception 'We need a cell number we can text — that''s how you get your item.';
  end if;

  insert into public.ue_requests
    (parent_name, contact, student, item_type, size, house, requester_house, qty, note, bin_id)
  values
    (btrim(p_parent_name), v_phone, btrim(p_student),
     p_item_type, p_size, coalesce(p_house, ''), coalesce(p_requester_house, ''),
     greatest(1, least(5, coalesce(p_qty, 1))), btrim(coalesce(p_note, '')), p_bin)
  returning * into r;

  return json_build_object(
    'id', r.id, 'status', r.status, 'item_type', r.item_type, 'size', r.size,
    'house', r.house, 'qty', r.qty, 'bin_id', r.bin_id, 'due_at', r.due_at,
    'my_url', ue_my_url(r.contact)
  );
end;
$$;
grant execute on function public.ue_create_request(text, text, text, text, text, text, text, integer, text, uuid) to anon, authenticated;

create or replace function public.ue_create_offer(
  p_parent_name text, p_contact text, p_house text, p_items_desc text, p_bin uuid
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  o public.ue_offers%rowtype;
  v_phone text := ue_phone(p_contact);
begin
  if btrim(coalesce(p_parent_name, '')) = '' then
    raise exception 'We need your name.';
  end if;
  if v_phone = '' then
    raise exception 'We need a cell number — it''s how your bin holder arranges the pickup.';
  end if;
  if btrim(coalesce(p_items_desc, '')) = '' then
    raise exception 'Tell us roughly what you have.';
  end if;

  insert into public.ue_offers (parent_name, contact, house, items_desc, bin_id)
  values (btrim(p_parent_name), v_phone, coalesce(p_house, ''),
          btrim(p_items_desc), p_bin)
  returning * into o;

  return json_build_object('id', o.id, 'status', o.status, 'bin_id', o.bin_id);
end;
$$;
grant execute on function public.ue_create_offer(text, text, text, text, uuid) to anon, authenticated;
