do $block$
declare definition text; revised text;
begin
 definition:=pg_get_functiondef('cr_private.mutate(text,jsonb)'::regprocedure);
 revised:=replace(definition,
  'Submitted by the treasurer, so it goes to a board vote.',
  'The requester cannot approve their own request, so it goes to a board vote.');
 if definition=revised then raise exception 'Self-review history wording was not found'; end if;
 execute revised;
end $block$;
