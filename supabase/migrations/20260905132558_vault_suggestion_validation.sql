-- Suggestions must fit the album fields and ongoing activities need a home.
do $$ declare d text; begin
 d:=pg_get_functiondef('public.vault_suggest_event(text,text,date,boolean,text)'::regprocedure);
 execute replace(d,'500','400');
 d:=pg_get_functiondef('public.vault_review_event_suggestion(uuid,text,uuid,text,text)'::regprocedure);
 d:=replace(d,'if p_action=''approve'' then', 'if p_action=''approve'' then
  if s.ongoing and nullif(p_category,'''') is null then raise exception ''Choose an activity category for an ongoing album''; end if;');
 execute d;
end $$;
