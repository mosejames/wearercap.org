-- Jr., Sr., II, III, IV and friends are not the surname: Mose James IV is
-- Mose J., not Mose I. Existing wall names are recomputed.
create or replace function public.event_wall_name(p_full text)
returns text language plpgsql immutable set search_path = ''
as $$
declare parts text[]; n int;
begin
  parts := regexp_split_to_array(btrim(regexp_replace(coalesce(p_full,''), '\s+', ' ', 'g')), ' ');
  n := coalesce(array_length(parts, 1), 0);
  if n = 0 or parts[1] = '' then return ''; end if;
  while n > 2 and lower(regexp_replace(parts[n], '[.,]', '', 'g')) in ('jr','sr','ii','iii','iv','v','vi','esq','phd','md') loop
    n := n - 1;
  end loop;
  if n = 1 then return parts[1]; end if;
  return parts[1] || ' ' || upper(left(parts[n], 1)) || '.';
end;
$$;
update public.event_rsvps set wall_name = public.event_wall_name(full_name)
  where wall_name is distinct from public.event_wall_name(full_name);
