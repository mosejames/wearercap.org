-- ---------------------------------------------------------------------------
-- 0016_bin_holder_contact.sql
-- A bin IS a person. Each bin carries its holder's name, email, and phone,
-- and those contact points trigger actions: when a request is assigned to a
-- bin or a donation pickup lands on it, the HOLDER gets a text too - so
-- Shekita knows her bin is queued up without anyone reaching out directly.
-- ---------------------------------------------------------------------------

alter table public.ue_bins
  add column if not exists holder_email text not null default ''
    check (length(holder_email) <= 120),
  add column if not exists holder_phone text not null default ''
    check (length(holder_phone) <= 40);

-- New notification kinds for the holder side.
alter table public.ue_notifications
  drop constraint if exists ue_notifications_kind_check;
alter table public.ue_notifications
  add constraint ue_notifications_kind_check check (kind in
    ('request_received','request_waitlist','ready_at_desk','offer_received',
     'holder_request','holder_offer'));

-- ---------------------------------------------------------------------------
-- ue_admin_bin grows email/phone. The signature changes, so out with the old.
-- ---------------------------------------------------------------------------
drop function if exists public.ue_admin_bin(text, text, uuid, text, text, text, text, text);

create or replace function public.ue_admin_bin(
  p_pass text, p_action text, p_id uuid,
  p_code text default null, p_name text default null,
  p_holder_name text default null, p_holder_house text default null,
  p_holder_note text default null,
  p_holder_email text default null, p_holder_phone text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_id;
begin
  if p_pass is distinct from 'rcap2026' then
    raise exception 'Wrong passcode';
  end if;
  if p_action = 'create' then
    insert into public.ue_bins
      (code, name, holder_name, holder_house, holder_note, holder_email, holder_phone)
    values
      (upper(p_code), p_name, coalesce(p_holder_name,''), coalesce(p_holder_house,''),
       coalesce(p_holder_note,''), coalesce(p_holder_email,''), coalesce(p_holder_phone,''))
    returning id into v_id;
  elsif p_action = 'update' then
    update public.ue_bins set
      name         = coalesce(p_name, name),
      holder_name  = coalesce(p_holder_name, holder_name),
      holder_house = coalesce(p_holder_house, holder_house),
      holder_note  = coalesce(p_holder_note, holder_note),
      holder_email = coalesce(p_holder_email, holder_email),
      holder_phone = coalesce(p_holder_phone, holder_phone)
    where id = p_id;
  elsif p_action = 'retire' then
    update public.ue_bins set retired = true  where id = p_id;
  elsif p_action = 'restore' then
    update public.ue_bins set retired = false where id = p_id;
  else
    raise exception 'Unknown action';
  end if;
  return v_id;
end;
$$;

revoke all on function public.ue_admin_bin(text, text, uuid, text, text, text, text, text, text, text) from public;
grant execute on function public.ue_admin_bin(text, text, uuid, text, text, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Queue a text to a bin's holder.
-- ---------------------------------------------------------------------------
create or replace function public.ue_notify_holder(
  p_bin uuid, p_kind text, p_body_after text, p_request uuid, p_offer uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.ue_bins%rowtype;
  ph text;
begin
  select * into b from public.ue_bins where id = p_bin;
  if not found then return; end if;
  ph := ue_phone(b.holder_phone);
  if ph = '' then return; end if;
  insert into ue_notifications (kind, phone, body, request_id, offer_id)
  values (p_kind, ph,
    'RCAP Uniform Exchange (' || b.code || '): ' || p_body_after ||
    ' Your bin page: https://wearercap.org/uniform-exchange/#/bin/' || b.code,
    p_request, p_offer);
end;
$$;

-- Requests: the holder hears about it the moment it's assigned to their bin.
create or replace function public.ue_notify_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ph text := ue_phone(new.contact);
  item text := trim(ue_type_label(new.item_type) || ' ' ||
               case when new.house <> '' then '(' || ue_house_label(new.house) || ') ' else '' end ||
               '· ' || new.size);
begin
  if ph <> '' then
    if new.status = 'assigned' then
      insert into ue_notifications (kind, phone, body, request_id)
      values ('request_received', ph,
        'RCAP Uniform Exchange: we received your request for a ' || item ||
        '. It''ll be waiting at the RCA front desk by ' ||
        to_char(new.due_at at time zone 'America/New_York', 'Dy, Mon FMDD') ||
        ' - we''ll text you when it''s dropped off. Track it: https://wearercap.org/uniform-exchange/#/requests',
        new.id);
    else
      insert into ue_notifications (kind, phone, body, request_id)
      values ('request_waitlist', ph,
        'RCAP Uniform Exchange: we received your request for a ' || item ||
        '. Nothing in the bins right now, so you''re on the waitlist - the moment a match comes in ' ||
        'we''ll assign it and text you. Track it: https://wearercap.org/uniform-exchange/#/requests',
        new.id);
    end if;
  end if;

  if new.status = 'assigned' and new.bin_id is not null then
    perform ue_notify_holder(new.bin_id, 'holder_request',
      'a request is queued to your bin - ' || item || ' for ' || new.parent_name ||
      '. Please drop it at the RCA front desk by ' ||
      to_char(new.due_at at time zone 'America/New_York', 'Dy, Mon FMDD') || '.',
      new.id, null);
  end if;
  return new;
end;
$$;

-- Waitlist assignments notify the holder too.
create or replace function public.ue_assign_request(p_id uuid, p_bin uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.ue_requests%rowtype;
begin
  update public.ue_requests
  set status = 'assigned', bin_id = p_bin,
      assigned_at = now(), due_at = now() + interval '3 days'
  where id = p_id and status = 'open'
  returning * into r;
  if not found then raise exception 'Request not found or not open'; end if;

  perform ue_notify_holder(p_bin, 'holder_request',
    'a request is queued to your bin - ' ||
    trim(ue_type_label(r.item_type) || ' · ' || r.size) || ' for ' || r.parent_name ||
    '. Please drop it at the RCA front desk by ' ||
    to_char(r.due_at at time zone 'America/New_York', 'Dy, Mon FMDD') || '.',
    r.id, null);
end;
$$;

-- Offers: the holder hears there's a pickup to arrange.
create or replace function public.ue_notify_offer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ph text := ue_phone(new.contact);
  hl text := ue_house_label(new.house);
begin
  if ph <> '' then
    insert into ue_notifications (kind, phone, body, offer_id)
    values ('offer_received', ph,
      'RCAP Uniform Exchange: thank you! We got your donation offer' ||
      case when hl <> '' then ' and your ' || hl || ' bin holder' else ' and a bin holder' end ||
      ' will reach out to arrange pickup. - RCAP',
      new.id);
  end if;

  if new.bin_id is not null then
    perform ue_notify_holder(new.bin_id, 'holder_offer',
      new.parent_name ||
      case when new.contact <> '' then ' (' || new.contact || ')' else '' end ||
      ' has clothes for your bin: "' || left(new.items_desc, 120) ||
      '". Please reach out to arrange the pickup.',
      null, new.id);
  end if;
  return new;
end;
$$;
