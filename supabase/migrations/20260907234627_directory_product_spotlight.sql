begin;
alter table public.directory_listings
 add column product_name text not null default '' check(length(product_name) <= 100),
 add column product_description text not null default '' check(length(product_description) <= 400),
 add column product_url text not null default '' check(length(product_url) <= 500 and (product_url = '' or product_url ~* '^https?://[^[:space:]]+$')),
 add column product_photo text not null default '';
commit;
