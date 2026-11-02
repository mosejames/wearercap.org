begin;
select pg_advisory_xact_lock(291029);
do $patch$
declare definition text; old_guard text:=$old$if not coalesce((boo_private.reveal_self(u)->>'eligible')::boolean,false) then raise exception 'The reveal is only for players who submitted guesses before closing.'$old$; new_guard text:=$new$if not admin and not coalesce((boo_private.reveal_self(u)->>'eligible')::boolean,false) then raise exception 'The reveal is only for players who submitted guesses before closing.'$new$;
begin
 definition:=pg_get_functiondef('boo_private.reveal_dispatch(text,jsonb)'::regprocedure);
 if position(new_guard in definition)>0 then return;end if;
 if length(definition)-length(replace(definition,old_guard,''))<>length(old_guard) then raise exception 'Unexpected reveal eligibility guard; stop for review.';end if;
 execute replace(definition,old_guard,new_guard);
end $patch$;
commit;
