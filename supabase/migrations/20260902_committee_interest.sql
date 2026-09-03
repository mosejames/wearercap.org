-- Committee interest and chair applications, submitted from /committeeinterest.
create table if not exists public.committee_interest (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text,
  house text,
  students jsonb not null default '[]'::jsonb,
  committees jsonb not null default '[]'::jsonb,
  chair_picks jsonb not null default '[]'::jsonb,
  idea text,
  notes text,
  one_off_help text
);

alter table public.committee_interest enable row level security;

-- Anyone with the QR code can submit.
drop policy if exists "anyone can submit" on public.committee_interest;
create policy "anyone can submit"
  on public.committee_interest for insert
  to anon, authenticated
  with check (true);

-- No select, update, or delete policy on purpose. This table holds parent phone
-- numbers and chair applications. The board reads it in the SQL editor or via
-- an export, never from the browser with the anon key.

create index if not exists committee_interest_created_idx
  on public.committee_interest (created_at desc);
