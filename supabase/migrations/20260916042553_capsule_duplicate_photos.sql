-- Exact source-file fingerprints, scoped to an event. Nullable for legacy clients
-- and historical uploads; their originals can be fingerprinted without changing them.
alter table public.vault_photos add column content_hash text
  check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$');
create unique index vault_photos_event_content_hash_key
  on public.vault_photos(event_id, content_hash)
  where house = 'rcap' and content_hash is not null and removed_at is null;

-- Only return matches for the supplied fingerprints, using existing photo RLS.
create function public.vault_duplicate_hashes(p_event uuid, p_hashes text[])
returns setof text language sql stable security invoker set search_path = '' as $$
  select distinct p.content_hash from public.vault_photos p
  where auth.uid() is not null and p.event_id = p_event and p.house = 'rcap'
    and p.removed_at is null and p.content_hash = any(p_hashes[1:200]);
$$;
revoke all on function public.vault_duplicate_hashes(uuid,text[]) from public, anon;
grant execute on function public.vault_duplicate_hashes(uuid,text[]) to authenticated;
