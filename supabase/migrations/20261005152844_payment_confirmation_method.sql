-- The actual disbursement method may differ from the requester's preference.
alter table public.cr_requests add column payment_method text
 check (payment_method in ('zelle','debit_card','check','other'));

do $migration$
declare
 definition text := pg_get_functiondef('cr_private.mutate(text,jsonb)'::regprocedure);
 old_line text := $old$   update public.cr_requests set status='paid',payment_reference=trim(p_data->>'payment_reference'),payment_date=item_date,version=version+1,updated_at=now() where id=rid;$old$;
 new_line text := $new$   if coalesce(p_data->>'payment_method','') not in ('zelle','debit_card','check','other') then
    raise exception 'Choose how the funds were sent.';
   end if;
   if lower(trim(p_data->>'payment_reference')) in ('paid','done','n/a') or
     lower(trim(p_data->>'payment_reference'))=lower(trim(coalesce(r.zelle_contact,''))) or
     lower(trim(p_data->>'payment_reference'))=lower(trim(coalesce(r.phone,''))) then
    raise exception 'Enter the bank or check reference, not the payee contact or a status word.';
   end if;
   update public.cr_requests set status='paid',
    payment_reference=trim(p_data->>'payment_reference'),
    payment_method=p_data->>'payment_method',
    payment_date=item_date,version=version+1,updated_at=now() where id=rid;$new$;
begin
 if position(old_line in definition)=0 then
  raise exception 'Could not locate the payment recording hook.';
 end if;
 execute replace(definition,old_line,new_line);
end $migration$;

-- Keep the read-only treasurer ledger current without changing its key.
do $migration$
declare
 definition text := pg_get_functiondef('cr_private.ledger_snapshot(text)'::regprocedure);
 old_fields text := $old$'payment_reference', r.payment_reference, 'archived_at', r.archived_at,$old$;
 new_fields text := $new$'payment_reference', r.payment_reference,
        'payment_method', coalesce(r.payment_method, r.delivery),
        'archived_at', r.archived_at,$new$;
begin
 if position(old_fields in definition)=0 then
  raise exception 'Could not locate the treasurer ledger payment fields.';
 end if;
 execute replace(definition,old_fields,new_fields);
end $migration$;
