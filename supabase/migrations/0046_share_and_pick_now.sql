-- ---------------------------------------------------------------------------
-- 0046_share_and_pick_now.sql — pick the handoff before you leave the page,
-- and let the holder just text you.
--
-- Two families never answered "pick a time." The text almost certainly went
-- to an unknown-senders list they never look at. So the page now walks them
-- straight from "sent" into "how do you want it" (front-end), and the texts
-- stop reading as if the site is waiting on a reply.
--
-- And a holder who'd rather just text a family can, if the family said so on
-- the form — which is now the default, with the box there to untick. It's a
-- volunteer parent with a bag of clothes, not a stranger. The holder's own
-- number stays theirs to share, exactly as before.
-- ---------------------------------------------------------------------------

drop function if exists public.ue_create_request(text, text, text, text, text, text, text, integer, text, uuid);

create function public.ue_create_request(
  p_parent_name text, p_contact text, p_student text,
  p_item_type text, p_size text, p_house text, p_requester_house text,
  p_qty integer, p_note text, p_bin uuid,
  p_share boolean default true
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  r public.ue_requests%rowtype;
  v_phone text := ue_phone(p_contact);
  v_max integer;
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

  select max_qty into v_max from public.ue_item_types where id = p_item_type;
  v_max := greatest(1, coalesce(v_max, 1));

  insert into public.ue_requests
    (parent_name, contact, student, item_type, size, house, requester_house, qty, note, bin_id,
     family_shared)
  values
    (btrim(p_parent_name), v_phone, btrim(p_student),
     p_item_type, p_size, coalesce(p_house, ''), coalesce(p_requester_house, ''),
     greatest(1, least(v_max, coalesce(p_qty, 1))), btrim(coalesce(p_note, '')), p_bin,
     coalesce(p_share, true))
  returning * into r;

  return json_build_object(
    'id', r.id, 'status', r.status, 'item_type', r.item_type, 'size', r.size,
    'house', r.house, 'qty', r.qty, 'bin_id', r.bin_id, 'due_at', r.due_at,
    'my_url', ue_my_url(r.contact)
  );
end;
$$;
grant execute on function public.ue_create_request(text, text, text, text, text, text, text, integer, text, uuid, boolean) to anon, authenticated;

-- The first texts. The family's no longer says "pick a time" as if the site
-- is waiting on them — they're doing that on the page right now — but the
-- link is still there for anyone who bailed. The holder's carries the
-- family's cell when the family said that's fine.
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
    select coalesce(nullif(h.name, ''), b.holder_name, '') into hn
    from public.ue_bins b left join public.ue_holders h on h.id = b.holder_id
    where b.id = new.bin_id;
  end if;

  if ph <> '' then
    link := ue_my_url(new.contact);
    if new.status = 'assigned' then
      insert into ue_notifications (kind, phone, body, request_id)
      values ('request_received', ph,
        'RCAP Uniform Exchange: we found your ' || item ||
        case when hn <> '' then ' — ' || hn || ' has it' else '' end ||
        '. Your requests page (set up or change the handoff here any time): ' || link,
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
      case when coalesce(new.student, '') <> '' then ' (' || new.student || ')' else '' end ||
      '. They''re choosing how to get it now.' ||
      case when new.family_shared and ph <> ''
           then ' They said it''s fine to text them: ' || ue_phone_pretty(ph) || '.'
           else '' end,
      new.id, null);
  end if;
  return new;
end;
$$;
