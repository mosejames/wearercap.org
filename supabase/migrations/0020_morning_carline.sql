-- ---------------------------------------------------------------------------
-- 0020_morning_carline.sql — handoffs happen at MORNING carline.
-- Afternoon pickup is a different animal: everyone is leaving at once, kids
-- are in the car, and nobody can stop. Mornings are calmer. Anything outside
-- morning carline is a special arrangement the two families make themselves,
-- so the app doesn't offer it yet.
--
-- The column and its check stay put, so afternoons can come back with one
-- default change if we ever want them.
-- ---------------------------------------------------------------------------

alter table public.ue_holders alter column carline_when set default 'am';
alter table public.ue_bins    alter column carline_when set default 'am';

update public.ue_holders set carline_when = 'am' where carline_when <> 'am';
update public.ue_bins    set carline_when = 'am' where carline_when <> 'am';

-- Slot wording follows suit: with mornings only, the label just says carline.
create or replace function public.ue_slot_label(p_date date, p_slot text, p_mode text)
returns text
language sql immutable
as $$
  select case
    when p_mode = 'student' then 'student to student'
    when p_date is null then 'a time to be picked'
    else to_char(p_date, 'Dy, Mon FMDD') ||
         case p_slot when 'pm' then ' afternoon carline'
                     else ' morning carline' end
  end;
$$;
