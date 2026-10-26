begin;
-- Run after the proposed schema inside one transaction. Everything rolls back.
do $$
declare cfg jsonb; launched jsonb; tid uuid; result jsonb; owner_id uuid; v integer;
begin
 select user_id into owner_id from trip_engine_private.operators limit 1;
 if owner_id is null then raise exception 'Verified owner is missing';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 cfg:=jsonb_build_object('destination','Engine verification','cohort','2035','start','2030-01-01','end','2030-01-02','timezone','America/New_York','slug','engine-verification-rollback','logo','data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','hero','','videoDownloadUrl','https://example.org/private-videos','exportDays',7,'recipientBinding',true,'colors',jsonb_build_object('navy','#102448','yellow','#f5cc48','paper','#faf9f4'),'features',jsonb_build_object('sendoff',true,'conversations',true,'download',true,'videos',false),'groups',jsonb_build_array('Group A','Group AA','Mixed'));
 begin
  perform public.trip_engine('publish',jsonb_build_object('draftId','dc-draft','config',cfg||jsonb_build_object('cohort','','start','','end',''),'version',0));
  raise exception 'Incomplete DC launch was allowed';
 exception when raise_exception then if sqlerrm='Incomplete DC launch was allowed' then raise;end if;end;
 launched:=public.trip_engine('publish',jsonb_build_object('draftId','11111111-1111-1111-1111-111111111111','config',cfg,'version',0));tid:=(launched->>'id')::uuid;
 if launched->>'phase'<>'Send-off' then raise exception 'Incorrect launch phase';end if;
 result:=public.trip_engine('reserve',jsonb_build_object('slug',cfg->>'slug','id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','hash',repeat('a',64),'ext','jpg','width',100,'height',100,'bytes',100,'name','Verification contributor','group','Group AA'));
 if result->>'album'<>'send-off' or result->>'storage'<>'r2' or position(tid::text in result->>'webKey')=0 then raise exception 'Reservation scope is wrong';end if;
 result:=public.trip_engine('get',jsonb_build_object('slug',cfg->>'slug'));
 if (result->>'count')::integer<>0 then raise exception 'Pending photo became public';end if;
 perform public.trip_engine('finalize',jsonb_build_object('slug',cfg->>'slug','id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
 result:=public.trip_engine('get',jsonb_build_object('slug',cfg->>'slug','album','the-whole-adventure','id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
 if jsonb_array_length(result->'photos')<>0 then raise exception 'Photo leaked across albums';end if;
 perform public.trip_engine('phase',jsonb_build_object('slug',cfg->>'slug','version',1,'phase','Active trip'));
 result:=public.trip_engine('reserve',jsonb_build_object('slug',cfg->>'slug','id','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','hash',repeat('b',64),'ext','jpg','width',100,'height',100,'bytes',100,'name','Verification contributor','group','Mixed','album','send-off'));
 if result->>'album'<>'the-whole-adventure' then raise exception 'Old send-off intake did not switch';end if;
 begin
  perform public.trip_engine('phase',jsonb_build_object('slug',cfg->>'slug','version',1,'phase','Archive'));
  raise exception 'Stale update allowed';
 exception when serialization_failure then null;end;
 perform set_config('request.jwt.claim.sub','',true);
 result:=public.trip_engine('get',jsonb_build_object('slug',cfg->>'slug'));
 if (result->'trip') ? 'videoDownloadUrl' or (result->'trip') ? 'recipientBinding' then raise exception 'Private export settings leaked';end if;
 if (result->>'count')::integer<>1 or (result->>'isAdmin')::boolean or (result->'photos'->0) ? 'user_id' then raise exception 'Public gallery permission failure';end if;
 result:=public.trip_engine('conversation',jsonb_build_object('slug',cfg->>'slug','id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','token',repeat('c',64),'operation','react','reaction','thanks','active',true));
 if jsonb_array_length(result->'reactions')<>1 then raise exception 'Reaction missing';end if;
 begin perform public.trip_engine('list','{}');raise exception 'Anonymous admin access allowed';exception when insufficient_privilege then null;end;
 begin perform public.trip_engine('reserve',jsonb_build_object('slug',cfg->>'slug'));raise exception 'Anonymous upload allowed';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 perform public.trip_engine('admin-photo',jsonb_build_object('slug',cfg->>'slug','id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','hidden',true));
 result:=public.trip_engine('get',jsonb_build_object('slug',cfg->>'slug','album','send-off','id','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'));
 if jsonb_array_length(result->'photos')<>0 then raise exception 'Hidden photo is visible';end if;
 perform public.trip_engine('phase',jsonb_build_object('slug',cfg->>'slug','version',2,'phase','Archive'));
 begin perform public.trip_engine('finalize',jsonb_build_object('slug',cfg->>'slug','id','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'));raise exception 'Archive accepted an upload';exception when raise_exception then if sqlerrm='Archive accepted an upload' then raise;end if;end;
 perform public.trip_engine('unpublish',jsonb_build_object('slug',cfg->>'slug','version',3));
 begin perform public.trip_engine('get',jsonb_build_object('slug',cfg->>'slug'));raise exception 'Unpublished trip remained public';exception when no_data_found then null;end;
launched:=public.trip_engine('publish',jsonb_build_object('draftId','11111111-1111-1111-1111-111111111111','config',cfg,'version',4));
 if launched->>'phase'<>'Archive' then raise exception 'Relaunch reopened archived intake';end if;
end $$;
set local role anon;
do $$ begin
 if has_table_privilege('anon','trip_engine_private.trips','SELECT') or has_table_privilege('authenticated','trip_engine_private.photos','INSERT') then raise exception 'Direct table access leaked';end if;
end $$;
reset role;
select 'PASS: incomplete DC blocked; publish, stable albums, phase switching, gallery isolation, reactions, moderation, archive and unpublish; no direct table grants' as result;

rollback;
