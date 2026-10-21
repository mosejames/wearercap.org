-- Count visible NYC images independently of the gallery's loading limit.
create function trip_private.photo_count() returns bigint language sql stable security definer set search_path='' as $$select count(*) from trip_private.photos where vault='nyc-2026' and not hidden$$;
create function public.trip_photo_count() returns bigint language sql security invoker set search_path='' as $$select trip_private.photo_count()$$;
revoke all on function trip_private.photo_count(),public.trip_photo_count() from public,anon,authenticated;
grant execute on function trip_private.photo_count(),public.trip_photo_count() to anon,authenticated;
notify pgrst,'reload schema';
