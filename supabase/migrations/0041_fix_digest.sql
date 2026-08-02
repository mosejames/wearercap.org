-- ---------------------------------------------------------------------------
-- 0041_fix_digest.sql — the end-of-day round-up was silently broken.
--
-- 0027 added the daily digest and put 'holder_digest' in the allowed kinds.
-- 0038 rewrote that same constraint to add the new handoff kinds and rebuilt
-- the list from the wrong copy — dropping 'holder_digest' on the way past.
--
-- So since yesterday, every holder who chose "End of day" got nothing: their
-- messages were parked correctly, the sweeper tried to roll them into a
-- round-up, and the insert failed the check constraint. Silent, because the
-- sweeper swallows its errors. Nobody had picked that setting yet, which is the
-- only reason it didn't cost anyone a handoff.
--
-- Two other things wrong with that round-up while we're here:
--   the link went to #/requests, which is the FAMILY's door — a holder tapping
--   it landed on a form asking for their phone number
--   and each line came through as "AMI-1): a request is queued", because the
--   prefix was half-stripped
-- ---------------------------------------------------------------------------

alter table public.ue_notifications drop constraint if exists ue_notifications_kind_check;
alter table public.ue_notifications add constraint ue_notifications_kind_check check (kind in
  ('request_received','request_waitlist','ready_at_desk','offer_received',
   'holder_request','holder_offer','handoff_set','handoff_sent','handoff_done',
   'access_link','holder_link','holder_welcome','holder_digest',
   'handoff_moved','handoff_released','contact_shared'));

create or replace function public.ue_send_digests()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_sent integer := 0;
  v_lines text;
  v_count integer;
  v_link text;
begin
  for r in
    select phone, array_agg(id) as ids, count(*) as n
    from public.ue_notifications
    where status = 'pending' and deliver_after is not null and deliver_after <= now()
    group by phone
  loop
    -- "AMI-1 · a request is queued to your bin — …", with the banner and the
    -- repeated bin link taken off every line.
    select count(*), string_agg('• ' || regexp_replace(
             regexp_replace(body, '^RCAP Uniform Exchange \(([^)]*)\):\s*', '\1 · ', 'g'),
             '\s*Your bin page:.*$', '', 'g'), E'\n')
      into v_count, v_lines
    from public.ue_notifications
    where id = any(r.ids);

    -- Their own page, not the family's front door.
    select ue_holder_url(h.token) into v_link
    from public.ue_holders h
    where ue_phone(h.phone) = ue_phone(r.phone)
    limit 1;

    insert into public.ue_notifications (kind, phone, body)
    values ('holder_digest', r.phone,
      'RCAP Uniform Exchange — today''s round-up (' || v_count || ' update' ||
      case when v_count = 1 then '' else 's' end || '):' || E'\n' || v_lines || E'\n' ||
      'Open your page: ' || coalesce(v_link, 'https://wearercap.org/uniform-exchange/'));

    update public.ue_notifications
    set status = 'skipped', detail = 'rolled into the daily round-up', sent_at = now()
    where id = any(r.ids);

    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end;
$$;
grant execute on function public.ue_send_digests() to anon, authenticated;
