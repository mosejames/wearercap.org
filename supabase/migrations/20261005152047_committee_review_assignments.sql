-- One committee setting applies to both requester payment types.
alter table public.cr_approval_routes
 add column backup_email text references public.cr_staff(email);
alter table public.cr_approval_route_history
 add column old_backup text,
 add column new_backup text;

create function cr_private.require_independent_route() returns trigger
 language plpgsql security definer set search_path = '' as $$
begin
 if exists (
  select 1 from public.cr_staff s
  where s.email in (new.approver_email, new.backup_email)
    and (s.role not in ('board', 'secretary', 'manager') or s.name = 'RCA Parents')
 ) then
  raise exception 'Choose a board reviewer, not the treasurer.';
 end if;
 if new.backup_email = new.approver_email or exists (
  select 1 from public.cr_staff a join public.cr_staff b on a.name = b.name
  where a.email = new.approver_email and b.email = new.backup_email
 ) then
  raise exception 'The backup must be a different person.';
 end if;
 return new;
end $$;
revoke all on function cr_private.require_independent_route() from public, anon, authenticated;
create trigger cr_independent_route before insert or update on public.cr_approval_routes
 for each row execute function cr_private.require_independent_route();

create function cr_private.require_independent_request_reviewer() returns trigger
 language plpgsql security definer set search_path = '' as $$
begin
 if new.approver_email is distinct from old.approver_email and
    new.approver_email is not null and exists (
     select 1 from public.cr_staff where email = new.approver_email
      and (role = 'treasurer' or name = 'RCA Parents')
    ) then
  raise exception 'The treasurer cannot be assigned to approve a request.';
 end if;
 if old.approver_email is not null and new.approver_email is null and
    new.status = 'submitted' then
  raise exception 'Assign another board reviewer before removing the current one.';
 end if;
 return new;
end $$;
revoke all on function cr_private.require_independent_request_reviewer() from public, anon, authenticated;
create trigger cr_independent_request_reviewer before update on public.cr_requests
 for each row execute function cr_private.require_independent_request_reviewer();

create function cr_private.block_treasurer_decision() returns trigger
 language plpgsql security definer set search_path = '' as $$
begin
 -- A collective board vote is separate from an assigned review decision.
 if new.action in ('approved', 'declined') and
    coalesce(new.note, '') not like 'Board vote:%' and
    exists (select 1 from public.cr_staff where email = new.actor_email and role = 'treasurer') then
  raise exception 'The treasurer cannot approve or decline a request. Assign a board reviewer.';
 end if;
 return new;
end $$;
revoke all on function cr_private.block_treasurer_decision() from public, anon, authenticated;
create trigger cr_no_treasurer_decision before insert on public.cr_history
 for each row execute function cr_private.block_treasurer_decision();

-- Preserve each notification's recipient and full detail. Only correct the
-- submission wording for requests that still need a reviewer assignment.
do $migration$
declare
 definition text := pg_get_functiondef('cr_private.queue_notice(uuid,text)'::regprocedure);
 old_label text := $old$received and awaiting the treasurer''s review$old$;
 new_label text := $new$received and awaiting finance staff to assign a board reviewer$new$;
begin
 if position(old_label in definition)=0 then
  raise exception 'Could not locate the unassigned request notice wording.';
 end if;
 execute replace(definition,old_label,new_label);
end $migration$;

create function cr_private.save_committee_assignment(
 p_committee text, p_approver text, p_backup text, p_active boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 who text := cr_private.email();
 primary_contact text := nullif(lower(trim(coalesce(p_approver, ''))), '');
 backup_contact text := nullif(lower(trim(coalesce(p_backup, ''))), '');
 kind text;
 previous public.cr_approval_routes;
begin
 if auth.uid() is null or who is null or
   coalesce(cr_private.role(), '') not in ('treasurer', 'secretary', 'manager') then
  raise exception 'Finance settings access is required.';
 end if;
 if length(trim(coalesce(p_committee, ''))) not between 2 and 100 then
  raise exception 'Choose a committee.';
 end if;
 if coalesce(p_active, false) then
  if primary_contact is null then raise exception 'Choose a primary board reviewer.'; end if;
  if not exists (
   select 1 from public.cr_staff where email = primary_contact
    and role in ('board', 'secretary', 'manager') and name <> 'RCA Parents'
  ) then raise exception 'Choose a board reviewer with access.'; end if;
  if backup_contact is not null and not exists (
   select 1 from public.cr_staff where email = backup_contact
    and role in ('board', 'secretary', 'manager') and name <> 'RCA Parents'
  ) then raise exception 'Choose a backup reviewer with access.'; end if;
 end if;
 for kind in select unnest(array['reimbursement', 'vendor']) loop
  select * into previous from public.cr_approval_routes
   where committee = trim(p_committee) and request_type = kind for update;
  if coalesce(p_active, false) then
   insert into public.cr_approval_routes
    (committee, request_type, approver_email, backup_email, updated_by)
   values (trim(p_committee), kind, primary_contact, backup_contact, who)
   on conflict (committee, request_type) do update set
    approver_email = excluded.approver_email,
    backup_email = excluded.backup_email,
    updated_by = excluded.updated_by,
    updated_at = now();
  else
   delete from public.cr_approval_routes
    where committee = trim(p_committee) and request_type = kind;
  end if;
  if previous.approver_email is distinct from
      (case when p_active then primary_contact else null end)
   or previous.backup_email is distinct from
      (case when p_active then backup_contact else null end) then
   insert into public.cr_approval_route_history
    (committee, request_type, old_approver, new_approver,
     old_backup, new_backup, actor_email)
   values (trim(p_committee), kind, previous.approver_email,
    case when p_active then primary_contact else null end,
    previous.backup_email,
    case when p_active then backup_contact else null end, who);
  end if;
 end loop;
 return jsonb_build_object('saved', true);
end $$;
revoke all on function cr_private.save_committee_assignment(text,text,text,boolean)
 from public, anon;
grant execute on function cr_private.save_committee_assignment(text,text,text,boolean)
 to authenticated;

create function public.cr_save_committee_assignment(
 p_committee text, p_approver text, p_backup text, p_active boolean
) returns jsonb language sql security invoker set search_path = '' as $$
 select cr_private.save_committee_assignment(p_committee, p_approver, p_backup, p_active);
$$;
revoke all on function public.cr_save_committee_assignment(text,text,text,boolean)
 from public, anon;
grant execute on function public.cr_save_committee_assignment(text,text,text,boolean)
 to authenticated;

-- Existing submitted requests can be assigned from their detail view. Make
-- that audit entry describe an unassigned request accurately.
do $migration$
declare
 definition text := pg_get_functiondef('cr_private.reassign_approver(uuid,integer,text,text)'::regprocedure);
 old_label text := $old$coalesce(old_name,'the treasurer')$old$;
 new_label text := $new$coalesce(old_name,'no reviewer')$new$;
 old_notice text := $old$'RCAP request #'||r.reference||' is now assigned to '||new_label||'. You no longer need to approve it.');
  end loop;
 else$old$;
 new_notice text := $new$'RCAP request #'||r.reference||' is now assigned to '||new_label||'. Finance can monitor it until approval.');
  end loop;
 else$new$;
begin
 if position(old_label in definition)=0 or position(old_notice in definition)=0 then
  raise exception 'Could not locate the existing reassignment wording.';
 end if;
 definition := replace(definition,old_label,new_label);
 definition := replace(definition,old_notice,new_notice);
 execute definition;
end $migration$;
