-- ---------------------------------------------------------------------------
-- 0030_holder_bins.sql — a holder arrives with a bin already waiting.
--
-- Adding a volunteer used to leave them on a page that said "no bins assigned
-- to you yet" — nothing to count, nothing to print, nothing to do. The whole
-- point of saying yes is that you're taking a bin, so the bin should exist the
-- moment the person does.
--
-- And once they have one, the rest is theirs: rename it to whatever they
-- actually call it, and add a second when the first fills up. None of that
-- needs the admin passcode — their token already proves who they are.
-- ---------------------------------------------------------------------------

-- ALT-1, AMI-2, REV-3 … house prefix, then the next free number. Codes are
-- printed on physical labels, so this only ever hands out unused ones and
-- never renumbers anything already in the world.
create or replace function public.ue_next_bin_code(p_house text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  pre text;
  nxt integer;
begin
  pre := case lower(coalesce(p_house, ''))
           when 'altruismo' then 'ALT'
           when 'amistad'   then 'AMI'
           when 'isibindi'  then 'ISI'
           when 'reveur'    then 'REV'
           else 'BIN'
         end;

  select coalesce(max((regexp_replace(code, '^' || pre || '-', ''))::integer), 0) + 1
    into nxt
  from public.ue_bins
  where code ~ ('^' || pre || '-[0-9]+$');

  -- Belt and braces: if something non-standard already squats on the code,
  -- keep stepping until it's free.
  while exists (select 1 from public.ue_bins where code = pre || '-' || nxt) loop
    nxt := nxt + 1;
  end loop;

  return pre || '-' || nxt;
end;
$$;

-- One place that makes a bin for a person, used by the trigger and by the
-- holder's own "add a bin" button.
create or replace function public.ue_make_bin(
  p_holder uuid, p_name text default null, p_focus text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  h public.ue_holders%rowtype;
  v_id uuid;
  v_name text;
begin
  select * into h from public.ue_holders where id = p_holder;
  if not found then raise exception 'Holder not found'; end if;

  v_name := nullif(btrim(coalesce(p_name, '')), '');
  if v_name is null then
    -- "Shekita's bin" reads better than a second "Amistad Bin" once a house
    -- has more than one volunteer. They can rename it in one tap anyway.
    v_name := split_part(btrim(h.name), ' ', 1) || '''s bin';
  end if;

  insert into public.ue_bins (code, name, holder_id, focus, holder_name, holder_house)
  values (ue_next_bin_code(h.house), left(v_name, 60), h.id,
          left(coalesce(btrim(p_focus), ''), 40), h.name, coalesce(h.house, ''))
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- New holder, new bin. Fires before ue_holder_welcome_insert (Postgres runs
-- same-event triggers in name order), so the welcome text goes out to someone
-- who already has something to open.
-- ---------------------------------------------------------------------------
create or replace function public.ue_holder_first_bin_trigger()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  perform ue_make_bin(new.id, null, null);
  return new;
end;
$$;

drop trigger if exists ue_holder_first_bin on public.ue_holders;
create trigger ue_holder_first_bin
  after insert on public.ue_holders
  for each row execute function public.ue_holder_first_bin_trigger();

-- Anyone already on file without a bin gets theirs now.
do $$
declare r record;
begin
  for r in
    select h.id from public.ue_holders h
    where h.active
      and not exists (select 1 from public.ue_bins b where b.holder_id = h.id)
  loop
    perform ue_make_bin(r.id, null, null);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Theirs to name, theirs to add to. Token-gated, and scoped to bins they
-- actually carry — the same guard ue_holder_set_inventory uses.
-- ---------------------------------------------------------------------------
create or replace function public.ue_holder_add_bin(
  p_token text, p_name text default null, p_focus text default null
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  h public.ue_holders%rowtype;
  v_id uuid;
  n integer;
begin
  select * into h from public.ue_holders where token = p_token;
  if not found then raise exception 'Not your page'; end if;

  select count(*) into n from public.ue_bins where holder_id = h.id and not retired;
  if n >= 12 then raise exception 'That is a lot of bins — email hello@wearercap.org and we will sort it out'; end if;

  v_id := ue_make_bin(h.id, p_name, p_focus);
  return (select json_build_object('id', b.id, 'code', b.code, 'name', b.name, 'focus', b.focus)
          from public.ue_bins b where b.id = v_id);
end;
$$;
grant execute on function public.ue_holder_add_bin(text, text, text) to anon, authenticated;

-- While we're here: the admin shouldn't have to invent a code either. Leave it
-- blank and the next one in that holder's house is used.
create or replace function public.ue_admin_bin2(
  p_pass text, p_action text, p_id uuid default null,
  p_code text default null, p_name text default null,
  p_holder_id uuid default null, p_focus text default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid := p_id;
  v_name text;
  v_house text;
begin
  if p_pass is distinct from 'rcap2026' then raise exception 'Wrong passcode'; end if;
  select name, house into v_name, v_house from public.ue_holders where id = p_holder_id;

  if p_action = 'create' then
    insert into public.ue_bins (code, name, holder_id, focus, holder_name, holder_house)
    values (coalesce(nullif(upper(btrim(coalesce(p_code, ''))), ''), ue_next_bin_code(v_house)),
            p_name, p_holder_id, coalesce(p_focus, ''),
            coalesce(v_name, ''), coalesce(v_house, ''))
    returning id into v_id;
  elsif p_action = 'update' then
    update public.ue_bins set
      name        = coalesce(p_name, name),
      holder_id   = coalesce(p_holder_id, holder_id),
      focus       = coalesce(p_focus, focus),
      holder_name = coalesce(v_name, holder_name)
    where id = p_id;
  elsif p_action = 'retire' then
    update public.ue_bins set retired = true where id = p_id;
  elsif p_action = 'restore' then
    update public.ue_bins set retired = false where id = p_id;
  else
    raise exception 'Unknown action';
  end if;
  return v_id;
end;
$$;
revoke all on function public.ue_admin_bin2(text, text, uuid, text, text, uuid, text) from public;
grant execute on function public.ue_admin_bin2(text, text, uuid, text, text, uuid, text) to anon, authenticated;

create or replace function public.ue_holder_rename_bin(
  p_token text, p_bin uuid, p_name text default null, p_focus text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare h_id uuid;
begin
  select id into h_id from public.ue_holders where token = p_token;
  if h_id is null then raise exception 'Not your page'; end if;
  if not exists (select 1 from public.ue_bins where id = p_bin and holder_id = h_id) then
    raise exception 'That is not one of your bins';
  end if;
  if p_name is not null and btrim(p_name) = '' then
    raise exception 'A bin needs a name';
  end if;

  update public.ue_bins set
    name  = coalesce(left(btrim(p_name), 60), name),
    focus = case when p_focus is null then focus else left(btrim(p_focus), 40) end
  where id = p_bin;
end;
$$;
grant execute on function public.ue_holder_rename_bin(text, uuid, text, text) to anon, authenticated;
