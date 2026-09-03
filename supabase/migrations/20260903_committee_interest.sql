-- Committee interest, guided flow. Supersedes the flat-form table from Sept 2.
--
-- Progressive capture: the flow writes as soon as it has a name and an email,
-- then patches the same row on each later step, so a parent who drops out
-- halfway is still a lead. That needs an update path, and an update POLICY
-- would let any holder of the anon key edit any row. So the table gets no
-- policies and no grants at all, and every write goes through one
-- security-definer function keyed by a random per-browser token.
-- Same shape as recap_set_hidden.

create table if not exists public.committee_interest (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text, email text, phone text, house text,
  students jsonb not null default '[]'::jsonb,
  committees jsonb not null default '[]'::jsonb,
  chair_picks jsonb not null default '[]'::jsonb,
  idea text, notes text, one_off_help text
);

alter table public.committee_interest
  add column if not exists token text,
  add column if not exists personality jsonb not null default '[]'::jsonb,
  add column if not exists wants_to_lead boolean,
  add column if not exists status text not null default 'partial',
  add column if not exists updated_at timestamptz not null default now();

alter table public.committee_interest alter column name drop not null;
alter table public.committee_interest alter column email drop not null;

create unique index if not exists committee_interest_token_key
  on public.committee_interest (token);
create index if not exists committee_interest_status_idx
  on public.committee_interest (status, created_at desc);
create index if not exists committee_interest_created_idx
  on public.committee_interest (created_at desc);

alter table public.committee_interest enable row level security;
drop policy if exists "anyone can submit" on public.committee_interest;
revoke all on public.committee_interest from anon, authenticated;

create or replace function public.committee_interest_save(
  p_token text,
  p_patch jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or length(p_token) < 8 or length(p_token) > 100 then
    raise exception 'bad token';
  end if;

  insert into public.committee_interest as ci (
    token, name, email, phone, students, personality,
    committees, chair_picks, wants_to_lead, status, updated_at
  ) values (
    p_token,
    left(nullif(p_patch->>'name',''), 200),
    left(nullif(p_patch->>'email',''), 320),
    left(nullif(p_patch->>'phone',''), 40),
    coalesce(p_patch->'students','[]'::jsonb),
    coalesce(p_patch->'personality','[]'::jsonb),
    coalesce(p_patch->'committees','[]'::jsonb),
    coalesce(p_patch->'chair_picks','[]'::jsonb),
    (p_patch->>'wants_to_lead')::boolean,
    coalesce(nullif(p_patch->>'status',''),'partial'),
    now()
  )
  on conflict (token) do update set
    -- Only keys actually present in the patch move. A later step sending just
    -- {committees:[...]} must not blank out the name captured three steps ago.
    name          = case when p_patch ? 'name'          then left(p_patch->>'name',200)  else ci.name end,
    email         = case when p_patch ? 'email'         then left(p_patch->>'email',320) else ci.email end,
    phone         = case when p_patch ? 'phone'         then left(p_patch->>'phone',40)  else ci.phone end,
    students      = case when p_patch ? 'students'      then p_patch->'students'      else ci.students end,
    personality   = case when p_patch ? 'personality'   then p_patch->'personality'   else ci.personality end,
    committees    = case when p_patch ? 'committees'    then p_patch->'committees'    else ci.committees end,
    chair_picks   = case when p_patch ? 'chair_picks'   then p_patch->'chair_picks'   else ci.chair_picks end,
    wants_to_lead = case when p_patch ? 'wants_to_lead' then (p_patch->>'wants_to_lead')::boolean else ci.wants_to_lead end,
    -- Never walk a completed submission back to partial.
    status        = case when p_patch->>'status' = 'complete' then 'complete' else ci.status end,
    updated_at    = now();
end;
$$;

revoke all on function public.committee_interest_save(text, jsonb) from public;
grant execute on function public.committee_interest_save(text, jsonb) to anon, authenticated;
