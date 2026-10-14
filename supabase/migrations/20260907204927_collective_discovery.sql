begin;
alter table public.directory_listings
  add column house text not null default '' check (house in ('', 'amistad', 'isibindi', 'reveur', 'altruismo')),
  add column reach text not null default 'local' check (reach in ('local', 'worldwide')),
  add column offers text[] not null default '{}' check (offers <@ array['mentor', 'speaker', 'internship', 'collaborate']::text[] and cardinality(offers) <= 4 and array_position(offers, null) is null),
  add column community_perk text not null default '' check (length(community_perk) <= 160),
  add column collaboration_note text not null default '' check (length(collaboration_note) <= 280);
comment on column public.directory_listings.house is 'Optional owner-selected house affiliation, not an official verification.';
comment on column public.directory_listings.offers is 'Owner-offered opportunities. Contact is arranged directly using the business contact details.';
commit;
