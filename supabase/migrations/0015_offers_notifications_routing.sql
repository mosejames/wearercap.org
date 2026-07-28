-- ---------------------------------------------------------------------------
-- 0015_offers_notifications_routing.sql
-- Three things from Mose's walkthrough of how the exchange really works:
--   1. Requests route through the requester's HOUSE - relationships first.
--      Even neutral items (khakis) come from your own house's bin.
--   2. The other front door: offering clothes and arranging a pickup.
--   3. Automated text updates - an outbox the hourly messenger drains:
--      "we got your request", "your item is waiting at the front desk".
-- ---------------------------------------------------------------------------

-- The requester's house, used for routing and reporting.
alter table public.ue_requests
  add column if not exists requester_house text not null default ''
    check (requester_house in ('', 'altruismo','amistad','isibindi','reveur'));

-- ---------------------------------------------------------------------------
-- Donation offers - "I have clothes, come get them."
-- ---------------------------------------------------------------------------
create table if not exists public.ue_offers (
  id          uuid primary key default gen_random_uuid(),
  parent_name text not null check (length(btrim(parent_name)) between 1 and 60),
  contact     text not null default '' check (length(contact) <= 80),
  house       text not null default ''
                check (house in ('', 'altruismo','amistad','isibindi','reveur')),
  items_desc  text not null check (length(btrim(items_desc)) between 1 and 400),
  status      text not null default 'open'
                check (status in ('open','scheduled','collected','canceled')),
  bin_id      uuid references public.ue_bins (id),
  note        text not null default '' check (length(note) <= 200),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists ue_offers_status_idx on public.ue_offers (status, created_at desc);
create index if not exists ue_offers_bin_idx on public.ue_offers (bin_id, status);

alter table public.ue_offers enable row level security;
drop policy if exists ue_offers_read on public.ue_offers;
create policy ue_offers_read on public.ue_offers for select using (true);
drop policy if exists ue_offers_insert on public.ue_offers;
create policy ue_offers_insert on public.ue_offers for insert with check (true);

create or replace function public.ue_offer_update(
  p_id uuid, p_status text, p_bin uuid default null, p_note text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('open','scheduled','collected','canceled') then
    raise exception 'Unknown status';
  end if;
  update public.ue_offers
  set status = p_status,
      bin_id = coalesce(p_bin, bin_id),
      note = coalesce(p_note, note),
      updated_at = now()
  where id = p_id;
  if not found then raise exception 'Offer not found'; end if;
end;
$$;

revoke all on function public.ue_offer_update(uuid, text, uuid, text) from public;
grant execute on function public.ue_offer_update(uuid, text, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notifications outbox. Rows are written by triggers with the message fully
-- rendered; the hourly messenger just reads pending rows, texts them, and
-- marks them sent (via the notify-mark edge function - service role only,
-- there is no update policy and no open insert).
-- ---------------------------------------------------------------------------
create table if not exists public.ue_notifications (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in
               ('request_received','request_waitlist','ready_at_desk','offer_received')),
  phone      text not null,
  body       text not null,
  request_id uuid,
  offer_id   uuid,
  status     text not null default 'pending'
               check (status in ('pending','sent','failed','skipped')),
  detail     text not null default '',
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);

create index if not exists ue_notifications_status_idx
  on public.ue_notifications (status, created_at);

alter table public.ue_notifications enable row level security;
drop policy if exists ue_notifications_read on public.ue_notifications;
create policy ue_notifications_read on public.ue_notifications for select using (true);
-- No insert/update/delete policies: triggers write, service role marks.

-- Normalize a contact string to E.164 US, or '' if it isn't a texting number.
create or replace function public.ue_phone(p text)
returns text
language plpgsql immutable
as $$
declare
  d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
begin
  if length(d) = 10 then return '+1' || d; end if;
  if length(d) = 11 and left(d, 1) = '1' then return '+' || d; end if;
  return '';
end;
$$;

create or replace function public.ue_type_label(p text)
returns text
language sql immutable
as $$
  select case p
    when 'polo' then 'RCA polo'
    when 'dress-shirt' then 'white dress shirt'
    when 'sweater' then 'sweater'
    when 'vest' then 'vest'
    when 'house' then 'house apparel'
    when 'bottoms' then 'khaki bottoms'
    when 'ski' then 'ski gear'
    else coalesce(p, 'item')
  end;
$$;

create or replace function public.ue_house_label(p text)
returns text
language sql immutable
as $$
  select case p
    when 'altruismo' then 'Altruismo'
    when 'amistad' then 'Amistad'
    when 'isibindi' then 'Isibindi'
    when 'reveur' then 'Rêveur'
    else ''
  end;
$$;

-- "We received your request" - fired the moment a request lands.
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
  if ph = '' then return new; end if;
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
  return new;
end;
$$;

drop trigger if exists ue_notify_request on public.ue_requests;
create trigger ue_notify_request
  after insert on public.ue_requests
  for each row execute function public.ue_notify_request();

-- "Your donation offer is in" - and the house holder will reach out.
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
  if ph = '' then return new; end if;
  insert into ue_notifications (kind, phone, body, offer_id)
  values ('offer_received', ph,
    'RCAP Uniform Exchange: thank you! We got your donation offer' ||
    case when hl <> '' then ' and your ' || hl || ' bin holder' else ' and a bin holder' end ||
    ' will reach out to arrange pickup. - RCAP',
    new.id);
  return new;
end;
$$;

drop trigger if exists ue_notify_offer on public.ue_offers;
create trigger ue_notify_offer
  after insert on public.ue_offers
  for each row execute function public.ue_notify_offer();

-- Fulfillment now also queues the "waiting at the front desk" text.
create or replace function public.ue_fulfill_request(p_id uuid, p_actor text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.ue_requests%rowtype;
  ph text;
begin
  select * into r from public.ue_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'assigned' then raise exception 'Request is not open for fulfillment'; end if;
  if r.bin_id is null then raise exception 'Request has no bin'; end if;

  insert into public.ue_movements (bin_id, item_type, size, house, qty_delta, kind, actor_name, note, request_id)
  values (r.bin_id, r.item_type, r.size, r.house, -r.qty, 'fulfill',
          coalesce(nullif(btrim(p_actor), ''), r.parent_name),
          'Delivered to front desk for ' || r.parent_name, r.id);

  update public.ue_requests
  set status = 'fulfilled', fulfilled_at = now()
  where id = p_id;

  ph := ue_phone(r.contact);
  if ph <> '' then
    insert into ue_notifications (kind, phone, body, request_id)
    values ('ready_at_desk', ph,
      'RCAP Uniform Exchange: your ' || trim(ue_type_label(r.item_type) || ' · ' || r.size) ||
      ' is at the RCA front desk with your name on it (' || r.parent_name || '). Swing by any school day. - RCAP',
      r.id);
  end if;
end;
$$;
