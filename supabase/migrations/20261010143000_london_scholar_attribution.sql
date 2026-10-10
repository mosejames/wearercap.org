-- Keep the scholar's attribution separate from the adult account that owns media.
alter table public.m3_photos add column if not exists scholar_name text not null default '';
alter table public.m3_photos add constraint m3_photos_scholar_name_length check (length(scholar_name)<=40);
