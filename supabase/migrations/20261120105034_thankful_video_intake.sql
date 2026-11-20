insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'thankful-at-rca', 'thankful-at-rca', false, 52428800,
  array['video/mp4', 'video/quicktime', 'video/webm']
);

create policy "Thankful families submit videos"
on storage.objects for insert to anon, authenticated
with check (
  bucket_id = 'thankful-at-rca'
  and name ~ '^2026/(growth|moment|surprise|people|belonging|lesson)/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](mp4|mov|webm)$'
);
