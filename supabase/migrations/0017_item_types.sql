-- ---------------------------------------------------------------------------
-- 0017_item_types.sql
-- Item types move out of the code and into the database, so the admin can
-- hide a type (kept for history, out of the dropdowns) or bring it back
-- later without a deploy. Per Mose, July 28:
--   RCA Polo -> "RCA House Polo" · sweaters and house apparel are not part
--   of the uniform (hide) · bottoms split into khaki pants / shorts / skirt
--   · ski and other hidden for now.
-- ---------------------------------------------------------------------------

create table if not exists public.ue_item_types (
  id     text primary key check (id ~ '^[a-z][a-z0-9-]{1,29}$'),
  label  text not null check (length(btrim(label)) between 1 and 50),
  housed boolean not null default false,  -- house picker defaults to a house
  hidden boolean not null default false,  -- out of dropdowns, kept for history
  sort   integer not null default 100
);

alter table public.ue_item_types enable row level security;
drop policy if exists ue_item_types_read on public.ue_item_types;
create policy ue_item_types_read on public.ue_item_types for select using (true);
-- No open writes: the admin function below is the only path.

insert into public.ue_item_types (id, label, housed, hidden, sort) values
  ('polo',        'RCA House Polo',                true,  false, 10),
  ('dress-shirt', 'White Dress Shirt',             false, false, 20),
  ('vest',        'Vest',                          true,  false, 30),
  ('pants',       'Khaki Pants',                   false, false, 40),
  ('shorts',      'Khaki Shorts',                  false, false, 50),
  ('skirt',       'Khaki Skirt',                   false, false, 60),
  ('sweater',     'Sweater / Cardigan',            true,  true,  70),
  ('house',       'House Apparel / Swag',          true,  true,  80),
  ('bottoms',     'Khaki Bottoms (Hilfiger only)', false, true,  90),
  ('ski',         'Ski Apparel / Gear',            false, true,  100),
  ('other',       'Other',                         false, true,  110)
on conflict (id) do update set
  label = excluded.label, housed = excluded.housed,
  hidden = excluded.hidden, sort = excluded.sort;

create or replace function public.ue_admin_item_type(
  p_pass text, p_id text,
  p_label text default null, p_housed boolean default null,
  p_hidden boolean default null, p_sort integer default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pass is distinct from 'rcap2026' then
    raise exception 'Wrong passcode';
  end if;
  insert into public.ue_item_types (id, label, housed, hidden, sort)
  values (p_id, coalesce(p_label, p_id), coalesce(p_housed, false),
          coalesce(p_hidden, false), coalesce(p_sort, 100))
  on conflict (id) do update set
    label  = coalesce(p_label,  ue_item_types.label),
    housed = coalesce(p_housed, ue_item_types.housed),
    hidden = coalesce(p_hidden, ue_item_types.hidden),
    sort   = coalesce(p_sort,   ue_item_types.sort);
end;
$$;

revoke all on function public.ue_admin_item_type(text, text, text, boolean, boolean, integer) from public;
grant execute on function public.ue_admin_item_type(text, text, text, boolean, boolean, integer) to anon, authenticated;

-- Text bodies pick up the live labels too.
create or replace function public.ue_type_label(p text)
returns text
language sql stable
as $$
  select coalesce((select label from public.ue_item_types where id = p), p, 'item');
$$;
