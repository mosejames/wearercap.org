-- ---------------------------------------------------------------------------
-- 0031_link_previews.sql — links that say where they go.
--
-- Every link this system sends is a hash link, and a fragment never reaches
-- the server. So the scraper that builds a message preview only ever saw the
-- one static page: a private holder page, a bin, a family's request list and
-- the front door all came up with the same picture and the same headline. Sent
-- to a volunteer, it told her nothing about what she'd been sent.
--
-- Short real paths fix it — they land on a small function that answers with
-- tags written for that destination, then bounces the visitor into the app.
-- Old `#/…` links keep working, printed QR labels included, so nothing already
-- in a text message or on a bin lid breaks.
-- ---------------------------------------------------------------------------

create or replace function public.ue_holder_url(p_token text)
returns text language sql immutable as $$
  select 'https://wearercap.org/uniform-exchange/h/' || coalesce(p_token, '');
$$;

create or replace function public.ue_bin_url(p_code text)
returns text language sql immutable as $$
  select 'https://wearercap.org/uniform-exchange/b/' || upper(coalesce(p_code, ''));
$$;

-- A family's own list.
create or replace function public.ue_my_url(p_phone text)
returns text
language plpgsql security definer set search_path = public
as $$
declare v_tok text := ue_token_for(p_phone);
begin
  if v_tok = '' then return 'https://wearercap.org/uniform-exchange/'; end if;
  return 'https://wearercap.org/uniform-exchange/m/' || v_tok;
end;
$$;
revoke all on function public.ue_my_url(text) from public, anon, authenticated;

-- The bin holder's page, texted by the admin.
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
    ue_holder_url(h.token) || ' (just for you, no password)');
end;
$$;
grant execute on function public.ue_admin_text_holder_link(text, uuid) to anon, authenticated;

-- ...and the same page, asked for by the holder at the door.
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
    ue_holder_url(h.token) || ' (just for you; no password needed)');
end;
$$;
grant execute on function public.ue_holder_request_link(text) to anon, authenticated;

-- Every text to a holder about their bin.
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
    ' Your bin page: ' || ue_bin_url(b.code),
    p_request, p_offer, hold);
end;
$$;

-- The welcome, unchanged but for the link it carries.
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

  link := ue_holder_url(h.token);
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
