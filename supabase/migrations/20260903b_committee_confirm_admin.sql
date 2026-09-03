-- Confirmation email state, and the back-office read.

alter table public.committee_interest
  add column if not exists confirm_sent_at timestamptz,
  add column if not exists confirm_error text;

-- Back office. Same shape and passcode as the Recap and Uniform Exchange
-- admins: the check happens in the database, so a leaked anon key alone buys
-- nothing. The token is stripped from every row on the way out — it is a write
-- credential for that parent's submission and the back office has no use for
-- it, so it should never reach a browser.
create or replace function public.committee_interest_admin(p_pass text)
returns setof jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pass is distinct from 'rcap2026' then
    raise exception 'Wrong passcode';
  end if;
  return query
    select to_jsonb(ci) - 'token'
    from public.committee_interest ci
    order by ci.created_at desc;
end;
$$;

revoke all on function public.committee_interest_admin(text) from public;
grant execute on function public.committee_interest_admin(text) to anon, authenticated;
