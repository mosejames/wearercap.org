-- A narrow, independently keyed export for the treasurer's read-only Google ledger.
-- The key hash is seeded outside source control. The Edge Function signs private
-- document URLs only after this function accepts the key.
alter table cr_private.config add column ledger_secret_hash text;

create function cr_private.ledger_snapshot(p_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_key is null or length(p_key) <> 64 or not exists (
    select 1 from cr_private.config c
    where c.ledger_secret_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
  ) then
    raise exception 'Ledger access denied';
  end if;
  return jsonb_build_object(
    'requests', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'reference', r.reference, 'created_at', r.created_at,
        'requester_name', r.requester_name, 'committee', r.committee,
        'request_type', r.request_type, 'payee', r.payee,
        'total_cents', r.total_cents, 'approver_email', r.approver_email,
        'status', r.status, 'payment_date', r.payment_date,
        'payment_reference', r.payment_reference, 'archived_at', r.archived_at,
        'items', r.items
      ) order by r.reference), '[]'::jsonb)
      from public.cr_requests r
    ),
    'history', (
      select coalesce(jsonb_agg(to_jsonb(h) order by h.created_at, h.id), '[]'::jsonb)
      from public.cr_history h
    ),
    'staff', (
      select coalesce(jsonb_agg(jsonb_build_object('email', s.email, 'name', s.name)), '[]'::jsonb)
      from public.cr_staff s
    ),
    'test_ids', (
      select coalesce(jsonb_agg(t.request_id), '[]'::jsonb)
      from cr_private.test_requests t
    ),
    'archives', (
      select coalesce(jsonb_agg(jsonb_build_object('request_id', n.request_id,
        'files', n.archive_files)), '[]'::jsonb)
      from public.cr_notifications n
      where jsonb_typeof(n.archive_files) = 'array' and jsonb_array_length(n.archive_files) > 0
    )
  );
end $$;
revoke all on function cr_private.ledger_snapshot(text) from public, anon, authenticated;
grant execute on function cr_private.ledger_snapshot(text) to service_role;

create function public.cr_ledger_snapshot(p_key text)
returns jsonb language sql security invoker set search_path = '' as $$
  select cr_private.ledger_snapshot(p_key);
$$;
revoke all on function public.cr_ledger_snapshot(text) from public, anon, authenticated;
grant execute on function public.cr_ledger_snapshot(text) to service_role;
