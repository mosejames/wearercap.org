-- ---------------------------------------------------------------------------
-- 0044_wik_screen.sql — invert the gate
--
-- Until now nothing on /wish-i-knew/ published until a person opened the back
-- office. That put Mose in front of every parent, and a parent who wrote
-- something had no way to know whether it landed. So: a screen runs the moment
-- a post is inserted, publishes the clearly-fine ones itself, and holds the
-- rest for a human. The human still hears about all of it either way.
--
-- Fail-closed by construction. The screen only ever moves a row from pending
-- to approved; if it errors, times out, or cannot reach the model, the row
-- stays pending exactly as before. The worst failure mode is the behaviour we
-- already had.
-- ---------------------------------------------------------------------------

alter table public.wik_posts
  add column if not exists ai_verdict text
    check (ai_verdict in ('clean', 'borderline', 'violation')),
  add column if not exists ai_reason text,
  add column if not exists screened_at timestamptz;

comment on column public.wik_posts.ai_verdict is
  'clean = published automatically; borderline/violation = held for a person.';

-- ---------------------------------------------------------------------------
-- The trigger. Same shape as 0004_notify_triggers.sql: pg_net direct, because
-- this project has no managed supabase_functions schema.
--
-- The webhook secret is not written into this file. It is read back out of the
-- existing notify trigger at migration time, so the value never passes through
-- a repo that happens to be public, and the two webhooks stay in step.
-- ---------------------------------------------------------------------------
create extension if not exists pg_net;

do $mig$
declare
  v_secret text;
begin
  select substring(pg_get_functiondef(oid) from $re$x-webhook-secret',\s*'([^']+)'$re$)
    into v_secret
    from pg_proc
   where proname = 'notify_carpool_webhook'
   limit 1;

  if v_secret is null or length(v_secret) = 0 then
    raise exception
      'Could not read the webhook secret from notify_carpool_webhook. Apply 0004 first.';
  end if;

  execute format($f$
    create or replace function public.wik_screen_webhook()
    returns trigger
    language plpgsql
    security definer
    set search_path = public
    as $fn$
    begin
      perform net.http_post(
        url := 'https://kcsrtwwpnekqdrfgcfys.supabase.co/functions/v1/wik-screen',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', %L
        ),
        body := jsonb_build_object(
          'type', TG_OP,
          'table', TG_TABLE_NAME,
          'record', row_to_json(NEW)
        )
      );
      return NEW;
    end
    $fn$;
  $f$, v_secret);
end
$mig$;

revoke all on function public.wik_screen_webhook() from public;

drop trigger if exists wik_posts_screen on public.wik_posts;
create trigger wik_posts_screen
  after insert on public.wik_posts
  for each row execute function public.wik_screen_webhook();

-- ---------------------------------------------------------------------------
-- The screen and the Telegram buttons both act through this, so the passcode
-- path and the automated path cannot drift apart. p_actor is recorded on the
-- row so the back office can show who or what decided.
-- ---------------------------------------------------------------------------
create or replace function public.wik_apply_verdict(
  p_id uuid,
  p_status text,
  p_verdict text,
  p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status is not null and p_status not in ('pending', 'approved', 'declined') then
    raise exception 'Unknown status';
  end if;

  update public.wik_posts
     set ai_verdict  = coalesce(p_verdict, ai_verdict),
         ai_reason   = coalesce(p_reason, ai_reason),
         screened_at = now(),
         status      = coalesce(p_status, status),
         decided_at  = case
                         when p_status in ('approved', 'declined') then now()
                         when p_status = 'pending' then null
                         else decided_at
                       end
   where id = p_id;
end;
$$;

-- Service role only. This is the one function that can publish without a
-- passcode, so it is never granted to anon.
revoke all on function public.wik_apply_verdict(uuid, text, text, text) from public, anon, authenticated;
