create or replace function closeout_private.archive(p_action text,p_key text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare ev closeout_private.events; f closeout_private.receipts;
begin
 if coalesce(p_key,'') !~ '^[a-f0-9]{64}$' then raise exception 'Archive authorization required.'; end if;
 select * into ev from closeout_private.events where id='karaoke-2026' and sync_hash=encode(extensions.digest(p_key,'sha256'),'hex');
 if ev.id is null then raise exception 'Archive authorization required.'; end if;
 if p_action='pull' then
  return jsonb_build_object('event',jsonb_build_object('id',ev.id,'doc_id',ev.doc_id,'folder_id',ev.folder_id,'reference',ev.reference),'submissions',coalesce((select jsonb_agg(to_jsonb(x)) from (select s.id,s.author_name,(select u.email from auth.users u where u.id=s.author) as author_email,s.content,s.revision,s.receipt_ids,s.created_at from closeout_private.submissions s where s.event=ev.id and s.drive_synced_at is null order by s.created_at limit 5) x),'[]'::jsonb));
 elsif p_action='file' then
  select * into f from closeout_private.receipts r where r.event=ev.id and r.id=(p_payload->>'id')::uuid and exists(select 1 from closeout_private.submissions s where s.event=ev.id and r.id=any(s.receipt_ids));
  if f.id is null then raise exception 'No submitted receipt.'; end if;
  return jsonb_build_object('id',f.id,'name',f.name,'mime',f.mime,'base64',encode(f.bytes,'base64'),'drive_id',f.drive_id);
 elsif p_action='ack_file' then
  if coalesce(p_payload->>'drive_id','') !~ '^[A-Za-z0-9_-]{15,150}$' then raise exception 'Invalid archive file ID.'; end if;
  update closeout_private.receipts set drive_id=p_payload->>'drive_id' where event=ev.id and id=(p_payload->>'id')::uuid;
  return jsonb_build_object('ok',true);
 elsif p_action='ack' then
  if coalesce(p_payload->>'archive_id','') !~ '^[A-Za-z0-9_-]{15,150}$' then raise exception 'Invalid archive ID.'; end if;
  update closeout_private.submissions set drive_synced_at=now(),drive_archive_id=p_payload->>'archive_id' where event=ev.id and id=(p_payload->>'id')::uuid;
  update closeout_private.events set last_sync_at=now(),sync_ready=true where id=ev.id;
  return jsonb_build_object('ok',true);
 elsif p_action='connected' then
  update closeout_private.events set sync_ready=true,last_sync_at=now() where id=ev.id;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Action not available.';
end $$;
