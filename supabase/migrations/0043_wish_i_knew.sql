-- ---------------------------------------------------------------------------
-- 0043_wish_i_knew.sql — One Thing I Wish I Knew
--
-- A bridge between the families who have been here and the ones just walking
-- in. Veteran parents write the advice. Incoming parents ask the questions.
-- Veterans answer those questions. Everything is a post in one table.
--
-- The rule that shapes this file: NOTHING is public until Mose approves it.
-- The Recap could get away with reading every row and hiding the bad ones in
-- the browser, because the Recap was written by people who had just been in
-- the room together. This one goes to families who have never met us. So the
-- gate is in the row-level policy, not in the client — an unapproved post is
-- not merely hidden, it is unreadable through the anon key at all.
-- ---------------------------------------------------------------------------

create table if not exists public.wik_posts (
  id          uuid primary key default gen_random_uuid(),

  -- Which round this belongs to. Same fixture idea as the Recap: next year is
  -- a config edit and a fresh slug, not a migration.
  round_slug  text        not null default 'class-of-2031',

  -- advice   — a veteran parent, unprompted
  -- question — an incoming parent asking
  -- answer   — a veteran parent answering a specific question
  kind        text        not null check (kind in ('advice', 'question', 'answer')),

  -- Only an answer points at something. Advice and questions stand alone.
  answers_to  uuid        references public.wik_posts (id) on delete cascade,

  topic       text        not null check (length(btrim(topic)) between 1 and 40),

  -- The one thing, or the question itself. This is what shows large on a card.
  headline    text        not null check (length(btrim(headline)) between 3 and 160),

  -- The why. Optional everywhere.
  body        text        not null default '' check (length(body) <= 500),

  -- How the author is credited. First name is optional on purpose: some
  -- parents will say more if they can say it as "a Class of 2029 Mom".
  author_name text        not null default '' check (length(author_name) <= 40),
  relation    text        not null check (relation in
                ('Mom', 'Dad', 'Grandparent', 'Auntie', 'Uncle', 'Bonus Parent', 'Guardian')),
  grad_class  text        not null check (grad_class in
                ('2027', '2028', '2029', '2030', '2031', '2032', '2033')),

  status      text        not null default 'pending'
                check (status in ('pending', 'approved', 'declined')),

  created_at  timestamptz not null default now(),
  decided_at  timestamptz,

  -- An answer must point somewhere; advice and questions must not.
  constraint wik_answer_has_parent check (
    (kind = 'answer' and answers_to is not null)
    or (kind <> 'answer' and answers_to is null)
  )
);

create index if not exists wik_posts_public_idx
  on public.wik_posts (round_slug, status, kind, created_at desc);

create index if not exists wik_posts_answers_idx
  on public.wik_posts (answers_to) where answers_to is not null;

alter table public.wik_posts enable row level security;

-- ---------------------------------------------------------------------------
-- Read: approved only. This is the whole guardrail. A pending post is invisible
-- to the browser even if someone goes looking with the anon key by hand.
-- ---------------------------------------------------------------------------
drop policy if exists wik_posts_read on public.wik_posts;
create policy wik_posts_read
  on public.wik_posts for select
  using (status = 'approved');

-- ---------------------------------------------------------------------------
-- Write: anyone may add, but only ever as 'pending'. There is deliberately no
-- update and no delete policy, so nothing can be edited or removed from a
-- browser — only through the passcode-checked functions below.
--
-- An answer may only attach to an APPROVED question. Without this, someone
-- could chain an answer onto a question that was declined and never seen.
-- ---------------------------------------------------------------------------
drop policy if exists wik_posts_insert on public.wik_posts;
create policy wik_posts_insert
  on public.wik_posts for insert
  with check (
    status = 'pending'
    and decided_at is null
    and (
      answers_to is null
      or exists (
        select 1 from public.wik_posts q
        where q.id = wik_posts.answers_to
          and q.kind = 'question'
          and q.status = 'approved'
      )
    )
  );

-- GOTCHA, and it is not obvious: because the read policy hides pending rows,
-- an INSERT ... RETURNING fails — the writer cannot see what they just wrote.
-- That means the client must NOT call .select() after .insert(). PostgREST
-- reports it as "new row violates row-level security policy", which points at
-- the wrong policy entirely. See the note in src/wik/data.js.

-- Supabase's baseline grants hand anon these, and TRUNCATE bypasses RLS
-- entirely. Take them back explicitly.
revoke truncate, references, trigger, maintain
  on public.wik_posts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Back office. The passcode is checked in the database, never in the browser.
-- Same passcode as the Recap back office, on purpose — one thing to remember.
-- ---------------------------------------------------------------------------
create or replace function public.wik_admin_all(p_pass text)
returns setof public.wik_posts
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pass is distinct from 'rcap2026' then
    raise exception 'Wrong passcode';
  end if;
  return query
    select * from public.wik_posts order by created_at desc;
end;
$$;

create or replace function public.wik_set_status(p_id uuid, p_status text, p_pass text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pass is distinct from 'rcap2026' then
    raise exception 'Wrong passcode';
  end if;
  if p_status not in ('pending', 'approved', 'declined') then
    raise exception 'Unknown status';
  end if;
  update public.wik_posts
     set status = p_status,
         decided_at = case when p_status = 'pending' then null else now() end
   where id = p_id;
end;
$$;

-- Declining a question orphans nothing — the cascade above takes its answers
-- with it only on delete, so a declined question keeps its answers pending and
-- invisible. That is the behaviour we want: kill the question, kill the thread.
create or replace function public.wik_decline_thread(p_id uuid, p_pass text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pass is distinct from 'rcap2026' then
    raise exception 'Wrong passcode';
  end if;
  update public.wik_posts
     set status = 'declined', decided_at = now()
   where id = p_id or answers_to = p_id;
end;
$$;

revoke all on function public.wik_admin_all(text) from public;
revoke all on function public.wik_set_status(uuid, text, text) from public;
revoke all on function public.wik_decline_thread(uuid, text) from public;

grant execute on function public.wik_admin_all(text) to anon, authenticated;
grant execute on function public.wik_set_status(uuid, text, text) to anon, authenticated;
grant execute on function public.wik_decline_thread(uuid, text) to anon, authenticated;
