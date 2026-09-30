-- Live-schema integration tests. All fixture changes roll back.
begin;
select set_config('test.event', e.id::text, true), set_config('test.pass', s.admin_pass, true)
from public.vault_events e join public.vault_settings s on s.house=e.house
where e.house='rcap' and not e.hidden and exists(select 1 from public.vault_photos p where p.event_id=e.id and not p.hidden and p.removed_at is null)
limit 1;
-- Exercise visibility using real uploaded fixtures, without creating storage objects.
select set_config('test.hidden_key',p.key,true),set_config('test.hidden_web',p.web_key,true),set_config('test.photo',p.id::text,true)
from public.vault_photos p where event_id=current_setting('test.event')::uuid and not hidden and removed_at is null limit 1;
update public.vault_photos set hidden=true where id=current_setting('test.photo')::uuid;
set local role anon;
do $$
declare s jsonb; info jsonb; m jsonb; old_token text; receipt text; denied boolean;
begin
 if has_table_privilege('anon','vault_private.capsule_share_links','SELECT') then raise exception 'Private links exposed'; end if;
 denied:=false;
 begin perform public.capsule_share_admin(current_setting('test.event')::uuid,'get','incorrect'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Anonymous admin bypass'; end if;
 s:=public.capsule_share_admin(current_setting('test.event')::uuid,'create',current_setting('test.pass'));
 if s->>'token' !~ '^[0-9a-f]{64}$' or position(current_setting('test.event') in (s->>'token'))>0 then raise exception 'Invalid random token'; end if;
 old_token:=s->>'token';
 info:=public.capsule_share(old_token);
 if info ? 'capsule_id' or info ? 'created_by' or info ? 'token' then raise exception 'Private metadata leaked'; end if;
 m:=public.capsule_share(old_token,'start','web');
 if exists(select 1 from jsonb_array_elements(m->'files') f where f->>'key' in (current_setting('test.hidden_key'),current_setting('test.hidden_web'))) then raise exception 'Hidden media leaked'; end if;
 if exists(select 1 from jsonb_array_elements(m->'files') f where f ? 'owner' or f ? 'event_id') then raise exception 'Manifest leaked private metadata'; end if;
 receipt:=m->>'receipt';
 perform public.capsule_share(old_token,'complete',null,'wrong-receipt');
 s:=public.capsule_share_admin(current_setting('test.event')::uuid,'get',current_setting('test.pass'));
 if (s->>'download_count')::bigint<>0 then raise exception 'Invalid receipt counted'; end if;
 perform public.capsule_share(old_token,'complete',null,receipt);
 perform public.capsule_share(old_token,'complete',null,receipt);
 s:=public.capsule_share_admin(current_setting('test.event')::uuid,'get',current_setting('test.pass'));
 if (s->>'download_count')::bigint<>1 then raise exception 'Counting is not idempotent'; end if;
 perform public.capsule_share_admin(current_setting('test.event')::uuid,'update',current_setting('test.pass'),'{"allow_web_download":false}');
 denied:=false;
 begin perform public.capsule_share(old_token,'start','web'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Disabled web download allowed'; end if;
 m:=public.capsule_share(old_token,'start','full');
 perform public.capsule_share_admin(current_setting('test.event')::uuid,'update',current_setting('test.pass'),'{"allow_full_download":false}');
 denied:=false;
 begin perform public.capsule_share(old_token,'start','full'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Disabled full download allowed'; end if;
 perform public.capsule_share_admin(current_setting('test.event')::uuid,'update',current_setting('test.pass'),'{"enabled":false}');
 if public.capsule_share(old_token) is not null or public.capsule_share(old_token,'start','full') is not null then raise exception 'Disabled link works'; end if;
 perform public.capsule_share_admin(current_setting('test.event')::uuid,'update',current_setting('test.pass'),jsonb_build_object('enabled',true,'expires_at',now()-interval '1 second'));
 if public.capsule_share(old_token) is not null then raise exception 'Expired link works'; end if;
 perform public.capsule_share_admin(current_setting('test.event')::uuid,'update',current_setting('test.pass'),'{"expires_at":null}');
 s:=public.capsule_share_admin(current_setting('test.event')::uuid,'regenerate',current_setting('test.pass'));
 if s->>'token'=old_token or public.capsule_share(old_token) is not null then raise exception 'Old token survived rotation'; end if;
 perform public.capsule_share(s->>'token','complete',null,m->>'receipt');
 s:=public.capsule_share_admin(current_setting('test.event')::uuid,'get',current_setting('test.pass'));
 if (s->>'download_count')::bigint<>0 then raise exception 'Old receipt survived rotation'; end if;
 if public.capsule_share('unknown') is not null then raise exception 'Invalid token accepted'; end if;
 perform set_config('test.token',s->>'token',true);
end $$;
reset role;
update public.vault_events set hidden=true where id=current_setting('test.event')::uuid;
set local role anon;
do $$ begin
 if public.capsule_share(current_setting('test.token')) is not null then raise exception 'Hidden event shared'; end if;
end $$;
reset role;
-- Same feature, same authorization, for AMI capsules.
do $$ declare e uuid; secret text; s jsonb; begin
 select v.id,p.admin_pass into e,secret from public.vault_events v join public.vault_settings p on p.house=v.house where v.house='amistad' and not v.hidden limit 1;
 s:=public.capsule_share_admin(e,'create',secret);
 if public.capsule_share(s->>'token')->>'house'<>'amistad' then raise exception 'AMI share failed'; end if;
end $$;
rollback;
select 'passed: anonymous access, admin authorization, metadata privacy, quality permissions, hidden media, expiry, disable, rotation, idempotent completion, AMI reuse; all changes rolled back' as result;
