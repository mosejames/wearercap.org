-- Delete via the Storage API so the underlying media file is removed.
create policy "Thankful moderators delete submissions"
on storage.objects for delete to authenticated
using (
  bucket_id in ('thankful-message-photos', 'thankful-at-rca')
  and (select thankful_private.can_moderate())
);

create function thankful_private.remove_deleted_submission() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.bucket_id = 'thankful-message-photos' and old.name ~ '^[0-9a-f-]{36}/photo$' then
    delete from public.thankful_messages where id::text || '/photo' = old.name;
  elsif old.bucket_id = 'thankful-at-rca' then
    delete from public.thankful_published_videos where path = old.name;
  end if;
  return old;
end;
$$;

revoke all on function thankful_private.remove_deleted_submission() from public, anon, authenticated;

create trigger thankful_remove_deleted_submission
after delete on storage.objects for each row
when (old.bucket_id in ('thankful-message-photos', 'thankful-at-rca'))
execute function thankful_private.remove_deleted_submission();
