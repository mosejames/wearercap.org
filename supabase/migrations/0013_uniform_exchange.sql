-- ---------------------------------------------------------------------------
-- 0013_uniform_exchange.sql — The RCAP Uniform Exchange
-- QR-coded bins in parents' hands, a searchable inventory, and a request
-- queue with a three-day front-desk deadline. Counts are approximate on
-- purpose: inventory is the running sum of logged movements, never a number
-- anyone has to get exactly right.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Bins. Each physical bin gets a short code that lives inside its QR link:
-- https://wearercap.org/uniform-exchange/#/bin/<code>
-- ---------------------------------------------------------------------------
create table if not exists public.ue_bins (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique
                  check (code ~ '^[A-Z0-9][A-Z0-9-]{1,19}$'),
  name          text not null check (length(btrim(name)) between 1 and 60),
  holder_name   text not null default '' check (length(holder_name) <= 60),
  holder_house  text not null default ''
                  check (holder_house in ('', 'altruismo','amistad','isibindi','reveur')),
  holder_note   text not null default '' check (length(holder_note) <= 200),
  retired       boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Movements. The single source of truth. Adding five medium polos after a
-- scan is +5; handing one to the front desk for a request is -1. A bin's
-- inventory is just the sum, so nobody ever has to reconcile a count —
-- approximate in, approximate out.
-- ---------------------------------------------------------------------------
create table if not exists public.ue_movements (
  id          uuid primary key default gen_random_uuid(),
  bin_id      uuid not null references public.ue_bins (id),
  item_type   text not null check (length(btrim(item_type)) between 1 and 40),
  size        text not null check (length(btrim(size)) between 1 and 20),
  qty_delta   integer not null check (qty_delta between -99 and 99 and qty_delta <> 0),
  kind        text not null check (kind in ('add','remove','fulfill','adjust')),
  actor_name  text not null default '' check (length(actor_name) <= 60),
  note        text not null default '' check (length(note) <= 200),
  request_id  uuid,
  created_at  timestamptz not null default now()
);

create index if not exists ue_movements_bin_idx
  on public.ue_movements (bin_id, created_at desc);
create index if not exists ue_movements_item_idx
  on public.ue_movements (item_type, size);

-- Live inventory, per bin, per item and size. Floor at zero in the client;
-- the raw sum is kept honest here so drift is visible in the admin view.
create or replace view public.ue_inventory as
  select bin_id, item_type, size, sum(qty_delta)::int as qty
  from public.ue_movements
  group by bin_id, item_type, size;

-- ---------------------------------------------------------------------------
-- Requests. A parent asks for an item; the app assigns it to a bin that has
-- one; the bin holder has three days to drop it at the RCA front desk.
-- ---------------------------------------------------------------------------
create table if not exists public.ue_requests (
  id           uuid primary key default gen_random_uuid(),
  parent_name  text not null check (length(btrim(parent_name)) between 1 and 60),
  contact      text not null default '' check (length(contact) <= 80),
  student      text not null default '' check (length(student) <= 60),
  item_type    text not null check (length(btrim(item_type)) between 1 and 40),
  size         text not null check (length(btrim(size)) between 1 and 20),
  qty          integer not null default 1 check (qty between 1 and 5),
  note         text not null default '' check (length(note) <= 200),
  status       text not null default 'open'
                 check (status in ('open','assigned','fulfilled','canceled')),
  bin_id       uuid references public.ue_bins (id),
  assigned_at  timestamptz,
  due_at       timestamptz,
  fulfilled_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists ue_requests_status_idx
  on public.ue_requests (status, created_at desc);
create index if not exists ue_requests_bin_idx
  on public.ue_requests (bin_id, status);

-- A request inserted with a bin is assigned on the spot and the three-day
-- clock starts in the database, not the browser.
create or replace function public.ue_requests_assign_defaults()
returns trigger
language plpgsql
as $$
begin
  if new.bin_id is not null and new.assigned_at is null then
    new.status      := 'assigned';
    new.assigned_at := now();
    new.due_at      := now() + interval '3 days';
  end if;
  return new;
end;
$$;

drop trigger if exists ue_requests_assign_defaults on public.ue_requests;
create trigger ue_requests_assign_defaults
  before insert on public.ue_requests
  for each row execute function public.ue_requests_assign_defaults();

-- ---------------------------------------------------------------------------
-- Row level security. Reads and inserts are open on the anon key, matching
-- the rest of the site: nothing here is sensitive, and friction kills
-- community tools. There are NO update or delete policies — every change of
-- state runs through the functions below, so history can't be edited from
-- a browser.
-- ---------------------------------------------------------------------------
alter table public.ue_bins      enable row level security;
alter table public.ue_movements enable row level security;
alter table public.ue_requests  enable row level security;

drop policy if exists ue_bins_read on public.ue_bins;
create policy ue_bins_read on public.ue_bins for select using (true);

drop policy if exists ue_movements_read on public.ue_movements;
create policy ue_movements_read on public.ue_movements for select using (true);
drop policy if exists ue_movements_insert on public.ue_movements;
create policy ue_movements_insert on public.ue_movements for insert with check (true);

drop policy if exists ue_requests_read on public.ue_requests;
create policy ue_requests_read on public.ue_requests for select using (true);
drop policy if exists ue_requests_insert on public.ue_requests;
create policy ue_requests_insert on public.ue_requests for insert with check (true);

-- ---------------------------------------------------------------------------
-- Fulfilling a request writes the outgoing movement and closes the request
-- in one transaction, so the log and the queue can never disagree.
-- ---------------------------------------------------------------------------
create or replace function public.ue_fulfill_request(p_id uuid, p_actor text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.ue_requests%rowtype;
begin
  select * into r from public.ue_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'assigned' then raise exception 'Request is not open for fulfillment'; end if;
  if r.bin_id is null then raise exception 'Request has no bin'; end if;

  insert into public.ue_movements (bin_id, item_type, size, qty_delta, kind, actor_name, note, request_id)
  values (r.bin_id, r.item_type, r.size, -r.qty, 'fulfill',
          coalesce(nullif(btrim(p_actor), ''), r.parent_name),
          'Delivered to front desk for ' || r.parent_name, r.id);

  update public.ue_requests
  set status = 'fulfilled', fulfilled_at = now()
  where id = p_id;
end;
$$;

create or replace function public.ue_cancel_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ue_requests
  set status = 'canceled'
  where id = p_id and status in ('open','assigned');
  if not found then raise exception 'Request not found or already closed'; end if;
end;
$$;

-- An open (waitlisted) request gets a bin later, from the bin page or admin.
create or replace function public.ue_assign_request(p_id uuid, p_bin uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ue_requests
  set status = 'assigned', bin_id = p_bin,
      assigned_at = now(), due_at = now() + interval '3 days'
  where id = p_id and status = 'open';
  if not found then raise exception 'Request not found or not open'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin runs through one function with the passcode checked in the database
-- (same pattern and passcode as the Recap back office).
-- ---------------------------------------------------------------------------
create or replace function public.ue_admin_bin(
  p_pass text, p_action text, p_id uuid,
  p_code text default null, p_name text default null,
  p_holder_name text default null, p_holder_house text default null,
  p_holder_note text default null
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
    insert into public.ue_bins (code, name, holder_name, holder_house, holder_note)
    values (upper(p_code), p_name, coalesce(p_holder_name,''), coalesce(p_holder_house,''), coalesce(p_holder_note,''))
    returning id into v_id;
  elsif p_action = 'update' then
    update public.ue_bins set
      name         = coalesce(p_name, name),
      holder_name  = coalesce(p_holder_name, holder_name),
      holder_house = coalesce(p_holder_house, holder_house),
      holder_note  = coalesce(p_holder_note, holder_note)
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

revoke all on function public.ue_fulfill_request(uuid, text)  from public;
revoke all on function public.ue_cancel_request(uuid)         from public;
revoke all on function public.ue_assign_request(uuid, uuid)   from public;
revoke all on function public.ue_admin_bin(text, text, uuid, text, text, text, text, text) from public;
grant execute on function public.ue_fulfill_request(uuid, text)  to anon, authenticated;
grant execute on function public.ue_cancel_request(uuid)         to anon, authenticated;
grant execute on function public.ue_assign_request(uuid, uuid)   to anon, authenticated;
grant execute on function public.ue_admin_bin(text, text, uuid, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Starter bins — the four house bins, matching the swap contacts published at
-- the March 2025 meeting. Edit holders any time from the admin page.
-- ---------------------------------------------------------------------------
insert into public.ue_bins (code, name, holder_name, holder_house) values
  ('ALT-1', 'Altruismo Bin', 'Yelena Gaston',  'altruismo'),
  ('AMI-1', 'Amistad Bin',   'Shekita James',  'amistad'),
  ('ISI-1', 'Isibindi Bin',  'Kya Williams',   'isibindi'),
  ('REV-1', 'Rêveur Bin',    'Sidney Welch',   'reveur')
on conflict (code) do nothing;
