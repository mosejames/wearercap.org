-- ---------------------------------------------------------------------------
-- 0021_instant_texts.sql — texts go out the moment they're queued.
--
-- The hourly drain was never a cost decision; it was the only path available
-- when the sender lived inside a scheduled session. With Twilio the database
-- can hand a message off itself, so a bin holder learns a request landed in
-- seconds. pg_net posts asynchronously, so a slow carrier API can never slow
-- down (or roll back) the request the parent just submitted.
--
-- The hourly job stays on as a sweeper: anything that failed or never got
-- picked up gets retried, so a blip can't silently swallow a message.
-- ---------------------------------------------------------------------------

create extension if not exists pg_net with schema extensions;

-- Somewhere to keep the dispatch secret that PostgREST does not expose.
create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.config (
  key   text primary key,
  value text not null
);
revoke all on table private.config from anon, authenticated;

insert into private.config (key, value) values
  ('notify_secret', 'ue-notify-N7cJXvCkQ5fOmPXAsHlz38xc'),
  ('notify_url', 'https://kcsrtwwpnekqdrfgcfys.supabase.co/functions/v1/notify-send')
on conflict (key) do update set value = excluded.value;

create or replace function public.ue_dispatch_notification()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_url text;
  v_secret text;
begin
  if new.status <> 'pending' then return new; end if;

  select value into v_url    from private.config where key = 'notify_url';
  select value into v_secret from private.config where key = 'notify_secret';
  if v_url is null then return new; end if;

  -- Fire and forget. If this call fails the row simply stays pending and the
  -- sweeper picks it up, so a text is delayed rather than lost.
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-ue-secret', coalesce(v_secret, '')),
    body    := jsonb_build_object('id', new.id),
    timeout_milliseconds := 4000
  );
  return new;
end;
$$;

drop trigger if exists ue_dispatch_notification on public.ue_notifications;
create trigger ue_dispatch_notification
  after insert on public.ue_notifications
  for each row execute function public.ue_dispatch_notification();
