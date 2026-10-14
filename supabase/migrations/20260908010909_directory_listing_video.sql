begin;
alter table public.directory_listings add column video text not null default '' check(video='' or video like owner_id::text || '/' || id::text || '/%');
update storage.buckets set file_size_limit=52428800, allowed_mime_types=array['image/jpeg','image/png','image/webp','video/mp4','video/webm'] where id='directory-photos';
create policy "Published listing videos are viewable" on storage.objects for select to anon, authenticated using(bucket_id='directory-photos' and exists(select 1 from public.directory_listings l where l.published and l.video=storage.objects.name));
commit;
