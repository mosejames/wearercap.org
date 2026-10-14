-- Reimbursement expenses now carry a vendor name (items[].vendor).
-- Adds a server-side check to cr_private.mutate; direct vendor payments use payee.
do $$
declare def text;
begin
  def := pg_get_functiondef('cr_private.mutate(text,jsonb)'::regprocedure);
  if position('Enter the vendor name for every expense.' in def) > 0 then return; end if;
  def := replace(def,
    $a$raise exception 'Describe every expense.'; end if;$a$,
    $b$raise exception 'Describe every expense.'; end if;
   if p_data->>'request_type'='reimbursement' and length(trim(coalesce(item->>'vendor',''))) not between 2 and 150 then raise exception 'Enter the vendor name for every expense.'; end if;$b$);
  if position('Enter the vendor name for every expense.' in def) = 0 then raise exception 'mutate() anchor not found'; end if;
  execute def;
end $$;
