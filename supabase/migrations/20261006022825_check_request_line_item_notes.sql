-- Append finance notes to a specific expense without changing the submitted
-- receipt, approved amount, or payment record. The existing history read policy
-- makes the note visible to anyone with access to its request.
alter table public.cr_history
 add column item_index integer check (item_index >= 0);

create function cr_private.add_item_note(
 p_id uuid, p_item_index integer, p_note text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 r public.cr_requests;
 actor text := cr_private.email();
 content text := trim(coalesce(p_note, ''));
 entry public.cr_history;
begin
 if auth.uid() is null or actor is null or
    coalesce(cr_private.role(), '') not in ('treasurer', 'secretary', 'manager') then
  raise exception 'Finance access is required to add an expense note.';
 end if;
 select * into r from public.cr_requests where id = p_id for share;
 if r.id is null then raise exception 'Request not found.'; end if;
 if r.status not in ('approved', 'paid') then
  raise exception 'Expense notes can be added after approval.';
 end if;
 if p_item_index is null or p_item_index < 0 or
    p_item_index >= jsonb_array_length(r.items) then
  raise exception 'Choose an expense on this request.';
 end if;
 if length(content) not between 1 and 1000 then
  raise exception 'Enter a note of up to 1,000 characters.';
 end if;
 insert into public.cr_history(request_id, actor_email, action, note, item_index)
 values (p_id, actor, 'item_note',
  'Expense ' || (p_item_index + 1)::text || ': ' || content, p_item_index)
 returning * into entry;
 return to_jsonb(entry);
end $$;
revoke all on function cr_private.add_item_note(uuid, integer, text)
 from public, anon;
grant execute on function cr_private.add_item_note(uuid, integer, text)
 to authenticated;

create function public.cr_add_item_note(
 p_id uuid, p_item_index integer, p_note text
) returns jsonb language sql security invoker set search_path = '' as $$
 select cr_private.add_item_note(p_id, p_item_index, p_note);
$$;
revoke all on function public.cr_add_item_note(uuid, integer, text)
 from public, anon;
grant execute on function public.cr_add_item_note(uuid, integer, text)
 to authenticated;
