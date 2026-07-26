-- ---------------------------------------------------------------------------
-- 0012_recap_prompts.sql
-- Each submission gets a randomly assigned story prompt ("One thing I'll
-- remember is…"). The prompt is stored with the entry so the card can render
-- the full sentence, and so every card on the board starts differently.
-- ---------------------------------------------------------------------------

alter table public.recap_entries
  add column if not exists prompt text not null default '';

alter table public.recap_entries
  drop constraint if exists recap_entries_prompt_check;
alter table public.recap_entries
  add constraint recap_entries_prompt_check
  check (length(prompt) <= 120);
