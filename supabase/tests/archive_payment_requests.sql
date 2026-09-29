-- Run inside a rollback-only transaction after applying the archive migration.
do $$
declare rid uuid; v integer; result jsonb;
begin
 select id,version into strict rid,v from public.cr_requests where reference=4;
 perform set_config('request.jwt.claim.sub',(select id::text from auth.users where phone='14048493220'),true);
 if (select archived_at is not null from public.cr_requests where id=rid) then
  perform public.cr_archive_request(rid,v,false); v:=v+1;
 end if;
 result:=public.cr_archive_request(rid,v,true);
 if result->>'archived_at' is null then raise exception 'Archive did not take'; end if;
 begin
  update public.cr_requests set status='approved' where id=rid;
  raise exception 'Archived record changed';
 exception when raise_exception then
  if sqlerrm<>'Restore this archived request before making changes.' then raise; end if;
 end;
 begin
  perform public.cr_archive_request(rid,v,false);
  raise exception 'Stale version accepted';
 exception when raise_exception then
  if sqlerrm<>'Request changed. Refresh and try again.' then raise; end if;
 end;
 result:=public.cr_archive_request(rid,v+1,false);
 if result->>'archived_at' is not null then raise exception 'Restore did not take'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.cr_archive_request(rid,v+2,true);
  raise exception 'Unauthenticated archive accepted';
 exception when raise_exception then
  if sqlerrm<>'Administrator access required.' then raise; end if;
 end;
end $$;
