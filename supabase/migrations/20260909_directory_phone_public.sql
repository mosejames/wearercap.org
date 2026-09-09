-- Phone becomes required on the form so RCAP can always reach a lister, but it
-- is private unless they choose otherwise. Email stays the guaranteed public
-- channel, so every listing always has one visible way to be contacted.
alter table public.directory_listings
  add column if not exists phone_public boolean not null default false;
