-- ---------------------------------------------------------------------------
-- 0033_welcome_email_styled.sql — an email that looks like it came from us.
--
-- The welcome landed as a wall of plain text with one stray red button. Someone
-- who has never seen the Uniform Exchange had nothing to recognise it by, which
-- is exactly the wrong feeling for the message that hands them a private link
-- and asks them to trust it.
--
-- The shell now lives in the notify-send function (night header, the flame
-- under it, paper body, one clear button), so bodies stay plain text here —
-- they double as the text/plain part — with four markers the shell renders:
--
--   ## Heading            a section kicker
--   [Label](https://…)    the primary button
--   1. Step text          a numbered step with a big flame numeral
--   > Aside               quiet fine print
--
-- Any email added later inherits the same clothes for free.
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
      'Your bin holder page — RCAP Uniform Exchange',
      'Welcome to the RCAP Uniform Exchange, ' || first_name || '!' || E'\n\n' ||
      'Thank you for holding a bin. Uniforms that would have sat in a closet now get a ' ||
      'second run at RCA because of people doing exactly what you just signed up for.' || E'\n\n' ||
      'This is your own page. There''s no password — the link is the key, so keep this ' ||
      'email; it''s the easiest way to find your way back.' || E'\n\n' ||
      '[Open my bin holder page](' || link || ')' || E'\n\n' ||
      '## Three things to do when you open it' || E'\n\n' ||
      '1. Count what you already have. Under "My bins" there''s a grid — type roughly ' ||
      'what''s in the bin and hit save. Rough is fine; these are bins, not inventory systems.' || E'\n\n' ||
      '2. Say when you''re around. Under "My setup," tap the mornings that are easy for you ' ||
      'and add how a family will spot you at carline ("blue Highlander, I park by the gym"). ' ||
      'Handoffs happen at morning drop-off. You can also offer to send items in with your ' ||
      'own student, which skips the carpool line entirely.' || E'\n\n' ||
      '3. Then just watch for texts. When a family requests something from your bin, we text ' ||
      'you — what it is, who it''s for, and the morning they picked. Bag it, hand it over, ' ||
      'and tap "Handed it off." That''s the whole job.' || E'\n\n' ||
      '> This link is yours alone. Anyone who has it can see your queue and update your ' ||
      'counts, so keep it to yourself rather than posting it anywhere.' || E'\n\n' ||
      '— RCAP');
  end if;

  update public.ue_holders set welcomed_at = now() where id = p_id;
end;
$$;

-- The "here's your page again" text, and the admin's copy of it, get the same
-- treatment where they carry a link.
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
