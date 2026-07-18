-- Phase 2B follow-up: notification triggers + anon hardening.
-- APPLIED LIVE 2026-07-18 via the Supabase Management API. This file is the
-- repo record. NOTE: the live version embeds the real WEBHOOK_SECRET; this
-- copy uses a placeholder because the repo is public. If re-applying, replace
-- <WEBHOOK_SECRET> with the value stored in Supabase Edge Function secrets.
--
-- Why pg_net directly: this project predates/lacks the managed
-- supabase_functions schema (Dashboard "Database Webhooks"), so the triggers
-- call net.http_post themselves with the same payload shape webhooks use
-- ({type, table, record, old_record}).

create extension if not exists pg_net;

create or replace function public.notify_carpool_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform net.http_post(
    url := 'https://kcsrtwwpnekqdrfgcfys.supabase.co/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', '<WEBHOOK_SECRET>'
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'record', row_to_json(NEW),
      'old_record', case when TG_OP = 'UPDATE' then row_to_json(OLD) end
    )
  );
  return NEW;
end
$fn$;

revoke all on function public.notify_carpool_webhook() from public;

drop trigger if exists notify_member_insert on public.members;
create trigger notify_member_insert
  after insert on public.members
  for each row execute function public.notify_carpool_webhook();

drop trigger if exists notify_member_update on public.members;
create trigger notify_member_update
  after update on public.members
  for each row execute function public.notify_carpool_webhook();

drop trigger if exists notify_family_insert on public.families;
create trigger notify_family_insert
  after insert on public.families
  for each row execute function public.notify_carpool_webhook();

-- Hardening: Supabase default privileges grant EXECUTE to anon even after
-- `revoke ... from public`. The inner gates already failed closed (empty/0),
-- but lock anon out explicitly.
revoke execute on function public.family_directory() from anon;
revoke execute on function public.area_family_count(double precision) from anon;
revoke execute on function public.is_member() from anon;
