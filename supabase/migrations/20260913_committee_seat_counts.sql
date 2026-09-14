-- Seat counts per committee, for capped teams like the Audit Team.
--
-- The table has no grants, so the form cannot count rows itself. This returns
-- only (committee id, count of complete submissions that picked it). No names,
-- no emails, no tokens. Anon can call it.

create or replace function public.committee_seat_counts()
returns table (committee text, n integer)
language sql
security definer
set search_path = public
stable
as $$
  select c.value #>> '{}' as committee, count(*)::int as n
  from public.committee_interest ci
  cross join lateral jsonb_array_elements(ci.committees) as c(value)
  where ci.status = 'complete'
  group by 1;
$$;

revoke all on function public.committee_seat_counts() from public;
grant execute on function public.committee_seat_counts() to anon, authenticated;
