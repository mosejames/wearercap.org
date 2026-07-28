-- ---------------------------------------------------------------------------
-- 0028_special_with_availability.sql — "I'll arrange another time" is a way of
-- handing something over, not a notification preference. It belongs beside
-- carline and student-to-student, so the availability functions carry it.
-- ---------------------------------------------------------------------------

create or replace function public.ue_holder_availability(
  p_id uuid,
  p_offers_carline boolean default null, p_offers_student boolean default null,
  p_days integer[] default null, p_when text default null,
  p_spot text default null, p_student text default null,
  p_special boolean default null, p_special_note text default null
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.ue_holders set
    offers_carline = coalesce(p_offers_carline, offers_carline),
    offers_student = coalesce(p_offers_student, offers_student),
    carline_days   = coalesce(p_days, carline_days),
    carline_when   = coalesce(p_when, carline_when),
    carline_spot   = coalesce(p_spot, carline_spot),
    student        = coalesce(p_student, student),
    special_arrangements = coalesce(p_special, special_arrangements),
    special_note   = coalesce(btrim(p_special_note), special_note),
    availability_set_at = now()
  where id = p_id;
  if not found then raise exception 'Holder not found'; end if;
end;
$$;

create or replace function public.ue_holder_availability_by_token(
  p_token text,
  p_offers_carline boolean default null, p_offers_student boolean default null,
  p_days integer[] default null, p_when text default null,
  p_spot text default null, p_student text default null,
  p_special boolean default null, p_special_note text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare h_id uuid;
begin
  select id into h_id from public.ue_holders where token = p_token;
  if h_id is null then raise exception 'Not your page'; end if;
  perform ue_holder_availability(h_id, p_offers_carline, p_offers_student,
                                 p_days, p_when, p_spot, p_student,
                                 p_special, p_special_note);
end;
$$;

grant execute on function public.ue_holder_availability(uuid, boolean, boolean, integer[], text, text, text, boolean, text) to anon, authenticated;
grant execute on function public.ue_holder_availability_by_token(text, boolean, boolean, integer[], text, text, text, boolean, text) to anon, authenticated;

-- Drop the older signatures so PostgREST can't pick an ambiguous overload.
drop function if exists public.ue_holder_availability(uuid, boolean, boolean, integer[], text, text, text);
drop function if exists public.ue_holder_availability_by_token(text, boolean, boolean, integer[], text, text, text);

-- The bin-page path forwards the new fields too.
create or replace function public.ue_bin_availability(
  p_id uuid,
  p_offers_carline boolean default null, p_offers_student boolean default null,
  p_days integer[] default null, p_when text default null,
  p_spot text default null, p_holder_student text default null,
  p_special boolean default null, p_special_note text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_holder uuid;
begin
  select holder_id into v_holder from public.ue_bins where id = p_id;
  if v_holder is null then raise exception 'Bin has no holder yet'; end if;
  perform ue_holder_availability(v_holder, p_offers_carline, p_offers_student,
                                 p_days, p_when, p_spot, p_holder_student,
                                 p_special, p_special_note);
end;
$$;
grant execute on function public.ue_bin_availability(uuid, boolean, boolean, integer[], text, text, text, boolean, text) to anon, authenticated;
drop function if exists public.ue_bin_availability(uuid, boolean, boolean, integer[], text, text, text);
