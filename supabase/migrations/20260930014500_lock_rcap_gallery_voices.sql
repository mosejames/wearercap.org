create policy vault_gallery_voices_no_direct_access
  on public.vault_gallery_voices
  for all
  using (false)
  with check (false);
