begin;
create table public.directory_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 100),
  bio text not null default '' check (length(bio) <= 600),
  category text not null check (category in ('Arts, Books & Handmade','Beauty & Personal Care','Business & Professional Services','Coaching & Consulting','Education & Tutoring','Events, Music & Entertainment','Food & Catering','Health & Therapy','Home & Real Estate','Shopping & Retail','Sports & Fitness','Technology & Media','Travel & Experiences','Other')),
  venture text not null default 'parent' check (venture in ('parent','student')),
  email text not null default '' check (length(email) <= 254 and (email = '' or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  phone text not null default '' check (length(phone) <= 40),
  website text not null default '' check (length(website) <= 500 and (website = '' or website ~* '^https?://[^[:space:]]+$')),
  connect_url text not null default '' check (length(connect_url) <= 500 and (connect_url = '' or connect_url ~* '^https?://[^[:space:]]+$')),
  location text not null default '' check (length(location) <= 100),
  photos text[] not null default '{}' check (cardinality(photos) <= 5 and array_position(photos, null) is null),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint directory_ready_to_publish check (not published or (length(btrim(bio)) > 0 and length(btrim(email || phone || website || connect_url)) > 0))
);
create index directory_owner_idx on public.directory_listings(owner_id);
create index directory_published_name_idx on public.directory_listings(name) where published;
alter table public.directory_listings enable row level security;
grant select on public.directory_listings to anon, authenticated;
grant insert, update, delete on public.directory_listings to authenticated;
create policy "Published businesses are discoverable" on public.directory_listings for select to anon, authenticated using (published);
create policy "Owners can read their drafts" on public.directory_listings for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Owners create their listings" on public.directory_listings for insert to authenticated with check ((select auth.uid()) = owner_id and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
create policy "Owners edit their listings" on public.directory_listings for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Owners remove their listings" on public.directory_listings for delete to authenticated using ((select auth.uid()) = owner_id);
create function public.directory_validate_photos() returns trigger language plpgsql set search_path = '' as $$
declare photo text;
begin
  foreach photo in array new.photos loop
    if photo not like new.owner_id::text || '/' || new.id::text || '/%' then
      raise exception 'Listing photos must belong to this owner and listing';
    end if;
  end loop;
  new.updated_at = now();
  return new;
end;
$$;
create trigger directory_validate_before_write before insert or update on public.directory_listings for each row execute function public.directory_validate_photos();
revoke all on function public.directory_validate_photos() from public;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('directory-photos', 'directory-photos', false, 5242880, array['image/jpeg','image/png','image/webp']);
create policy "Owners upload directory photos" on storage.objects for insert to authenticated with check (bucket_id = 'directory-photos' and (storage.foldername(name))[1] = (select auth.uid())::text and not coalesce((select auth.jwt()->>'is_anonymous')::boolean, false));
create policy "Owners read directory photos" on storage.objects for select to authenticated using (bucket_id = 'directory-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Published listing photos are viewable" on storage.objects for select to anon, authenticated using (bucket_id = 'directory-photos' and exists (select 1 from public.directory_listings l where l.published and storage.objects.name = any(l.photos)));
create policy "Owners remove directory photos" on storage.objects for delete to authenticated using (bucket_id = 'directory-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
