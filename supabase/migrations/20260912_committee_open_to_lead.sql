alter table public.committee_interest
  add column if not exists open_to_lead boolean not null default false;
