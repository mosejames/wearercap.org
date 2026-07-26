-- ---------------------------------------------------------------------------
-- 0011_recap_names_words.sql
-- 1. Parents get their own first name on the board ("Charles · Mose's Dad").
-- 2. The one-word field accepts a custom word, not just the preset list.
-- ---------------------------------------------------------------------------

alter table public.recap_entries
  add column if not exists parent_name text not null default '';

alter table public.recap_entries
  drop constraint if exists recap_entries_parent_name_check;
alter table public.recap_entries
  add constraint recap_entries_parent_name_check
  check (length(parent_name) <= 40);

-- Replace the preset-only word check with a length check.
alter table public.recap_entries
  drop constraint if exists recap_entries_word_check;
alter table public.recap_entries
  add constraint recap_entries_word_check
  check (length(btrim(word)) between 2 and 20);
