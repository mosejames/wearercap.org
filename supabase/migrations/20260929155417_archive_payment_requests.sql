alter table public.cr_requests add column archived_at timestamptz;
create function cr_private.archive_request(p_id uuid,p_version integer,p_archive boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.cr_requests; result jsonb;
begin
 if auth.uid() is null or coalesce(cr_private.role(),'') not in ('manager','secretary') then raise exception 'Administrator access required.'; end if;
 select * into r from public.cr_requests where id=p_id for update;
 if r.id is null or r.version<>p_version then raise exception 'Request changed. Refresh and try again.'; end if;
 if p_archive is null then raise exception 'Choose archive or restore.'; end if;
 update public.cr_requests set archived_at=case when p_archive then now() else null end, version=version+1,updated_at=now() where id=p_id returning to_jsonb(cr_requests.*) into result;
 insert into public.cr_history(request_id,actor_email,action,note) values(p_id,cr_private.email(),case when p_archive then 'archived' else 'restored' end,case when p_archive then 'Removed from the active queue and totals. Original status and history retained.' else 'Returned to the active queue with its original status.' end);
 return result;
end $$;
revoke all on function cr_private.archive_request(uuid,integer,boolean) from public,anon;
grant execute on function cr_private.archive_request(uuid,integer,boolean) to authenticated;
create function public.cr_archive_request(p_id uuid,p_version integer,p_archive boolean) returns jsonb language sql security invoker set search_path='' as $$ select cr_private.archive_request(p_id,p_version,p_archive); $$;
revoke all on function public.cr_archive_request(uuid,integer,boolean) from public,anon;
grant execute on function public.cr_archive_request(uuid,integer,boolean) to authenticated;
create function cr_private.guard_archived_request() returns trigger language plpgsql set search_path='' as $$
begin
 if old.archived_at is not null and new.archived_at is not null then raise exception 'Restore this archived request before making changes.'; end if;
 return new;
end $$;
create trigger cr_guard_archived_request before update on public.cr_requests for each row execute function cr_private.guard_archived_request();
-- Preserve the deployed reminder implementation while excluding archived requests.
do $$ declare d text; begin
 d:=pg_get_functiondef('cr_private.queue_approval_reminders()'::regprocedure);
 d:=replace(d,'where status=''submitted''','where archived_at is null and status=''submitted''');
 execute d;
 d:=pg_get_functiondef('public.cr_claim_notifications(text)'::regprocedure);
 d:=replace(d,'where r.status=''submitted''','where r.archived_at is null and r.status=''submitted''');
 execute d;
end $$;
