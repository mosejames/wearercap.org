alter function public.cr_notification_preference(text) set schema cr_private;
create function public.cr_notification_preference(p_channel text default null) returns jsonb language sql security invoker set search_path='' as $$ select cr_private.cr_notification_preference(p_channel); $$;
revoke all on function public.cr_notification_preference(text) from public,anon;
grant execute on function public.cr_notification_preference(text) to authenticated;
