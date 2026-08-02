-- ---------------------------------------------------------------------------
-- 0042_notify_channel.sql — text, email, or both. Their call.
--
-- A holder could already choose WHEN they heard (right away, or one round-up at
-- the end of the day) but not HOW. Everything was a text, whether or not that's
-- where they live. Some people read email and let texts pile up; some are the
-- other way round; a couple want both because the bin is a job and jobs get
-- forgotten.
--
-- So: a channel on the holder, honoured by every message the system sends them.
-- Falls back gracefully — asking for email with no address on file gets a text
-- rather than silence, which is the failure mode that actually loses a handoff.
-- ---------------------------------------------------------------------------

alter table public.ue_holders
  add column if not exists notify_channel text not null default 'sms'
    check (notify_channel in ('sms', 'email', 'both')),
  -- when we last suggested they go tell their people
  add column if not exists nudged_at timestamptz;

-- A subject line you can find again in six weeks by searching "RCAP".
create or replace function public.ue_notify_subject(p_kind text)
returns text
language sql immutable
as $$
  select case p_kind
    when 'holder_request'   then 'RCAP Uniform Exchange — a request for your bin'
    when 'holder_offer'     then 'RCAP Uniform Exchange — someone has clothes to drop off'
    when 'handoff_set'      then 'RCAP Uniform Exchange — a handoff is set'
    when 'handoff_done'     then 'RCAP Uniform Exchange — an item made it home'
    when 'contact_shared'   then 'RCAP Uniform Exchange — a number was shared with you'
    when 'holder_digest'    then 'RCAP Uniform Exchange — today''s round-up'
    when 'holder_nudge'     then 'RCAP Uniform Exchange — your bin has things waiting'
    else 'RCAP Uniform Exchange'
  end;
$$;

alter table public.ue_notifications drop constraint if exists ue_notifications_kind_check;
alter table public.ue_notifications add constraint ue_notifications_kind_check check (kind in
  ('request_received','request_waitlist','ready_at_desk','offer_received',
   'holder_request','holder_offer','handoff_set','handoff_sent','handoff_done',
   'access_link','holder_link','holder_welcome','holder_digest','holder_nudge',
   'handoff_moved','handoff_released','contact_shared'));

