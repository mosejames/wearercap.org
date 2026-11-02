begin;
select pg_advisory_xact_lock(291029);
-- Preserve owner checks and every installed game/reveal guard. Scope only the
-- three existing singleton-settings writes so database safe-update checks pass.
do $patch$
declare definition text; previous text; scoped text; statement text;
 statements text[]:=array[
 $s$update boo_private.settings set awards=v_awards;$s$,
 $s$update boo_private.settings set closes_at=cutoff,timezone=b->>'timezone',tie_rule=b->>'tieRule';$s$,
 $s$update boo_private.settings set finalized_at=now(),awards=v_awards;$s$];
begin
 definition:=pg_get_functiondef('boo_private.game(text,jsonb)'::regprocedure);
 previous:=definition;
 foreach statement in array statements loop
  scoped:=left(statement,length(statement)-1)||' where id=true;';
  if position(scoped in definition)>0 then continue;end if;
  if length(definition)-length(replace(definition,statement,''))<>length(statement) then
   raise exception 'Game settings update changed; review before applying the scoped repair.';
  end if;
  definition:=replace(definition,statement,scoped);
 end loop;
 if definition<>previous then execute definition;end if;
end $patch$;
commit;
