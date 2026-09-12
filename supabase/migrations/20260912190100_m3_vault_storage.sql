-- M³ Vault media bucket. Applied September 12, 2026 (migration m3_vault_storage).
-- Supabase Storage is the on-ramp; R2 is the flip (env vars, see api/m3-sign.js).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('m3-media', 'm3-media', true, 52428800,
        array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/quicktime','video/webm'])
on conflict (id) do nothing;

create policy m3_media_read on storage.objects for select to public
  using (bucket_id = 'm3-media');

-- No sign-in, so the write gate is the key shape: only under the vault's own
-- prefix, only the three renditions per upload id. Nothing updates or deletes.
create policy m3_media_insert on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'm3-media'
    and name ~ '^m3-2028/[0-9a-f]{8}/[a-z0-9-]{1,60}/[0-9a-f-]{36}/(orig\.[a-z0-9]{2,5}|web\.jpg|thumb\.jpg)$'
  );
