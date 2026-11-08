alter table trip_engine_private.reactions
  drop constraint reactions_kind_check,
  add constraint reactions_kind_check
    check (kind in ('thanks','mine','love','celebrate','amazing','bravo'));

do $migration$
declare
  definition text := pg_get_functiondef('trip_engine_private.dispatch(text,jsonb)'::regprocedure);
  old_validator constant text := 'v_reaction not in (''thanks'',''mine'')';
begin
  if strpos(definition, old_validator) = 0 then
    raise exception 'Trip reaction validator has changed';
  end if;
  execute replace(definition, old_validator,
    'v_reaction not in (''thanks'',''mine'',''love'',''celebrate'',''amazing'',''bravo'')');
end
$migration$;
