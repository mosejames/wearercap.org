-- ---------------------------------------------------------------------------
-- 0022_notify_retry.sql — a blip shouldn't swallow a text.
-- Instant delivery is the happy path; this is the net under it. Failed
-- messages get retried by the sweeper for a day, then left alone so a genuinely
-- bad number doesn't rattle forever.
-- ---------------------------------------------------------------------------
alter table public.ue_notifications
  add column if not exists attempts integer not null default 0;
