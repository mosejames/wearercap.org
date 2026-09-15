-- Bookkeeping for event-confirm, so each alert and email goes out once.
alter table public.event_rsvps
  add column if not exists board_notified_at timestamptz,
  add column if not exists reminder_sent_at timestamptz;
alter table public.event_comments
  add column if not exists notified_at timestamptz;
