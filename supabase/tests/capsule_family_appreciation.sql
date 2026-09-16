-- Integration smoke test: needs an RCAP photo and three verified, unbanned members.
-- Run the whole script. All reactions and the database-only upload roll back.
begin;
select set_config('test.recipient',l.user_id::text,true),set_config('test.photo',p.id::text,true)
from public.vault_photos p join vault_private.owner_links l on l.owner=p.owner
where p.house='rcap' and not p.hidden and p.removed_at is null limit 1;
select set_config('test.sender',m.user_id::text,true) from vault_private.members m join auth.users u on u.id=m.user_id
where m.user_id::text<>current_setting('test.recipient') and u.phone_confirmed_at is not null and m.phone_hash=public.vault_hash(u.phone)
and not exists(select 1 from vault_private.bans b where b.phone_hash=m.phone_hash) limit 1;
select set_config('test.outsider',m.user_id::text,true) from vault_private.members m join auth.users u on u.id=m.user_id
where m.user_id::text not in(current_setting('test.recipient'),current_setting('test.sender')) and u.phone_confirmed_at is not null and m.phone_hash=public.vault_hash(u.phone)
and not exists(select 1 from vault_private.bans b where b.phone_hash=m.phone_hash) limit 1;
set local role authenticated;
do $$ declare r jsonb; base_count integer; thanks_id uuid; denied boolean:=false; begin
  perform set_config('request.jwt.claim.sub',current_setting('test.recipient'),true);
  r:=public.capsule_community('summary');base_count:=(r->>'total')::integer;
  begin perform public.capsule_community('send',current_setting('test.photo')::uuid); exception when others then denied:=true; end;
  if not denied then raise exception 'Self-thanks allowed'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('test.sender'),true);
  perform public.capsule_community('send',current_setting('test.photo')::uuid);
  perform public.capsule_community('send',current_setting('test.photo')::uuid);
  r:=public.capsule_community('state',current_setting('test.photo')::uuid);
  if r->>'thanked'<>'true' then raise exception 'Sender state missing'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('test.recipient'),true);
  r:=public.capsule_community('inbox');
  if (r->>'total')::integer<>base_count+1 then raise exception 'Reaction not idempotent'; end if;
  select (i->>'id')::uuid into thanks_id from jsonb_array_elements(r->'items') i where i->>'photo_id'=current_setting('test.photo') and i->>'read_at' is null limit 1;
  if thanks_id is null then raise exception 'Notification missing'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('test.outsider'),true);
  r:=public.capsule_community('inbox');
  if exists(select 1 from jsonb_array_elements(r->'items') i where i->>'id'=thanks_id::text) then raise exception 'Private reaction leaked'; end if;
  perform public.capsule_community('read',p_ids=>array[thanks_id]);
  perform set_config('request.jwt.claim.sub',current_setting('test.recipient'),true);
  r:=public.capsule_community('inbox');
  if not exists(select 1 from jsonb_array_elements(r->'items') i where i->>'id'=thanks_id::text and i->>'read_at' is null) then raise exception 'Outsider marked notification'; end if;
  perform public.capsule_community('read',p_ids=>array[thanks_id]);
  r:=public.capsule_community('inbox');
  if not exists(select 1 from jsonb_array_elements(r->'items') i where i->>'id'=thanks_id::text and i->>'read_at' is not null) then raise exception 'Read not saved'; end if;
  perform set_config('request.jwt.claim.sub',current_setting('test.sender'),true);
  perform public.capsule_community('undo',current_setting('test.photo')::uuid);
  perform set_config('request.jwt.claim.sub',current_setting('test.recipient'),true);
  r:=public.capsule_community('summary');
  if (r->>'total')::integer<>base_count then raise exception 'Undo failed'; end if;
end $$;
reset role;
-- Exercise first-share award with a database-only row. Everything rolls back.
select set_config('request.jwt.claim.sub',current_setting('test.recipient'),true);
delete from vault_private.capsule_first_shares where user_id=current_setting('test.recipient')::uuid;
insert into public.vault_photos select (jsonb_populate_record(null::public.vault_photos,to_jsonb(p)||jsonb_build_object('id',gen_random_uuid(),'content_hash',null))).*
from public.vault_photos p where p.id=current_setting('test.photo')::uuid;
set local role authenticated;
do $$ declare r jsonb;begin
 r:=public.capsule_community('claim');if r->>'first_share'<>'true' then raise exception 'First Share missing';end if;
 r:=public.capsule_community('claim');if r->>'first_share'<>'false' then raise exception 'First Share repeated';end if;
 r:=public.capsule_community('summary');if r->>'first_share_at' is null then raise exception 'Badge not persistent';end if;
end $$;
rollback;
select 'passed: privacy, idempotency, self-thanks, read authorization, undo, first-share award and one-time celebration; all test writes rolled back' as result;
