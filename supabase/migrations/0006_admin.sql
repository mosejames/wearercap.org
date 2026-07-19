-- 0006: admin moderation RPCs for the carpool admin panel.
--
-- The schema deliberately defines NO DELETE policies on members or families
-- (see the closing comment in 0002): under RLS, deletes on those tables are
-- denied for everyone. These two SECURITY DEFINER functions are therefore the
-- ONLY paths by which a members or families row is ever deleted, and every
-- guard lives INSIDE the function body — SECURITY DEFINER bypasses RLS, so
-- nothing outside these bodies is checking anything. Do not add DELETE
-- policies to members/families "for convenience"; that would create a second,
-- unguarded path around these guards.
--
-- Conventions (same as 0005, keep them all):
--   * search_path pinned to public, pg_temp — SECURITY DEFINER without a
--     pinned search_path can be hijacked via objects in a caller-controlled
--     schema.
--   * revoke from PUBLIC **and** anon, then grant to authenticated —
--     Supabase's default privileges grant EXECUTE to anon even after
--     `revoke ... from public`, so the anon revoke is not redundant.
--   * caller checks inside the function (is_admin() first, always).
--   * row locks with FOR UPDATE so two admins acting on the same member at
--     the same moment resolve cleanly instead of interleaving.
--
-- FK layout that shapes both bodies: families.user_id, memberships.user_id,
-- and join_requests.user_id all reference auth.users(id), NOT members. So
-- deleting a members row cascades to NOTHING — every dependent row must be
-- deleted explicitly here, or it silently survives.

-- decline_signup(target): remove a pending signup entirely (member row plus
-- family row if they got that far). The admin-panel flow is reach-out first,
-- decline second; no notification fires on decline (0004 defines no DELETE
-- triggers on members/families, by design).
create or replace function public.decline_signup(target uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.members%rowtype;
begin
  -- Caller gate. is_admin() tests the CALLER (auth.uid()), never the target.
  if not public.is_admin() then
    raise exception 'Only admins can decline a signup';
  end if;

  -- Lock the target row. FOR UPDATE means two admins clicking Decline (or a
  -- Decline racing an Approve, which is an UPDATE on the same row) serialize:
  -- the loser re-reads the committed row and falls into the clear error
  -- below instead of half-acting on stale state.
  select * into m from public.members where user_id = target for update;
  if not found then
    raise exception 'That signup no longer exists';
  end if;

  -- Structural rule: an admin can never act on another admin. Since the
  -- caller must be an admin, this also makes self-decline impossible.
  -- Demoting or removing an admin stays a manual-SQL operation, on purpose.
  if m.role = 'admin' then
    raise exception 'An admin account cannot be declined';
  end if;

  -- Only PENDING signups are declinable. Deleting an approved family must be
  -- two deliberate steps — unapprove_member() first, then decline — never
  -- one tap. Do not "simplify" this by letting decline handle approved rows.
  if m.approval = 'approved' then
    raise exception 'That family is approved; un-approve them first';
  end if;

  -- Cleanup, most-dependent first. memberships and join_requests are cleared
  -- here even though a pending member normally has none (approval gates both
  -- paths in 0005): a member who was approved, joined groups, was un-approved,
  -- and is now being declined may have left stale rows behind — and because
  -- those rows key on auth.users, they would OUTLIVE this delete. If the same
  -- person later re-signs up (same auth account, so same user_id) and is
  -- approved, stale membership rows would silently seat them back in their
  -- old groups with no fresh consent from anyone, and stale pending
  -- join_requests would be acceptable by an organizer as if just filed. That
  -- is exactly the consent-resurrection failure 0005's design closes off, so
  -- both tables are swept here.
  delete from public.join_requests where user_id = target;
  delete from public.memberships where user_id = target;
  delete from public.families where user_id = target;
  delete from public.members where user_id = target;
end
$$;

revoke all on function public.decline_signup(uuid) from public;
revoke execute on function public.decline_signup(uuid) from anon;
grant execute on function public.decline_signup(uuid) to authenticated;

-- unapprove_member(target): push an approved family back to pending and
-- clear their group memberships in the SAME statement-atomic call. The two
-- writes travel together on purpose: a half-removed state (un-approved but
-- still seated in groups, or removed from groups but still approved) caused
-- real confusion in 0005's review history. Note that 0005's group_roster()
-- already refuses to reveal an un-approved subject's contact details, so the
-- membership delete is belt and braces — it clears the stale seats so group
-- member counts and rosters reflect reality, it is not the only line of
-- defense for their contact info.
create or replace function public.unapprove_member(target uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  m public.members%rowtype;
begin
  -- Caller gate, same as decline_signup.
  if not public.is_admin() then
    raise exception 'Only admins can un-approve a member';
  end if;

  -- Lock the target row (same rationale as decline_signup: two admins, or an
  -- un-approve racing an approve, serialize instead of interleaving).
  select * into m from public.members where user_id = target for update;
  if not found then
    raise exception 'That member no longer exists';
  end if;

  -- Structural rule again: admin-on-admin is impossible, which also rules
  -- out un-approving yourself out of your own admin powers mid-session.
  if m.role = 'admin' then
    raise exception 'An admin account cannot be un-approved';
  end if;

  -- Re-running on an already-pending member is harmless: the update is a
  -- no-op and the membership sweep still clears any stale seats.
  --
  -- Heads-up for readers tracing side effects: this UPDATE fires 0004's
  -- notify_member_update webhook trigger with NEW.approval = 'pending'; the
  -- notify function keys the "approved" email on the pending->approved
  -- transition, so an un-approve sends nothing.
  update public.members set approval = 'pending' where user_id = target;
  delete from public.memberships where user_id = target;

  -- join_requests are deliberately NOT swept here (unlike decline_signup):
  -- the account still exists and may be re-approved, and 0005's
  -- accept_join_request() re-checks the requester's approval at accept time,
  -- so a pending request from this family stays safely un-acceptable while
  -- they are un-approved.
end
$$;

revoke all on function public.unapprove_member(uuid) from public;
revoke execute on function public.unapprove_member(uuid) from anon;
grant execute on function public.unapprove_member(uuid) to authenticated;
