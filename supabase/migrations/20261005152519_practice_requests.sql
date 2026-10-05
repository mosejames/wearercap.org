-- A practice submission is explicit, private, and never payable.
alter table public.cr_requests add column is_test boolean not null default false;

do $migration$
declare
 definition text := pg_get_functiondef('cr_private.mutate(text,jsonb)'::regprocedure);
 old_line text := $old$  update public.cr_requests set archive_email=lower(trim(coalesce(p_data->>'archive_email',''))) where id=rid;$old$;
 new_line text := $new$  update public.cr_requests set archive_email=lower(trim(coalesce(p_data->>'archive_email',''))) where id=rid;
  if r.id is null and coalesce((p_data->>'is_test')::boolean,false) then
   if not exists (
    select 1 from auth.users u where u.id=uid
     and u.email_confirmed_at is not null
     and lower(u.email)=lower(trim(coalesce(p_data->>'archive_email','')))
   ) then
    raise exception 'Practice requests require your verified account email.';
   end if;
   update public.cr_requests set is_test=true where id=rid;
   insert into cr_private.test_requests(request_id,recipient)
    values(rid,lower(trim(p_data->>'archive_email')));
  end if;$new$;
begin
 if position(old_line in definition)=0 then
  raise exception 'Could not locate the request submission hook.';
 end if;
 execute replace(definition,old_line,new_line);
end $migration$;

create function cr_private.label_practice_history() returns trigger
 language plpgsql security definer set search_path = '' as $$
begin
 if new.action in ('submitted','resubmitted') and exists (
  select 1 from public.cr_requests r where r.id=new.request_id and r.is_test
 ) then
  update public.cr_history set note='TEST ONLY. Practice request with no real purchase or payment.'
   where id=new.id;
 end if;
 return null;
end $$;
revoke all on function cr_private.label_practice_history() from public,anon,authenticated;
create trigger cr_label_practice_history after insert on public.cr_history
 for each row execute function cr_private.label_practice_history();
