-- ---------------------------------------------------------------------------
-- 20260915_wik_suggestions.sql — open the floor
--
-- After the first general meeting of 2026-27, One Thing I Wish I Knew stops
-- being a bridge for one incoming class and becomes the open floor: any
-- parent can post a tip, a question, an answer, or an idea for RCAP itself.
-- The first three already exist. This adds the fourth kind.
--
-- A suggestion stands alone like advice does (no parent row), sorts by an
-- idea-topic id from src/wik/config.js, and goes through the same screen and
-- the same approval queue as everything else.
-- ---------------------------------------------------------------------------

alter table public.wik_posts
  drop constraint if exists wik_posts_kind_check;

alter table public.wik_posts
  add constraint wik_posts_kind_check
  check (kind in ('advice', 'question', 'answer', 'suggestion'));

comment on column public.wik_posts.kind is
  'advice = a tip; question; answer = points at a question; suggestion = an idea for RCAP.';
