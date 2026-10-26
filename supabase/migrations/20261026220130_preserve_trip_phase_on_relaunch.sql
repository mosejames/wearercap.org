-- Preserve closed intake when an existing archived trip is made public again.
create or replace function trip_engine_private.dispatch(p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 t trip_engine_private.trips; p trip_engine_private.photos; v_config jsonb; v_id uuid;
 v_slug text:=coalesce(p_payload->>'slug',''); v_draft text; v_phase text;
 v_actor text; v_reaction text; v_album text; v_group text; v_name text;
 v_list jsonb; v_count integer; v_offset integer; v_limit integer; v_hash text; v_ext text;
 v_verified boolean; v_comment uuid; v_changed boolean;
begin
 if p_action in ('list','publish') and not trip_engine_private.is_admin() then
  raise exception 'Trip Studio administrator access required' using errcode='42501';
 end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'draftId',x.draft_id,'slug',x.slug,'phase',x.phase,
   'published',x.published,'version',x.version,'updatedAt',x.updated_at,'publishedAt',x.published_at,
   'count',(select count(*) from trip_engine_private.photos m where m.trip_id=x.id and m.state='visible')) order by x.published_at), '[]'::jsonb)
  into v_list from trip_engine_private.trips x where trip_engine_private.is_admin(x.id);
  return v_list;
 end if;
 if p_action='publish' then
  v_config:=p_payload->'config';v_draft:=p_payload->>'draftId';v_slug:=v_config->>'slug';
  if v_draft is null or v_draft !~ '^(dc-draft|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$'
   or jsonb_typeof(v_config)<>'object' or length(v_config::text)>1600000
   or coalesce(v_config->>'destination','')='' or length(v_config->>'destination')>80
   or coalesce(v_config->>'cohort','') !~ '^20[0-9]{2}$'
   or coalesce(v_config->>'start','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
   or coalesce(v_config->>'end','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}$'
   or (v_config->>'start')::date>(v_config->>'end')::date
   or not exists(select 1 from pg_catalog.pg_timezone_names where name=v_config->>'timezone')
   or coalesce(v_slug,'') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug)>70
   or v_slug in ('nyc-vault','nyc-2026','2028-london','london-2028','nyc-sendoff')
   or coalesce(v_config->>'logo','') !~ '^data:image/(png|jpeg|webp);base64,'
  then raise exception 'Complete the destination, cohort, dates, timezone, link and logo before launch'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_draft,0));
  select * into t from trip_engine_private.trips where draft_id=v_draft for update;
  if coalesce(t.version,0)<>coalesce((p_payload->>'version')::integer,-1) then raise exception 'The live trip changed. Refresh before publishing' using errcode='40001';end if;
  if t.id is not null and t.slug<>v_slug then raise exception 'The live trip link cannot change';end if;
  v_phase:=case when t.id is not null and (t.phase<>'Send-off' or coalesce((v_config->'features'->>'sendoff')::boolean,false)) then t.phase when coalesce((v_config->'features'->>'sendoff')::boolean,false) then 'Send-off' else 'Active trip' end;
  if t.id is null then
   insert into trip_engine_private.trips(draft_id,slug,config,phase,published) values(v_draft,v_slug,v_config,v_phase,true) returning * into t;
   insert into trip_engine_private.memberships(trip_id,user_id) values(t.id,auth.uid());
  else
   update trip_engine_private.trips set config=v_config,phase=v_phase,published=true,version=version+1,updated_at=now() where id=t.id returning * into t;
  end if;
  return jsonb_build_object('id',t.id,'slug',t.slug,'phase',t.phase,'published',true,'version',t.version);
 end if;
 if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(v_slug)>70 then raise exception 'Trip not available' using errcode='P0002';end if;
 select * into t from trip_engine_private.trips where slug=v_slug;
 if t.id is null then raise exception 'Trip not available' using errcode='P0002';end if;
 if p_action in ('phase','unpublish','moderation','admin-photo','members','export-settings') then
  if not trip_engine_private.is_admin(t.id) then raise exception 'This trip requires administrator access' using errcode='42501';end if;
  if p_action in ('phase','unpublish') then
   if t.version<>coalesce((p_payload->>'version')::integer,-1) then raise exception 'The live trip changed. Refresh before updating' using errcode='40001';end if;
   v_phase:=p_payload->>'phase';
   if p_action='phase' and (not t.published or v_phase not in ('Send-off','Active trip','Wrap-up','Archive') or v_phase is null) then raise exception 'Choose a live trip phase';end if;
   if v_phase='Send-off' and not coalesce((t.config->'features'->>'sendoff')::boolean,false) then raise exception 'Enable send-off before choosing that phase';end if;
   update trip_engine_private.trips set phase=case when p_action='phase' then v_phase else phase end,published=case when p_action='unpublish' then false else published end,version=version+1,updated_at=now() where id=t.id and version=t.version;
   if not found then raise exception 'The live trip changed. Refresh before updating' using errcode='40001';end if;
   return jsonb_build_object('ok',true);
  end if;
  if p_action='export-settings' then
   return jsonb_build_object('exportDays',coalesce(t.config->'exportDays','7'::jsonb),'recipientBinding',coalesce(t.config->'recipientBinding','true'::jsonb),'videoDownloadUrl',case when coalesce((t.config->'features'->>'videos')::boolean,false) then coalesce(t.config->'videoDownloadUrl','""'::jsonb) else '""'::jsonb end);
  end if;
  if p_action='moderation' then
   v_offset:=greatest(0,least(50000,coalesce((p_payload->>'offset')::integer,0)));
   select coalesce(jsonb_agg(trip_engine_private.photo_json(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into v_list from (select * from trip_engine_private.photos where trip_id=t.id and state<>'pending' order by created_at desc,id desc limit 100 offset v_offset) x;
   return jsonb_build_object('photos',v_list,'count',(select count(*) from trip_engine_private.photos where trip_id=t.id and state<>'pending'));
  end if;
  if p_action='members' then
   if not trip_engine_private.is_admin() then raise exception 'Only trip organizers can assign administrators' using errcode='42501';end if;
   select id into v_id from auth.users where lower(email)=lower(trim(p_payload->>'email')) and email_confirmed_at is not null;
   if v_id is null then raise exception 'This person needs a verified account before receiving trip access';end if;
   insert into trip_engine_private.memberships(trip_id,user_id) values(t.id,v_id) on conflict do nothing;
   return jsonb_build_object('ok',true);
  end if;
  if p_action='admin-photo' then
   update trip_engine_private.photos set state=case when (p_payload->>'hidden')::boolean then 'hidden' else 'visible' end where trip_id=t.id and id=(p_payload->>'id')::uuid and state<>'pending';
   if not found then raise exception 'Photo not found' using errcode='P0002';end if;return jsonb_build_object('ok',true);
  end if;
 end if;
 if not t.published then raise exception 'Trip not available' using errcode='P0002';end if;
 if p_action='get' then
  v_album:=nullif(p_payload->>'album','');
  if v_album is not null and v_album not in ('send-off','the-whole-adventure') then raise exception 'Album not available' using errcode='P0002';end if;
  v_offset:=greatest(0,least(50000,coalesce((p_payload->>'offset')::integer,0)));
  v_limit:=greatest(1,least(100,coalesce((p_payload->>'limit')::integer,100)));
  v_id:=nullif(p_payload->>'id','')::uuid;
  select count(*) into v_count from trip_engine_private.photos where trip_id=t.id and state='visible' and (v_album is null or album=v_album) and (v_id is null or id=v_id);
  select coalesce(jsonb_agg(trip_engine_private.photo_json(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into v_list
   from(select * from trip_engine_private.photos where trip_id=t.id and state='visible' and (v_album is null or album=v_album) and(v_id is null or id=v_id) order by created_at desc,id desc limit v_limit offset v_offset)x;
  return jsonb_build_object('trip',(t.config-'exportDays'-'recipientBinding'-'videoDownloadUrl')||jsonb_build_object('engineId',t.id,'phase',t.phase,'version',t.version),'photos',v_list,'count',v_count,'hasMore',v_count>v_offset+v_limit,'isAdmin',trip_engine_private.is_admin(t.id));
 end if;
 if p_action in ('reserve','finalize','own-photo','set-group') then
  select exists(select 1 from auth.users where id=auth.uid() and (email_confirmed_at is not null or phone_confirmed_at is not null)) into v_verified;
  if not v_verified then raise exception 'Sign in with a verified account to share' using errcode='42501';end if;
  if p_action='set-group' then
   v_group:=p_payload->>'group';
   if v_group is null or v_group not in ('Group A','Group AA','Mixed') then raise exception 'Choose a valid group';end if;
   update trip_engine_private.photos set group_name=v_group where trip_id=t.id and id=(p_payload->>'id')::uuid and state<>'pending' and (user_id=auth.uid() or trip_engine_private.is_admin(t.id));
   if not found then raise exception 'You cannot change this photo' using errcode='42501';end if;return jsonb_build_object('ok',true);
  end if;
  if p_action='own-photo' then
   update trip_engine_private.photos set state='hidden' where trip_id=t.id and id=(p_payload->>'id')::uuid and user_id=auth.uid() and state='visible';
   if not found then raise exception 'You can remove only your own photo' using errcode='42501';end if;return jsonb_build_object('ok',true);
  end if;
  if t.phase='Archive' then raise exception 'Uploads are closed for this trip';end if;
  if p_action='reserve' then
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(t.id::text||auth.uid()::text,0));
   v_id:=(p_payload->>'id')::uuid;v_hash:=p_payload->>'hash';v_ext:=p_payload->>'ext';v_name:=trim(p_payload->>'name');v_group:=p_payload->>'group';
   v_album:=case when t.phase='Send-off' and coalesce((t.config->'features'->>'sendoff')::boolean,false) then 'send-off' else 'the-whole-adventure' end;
   if coalesce(v_hash,'') !~ '^[a-f0-9]{64}$' or v_ext is null or v_ext not in ('jpg','png','webp','heic','heif') or v_name is null or length(v_name) not between 1 and 60 or v_group is null or v_group not in ('Group A','Group AA','Mixed') or v_id is null then raise exception 'Check the photo, name and upload group';end if;
   select * into p from trip_engine_private.photos where trip_id=t.id and hash=v_hash;
   if p.id is not null then
    if p.state<>'pending' or p.user_id<>auth.uid() then return jsonb_build_object('duplicate',true);end if;
    if p.created_at<now()-interval '1 hour' then raise exception 'This upload expired. Choose the photo again';end if;
    return trip_engine_private.photo_json(p);
   end if;
   if (select count(*) from trip_engine_private.photos where trip_id=t.id and user_id=auth.uid() and created_at>now()-interval '1 day')>=1000 then raise exception 'Please continue sharing tomorrow';end if;
   if (select count(*) from trip_engine_private.photos where trip_id=t.id and user_id=auth.uid() and created_at>now()-interval '1 minute')>=60 then raise exception 'Please wait a minute before sharing more photos';end if;
   insert into trip_engine_private.photos(id,trip_id,user_id,album,group_name,contributor,hash,ext,width,height,bytes,taken_at)
    values(v_id,t.id,auth.uid(),v_album,v_group,v_name,v_hash,v_ext,(p_payload->>'width')::integer,(p_payload->>'height')::integer,(p_payload->>'bytes')::bigint,nullif(p_payload->>'takenAt','')::timestamptz) returning * into p;
   return trip_engine_private.photo_json(p);
  end if;
  if p_action='finalize' then
   update trip_engine_private.photos set state='visible' where trip_id=t.id and id=(p_payload->>'id')::uuid and user_id=auth.uid() and state='pending' and created_at>now()-interval '1 hour' returning * into p;
   if p.id is null then raise exception 'Upload could not be completed';end if;return trip_engine_private.photo_json(p);
  end if;
 end if;
 if p_action='conversation' then
  select * into p from trip_engine_private.photos where trip_id=t.id and id=(p_payload->>'id')::uuid and state='visible';
  if p.id is null or not coalesce((t.config->'features'->>'conversations')::boolean,false) then raise exception 'Photo conversation is unavailable' using errcode='P0002';end if;
  if coalesce(p_payload->>'token','') !~ '^[a-f0-9]{64}$' then raise exception 'Refresh to join the conversation';end if;
  v_actor:=encode(extensions.digest(t.id::text||(p_payload->>'token'),'sha256'),'hex');
  if p_payload->>'operation'='react' then
   v_reaction:=p_payload->>'reaction';if v_reaction is null or v_reaction not in ('thanks','mine') then raise exception 'Choose a reaction';end if;
   if (p_payload->>'active')::boolean then
    insert into trip_engine_private.reactions(photo_id,actor,kind) values(p.id,v_actor,v_reaction) on conflict do nothing;
   else delete from trip_engine_private.reactions where photo_id=p.id and actor=v_actor and kind=v_reaction;end if;
  elsif p_payload->>'operation'='comment' then
   if length(trim(coalesce(p_payload->>'body',''))) not between 1 and 500 or length(trim(coalesce(p_payload->>'name',''))) not between 1 and 60 then raise exception 'Add your name and a comment under 500 characters';end if;
   if(select count(*) from trip_engine_private.comments where actor=v_actor and created_at>now()-interval '5 minutes')>=10 then raise exception 'Please wait before adding another comment';end if;
   insert into trip_engine_private.comments(photo_id,actor,name,body) values(p.id,v_actor,trim(p_payload->>'name'),trim(p_payload->>'body'));
  elsif p_payload->>'operation'='remove' then
   update trip_engine_private.comments set hidden=true where id=(p_payload->>'commentId')::uuid and photo_id=p.id and (actor=v_actor or trip_engine_private.is_admin(t.id));
   if not found then raise exception 'You cannot remove this comment' using errcode='42501';end if;
  elsif coalesce(p_payload->>'operation','read')<>'read' then raise exception 'Unknown conversation action';end if;
  return jsonb_build_object('reactions',(select coalesce(jsonb_agg(x),'[]'::jsonb)from(select kind,count(*) as count,bool_or(actor=v_actor) as mine from trip_engine_private.reactions where photo_id=p.id group by kind)x),
   'comments',(select coalesce(jsonb_agg(x order by x."createdAt"),'[]'::jsonb)from(select id,name,body,created_at as "createdAt",actor=v_actor or trip_engine_private.is_admin(t.id) as "canRemove" from trip_engine_private.comments where photo_id=p.id and not hidden order by created_at desc limit 100)x));
 end if;
 raise exception 'Unknown trip action';
end;
$$;