-- ---------------------------------------------------------------------------
-- Every message to a holder now goes out the way they asked for it.
-- ---------------------------------------------------------------------------
create or replace function public.ue_notify_holder(
  p_bin uuid, p_kind text, p_body_after text, p_request uuid, p_offer uuid
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  b public.ue_bins%rowtype;
  h public.ue_holders%rowtype;
  ph text; em text; ch text;
  body text; hold timestamptz;
begin
  select * into b from public.ue_bins where id = p_bin;
  if not found then return; end if;
  select * into h from public.ue_holders where id = b.holder_id;

  ph := ue_phone(coalesce(nullif(h.phone, ''), b.holder_phone));
  em := btrim(coalesce(h.email, ''));
  ch := coalesce(h.notify_channel, 'sms');

  -- Asking for something we can't send is how a handoff gets lost. Fall back
  -- to whatever we actually have rather than dropping it on the floor.
  if ch = 'email' and em = '' then ch := 'sms'; end if;
  if ch = 'sms' and ph = '' and em <> '' then ch := 'email'; end if;
  if ph = '' and em = '' then return; end if;

  -- End-of-day people get their messages parked; the sweeper rolls them into
  -- one round-up when the time comes.
  if coalesce(h.notify_mode, 'instant') = 'daily' then
    hold := ue_end_of_day();
  end if;

  body := 'RCAP Uniform Exchange (' || b.code || '): ' || p_body_after ||
          ' Your bin page: ' || ue_bin_url(b.code);

  if ch in ('sms', 'both') and ph <> '' then
    insert into ue_notifications (kind, channel, phone, body, request_id, offer_id, deliver_after)
    values (p_kind, 'sms', ph, body, p_request, p_offer, hold);
  end if;

  if ch in ('email', 'both') and em <> '' then
    insert into ue_notifications (kind, channel, email, phone, subject, body, request_id, offer_id, deliver_after)
    values (p_kind, 'email', em, '', ue_notify_subject(p_kind), body, p_request, p_offer, hold);
  end if;
end;
$$;

-- The round-up has to keep the two channels apart, or an email round-up and a
-- text round-up merge into one confused message addressed to nobody.
create or replace function public.ue_send_digests()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_sent integer := 0;
  v_lines text;
  v_count integer;
  v_link text;
  v_body text;
begin
  for r in
    select channel, coalesce(nullif(phone, ''), email) as who,
           max(phone) as phone, max(email) as email,
           array_agg(id) as ids
    from public.ue_notifications
    where status = 'pending' and deliver_after is not null and deliver_after <= now()
    group by channel, coalesce(nullif(phone, ''), email)
  loop
    select count(*), string_agg('• ' || regexp_replace(
             regexp_replace(body, '^RCAP Uniform Exchange \(([^)]*)\):\s*', '\1 · ', 'g'),
             '\s*Your bin page:.*$', '', 'g'), E'\n')
      into v_count, v_lines
    from public.ue_notifications
    where id = any(r.ids);

    select ue_holder_url(h.token) into v_link
    from public.ue_holders h
    where (r.phone <> '' and ue_phone(h.phone) = ue_phone(r.phone))
       or (r.phone = '' and btrim(lower(h.email)) = btrim(lower(r.email)))
    limit 1;

    v_body := 'RCAP Uniform Exchange — today''s round-up (' || v_count || ' update' ||
      case when v_count = 1 then '' else 's' end || '):' || E'\n' || v_lines || E'\n' ||
      case when r.channel = 'email'
           then '[Open my bin holder page](' || coalesce(v_link, 'https://wearercap.org/uniform-exchange/') || ')'
           else 'Open your page: ' || coalesce(v_link, 'https://wearercap.org/uniform-exchange/') end;

    if r.channel = 'email' then
      insert into public.ue_notifications (kind, channel, email, phone, subject, body)
      values ('holder_digest', 'email', r.email, '', ue_notify_subject('holder_digest'), v_body);
    else
      insert into public.ue_notifications (kind, phone, body)
      values ('holder_digest', r.phone, v_body);
    end if;

    update public.ue_notifications
    set status = 'skipped', detail = 'rolled into the daily round-up', sent_at = now()
    where id = any(r.ids);

    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;
grant execute on function public.ue_send_digests() to anon, authenticated;

create or replace function public.ue_holder_update_self(
  p_token text,
  p_phone text default null, p_email text default null,
  p_notify_mode text default null,
  p_special boolean default null, p_special_note text default null,
  p_photo_url text default null, p_max_days integer default null,
  p_notify_channel text default null
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
  if p_notify_channel is not null and p_notify_channel not in ('sms','email','both') then
    raise exception 'Unknown channel';
  end if;

  update public.ue_holders set
    phone = case when p_phone is null then phone else ue_tidy_phone(p_phone) end,
    email = case when p_email is null then email else btrim(lower(p_email)) end,
    notify_mode = coalesce(p_notify_mode, notify_mode),
    notify_channel = coalesce(p_notify_channel, notify_channel),
    special_arrangements = coalesce(p_special, special_arrangements),
    special_note = coalesce(btrim(p_special_note), special_note),
    photo_url = case when p_photo_url is null then photo_url else btrim(p_photo_url) end,
    max_handoff_days = coalesce(greatest(1, least(5, p_max_days)), max_handoff_days)
  where id = h_id;
end;
$$;
grant execute on function public.ue_holder_update_self(text, text, text, text, boolean, text, text, integer, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The nudge.
--
-- The way a swap dies is not that nobody wants the clothes. It's that a tub
-- gets handed to a willing parent, goes in a closet, and is never mentioned
-- again. So once a fortnight, a holder sitting on stock that nobody has asked
-- for gets a poke — and something to paste, written from what's actually in
-- their bins.
--
-- Only if they have things. Only if it's been quiet. Never more than once
-- every fourteen days.
-- ---------------------------------------------------------------------------
create or replace function public.ue_nudge_holders()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select h.id, h.name, h.token, h.house,
           (select coalesce(sum(v.qty), 0)
            from public.ue_inventory v
            join public.ue_bins b on b.id = v.bin_id
            where b.holder_id = h.id) as on_hand
    from public.ue_holders h
    where h.active
      and (h.nudged_at is null or h.nudged_at < now() - interval '14 days')
      -- quiet: nothing has moved in or out of their bins in a fortnight
      and not exists (
        select 1 from public.ue_movements m
        join public.ue_bins b on b.id = m.bin_id
        where b.holder_id = h.id and m.created_at > now() - interval '14 days'
      )
      -- and nobody is waiting on them right now
      and not exists (
        select 1 from public.ue_requests q
        join public.ue_bins b on b.id = q.bin_id
        where b.holder_id = h.id and q.status in ('assigned','scheduled','handed_off')
      )
  loop
    if r.on_hand < 3 then continue; end if;

    perform ue_notify_holder_direct(
      r.id, 'holder_nudge',
      'Your bin has about ' || r.on_hand || ' items in it and it''s been quiet for a couple of weeks. ' ||
      'Most families still don''t know the exchange exists — one message in your house group chat ' ||
      'usually clears a shelf. There''s a post written for you on your page, ready to copy: ' ||
      ue_holder_url(r.token));

    update public.ue_holders set nudged_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;
grant execute on function public.ue_nudge_holders() to anon, authenticated;

-- Same channel rules, but addressed to a holder rather than to one of their bins.
create or replace function public.ue_notify_holder_direct(
  p_holder uuid, p_kind text, p_body text
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  h public.ue_holders%rowtype;
  ph text; em text; ch text;
begin
  select * into h from public.ue_holders where id = p_holder;
  if not found then return; end if;

  ph := ue_phone(h.phone);
  em := btrim(coalesce(h.email, ''));
  ch := coalesce(h.notify_channel, 'sms');
  if ch = 'email' and em = '' then ch := 'sms'; end if;
  if ch = 'sms' and ph = '' and em <> '' then ch := 'email'; end if;
  if ph = '' and em = '' then return; end if;

  if ch in ('sms', 'both') and ph <> '' then
    insert into ue_notifications (kind, channel, phone, body)
    values (p_kind, 'sms', ph, 'RCAP Uniform Exchange: ' || p_body);
  end if;
  if ch in ('email', 'both') and em <> '' then
    insert into ue_notifications (kind, channel, email, phone, subject, body)
    values (p_kind, 'email', em, '', ue_notify_subject(p_kind), p_body);
  end if;
end;
$$;
grant execute on function public.ue_notify_holder_direct(uuid, text, text) to anon, authenticated;

grant select (notify_channel) on public.ue_holders to anon, authenticated;
