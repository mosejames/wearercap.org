-- RCA starts at 4th grade; the RSVP form and this check both began at 5.
do $$
declare src text; newsrc text;
begin
  select pg_get_functiondef(oid) into src from pg_proc where proname = 'event_rsvp_upsert';
  newsrc := replace(src, 'where g < 5 or g > 8', 'where g < 4 or g > 8');
  if newsrc <> src then execute newsrc; end if;
end $$;
