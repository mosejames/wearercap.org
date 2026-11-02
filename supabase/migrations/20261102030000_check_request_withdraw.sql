-- Requesters can withdraw their own request until it is approved.
-- Withdrawal follows the duplicate precedent: the request closes with status
-- 'declined' and a distinct 'withdrawn' history entry, so queues, reminders,
-- votes, payment gates and the treasurer ledger keep working unchanged.
-- Nothing is deleted: receipts, history and PDF archives remain.

do $migration$
declare
 definition text := pg_get_functiondef('cr_private.mutate(text,jsonb)'::regprocedure);
 old_guard text := $old$ and p_action<>'duplicate' then raise exception 'You cannot review your own request.'; end if;$old$;
 new_guard text := $new$ and p_action not in ('duplicate','withdraw') then raise exception 'You cannot review your own request.'; end if;$new$;
 old_branch text := $old$  elsif p_action='duplicate' then$old$;
 new_branch text := $new$  elsif p_action='withdraw' then
   -- Only the person who submitted (or prepared) the request may pull it back.
   if r.owner_id<>uid then raise exception 'Only the person who submitted this request can withdraw it.'; end if;
   if r.status not in ('submitted','board_review','needs_changes') then raise exception 'Only a request that has not been approved can be withdrawn.'; end if;
   update public.cr_requests set status='declined',version=version+1,updated_at=now() where id=rid;
   action_label:='withdrawn';
   note:='Withdrawn by the requester.'||case when note<>'' then ' '||note else '' end;
  elsif p_action='duplicate' then$new$;
begin
 if position(old_guard in definition)=0 or position(old_branch in definition)=0 then
  raise exception 'Could not locate the request action wording.';
 end if;
 if position($probe$p_action='withdraw'$probe$ in definition)>0 then
  raise exception 'Withdraw is already defined.';
 end if;
 definition := replace(definition, old_guard, new_guard);
 definition := replace(definition, old_branch, new_branch);
 execute definition;
end $migration$;

-- Notices: plain wording, and the treasurer hears about a withdrawal along
-- with the assigned reviewer, the configured board list and the requester.
do $migration$
declare
 definition text := pg_get_functiondef('cr_private.queue_notice(uuid,text)'::regprocedure);
 old_label text := $old$  when 'needs_changes' then 'reviewed; changes are needed'$old$;
 new_label text := $new$  when 'withdrawn' then 'withdrawn by the requester. No approval or payment is needed'
  when 'needs_changes' then 'reviewed; changes are needed'$new$;
 old_target text := $old$(s.role='treasurer' and p_action in ('submitted','resubmitted','board_review','approved'))$old$;
 new_target text := $new$(s.role='treasurer' and p_action in ('submitted','resubmitted','board_review','approved','withdrawn'))$new$;
begin
 if position(old_label in definition)=0 or position(old_target in definition)=0 then
  raise exception 'Could not locate the notice wording.';
 end if;
 definition := replace(definition, old_label, new_label);
 definition := replace(definition, old_target, new_target);
 execute definition;
end $migration$;

-- The permanent PDF record captures the withdrawal like any other close.
do $migration$
declare
 definition text := pg_get_functiondef('cr_private.queue_archive()'::regprocedure);
 old_list text := $old$('submitted','resubmitted','approved','declined','paid','needs_changes','duplicate')$old$;
 new_list text := $new$('submitted','resubmitted','approved','declined','paid','needs_changes','duplicate','withdrawn')$new$;
begin
 if position(old_list in definition)=0 then
  raise exception 'Could not locate the archive actions.';
 end if;
 execute replace(definition, old_list, new_list);
end $migration$;
