# Wish I Knew — instant publishing and one-tap moderation

Handoff written 2026-08-10. Everything below is decided, not open for
re-litigation; what is left is credentials and build.

## Where things stand today

`/wish-i-knew/` is live. Nothing publishes until Mose opens
`/wish-i-knew/#admin` (passcode in the migration) and approves it. The queue is
silent — no notification of any kind — and there is no link to the back office
from anywhere, so it is easy to forget it exists. Result: a parent writes
something and has no idea whether it landed.

## The decision

**Invert the gate.** An AI screen runs the moment a post is inserted and sorts
into three buckets:

| Verdict | Behaviour |
|---|---|
| clean | published immediately; writer sees "it's live" with a link to their post |
| borderline | held as `pending`; Mose gets Telegram with **Publish** / **Decline** |
| violation | held as `pending`, pre-marked; same two buttons |

Mose is out of the critical path for the majority. He still gets a Telegram for
every post — for auto-published ones it carries a **Take it down** button.

**Telegram, not email or SMS**, because it is the only one of the three that
puts real buttons in the notification: one tap, no login, no browser. (Resend
and Twilio are both already wired on this project and would be faster to build,
but neither gives one-tap.)

## What the writer sees — the actual point of this

Today the confirmation says "yours shows up once it is approved." That is the
thing to kill. The client should:

1. Generate a UUID client-side and pass it as the row's `id` on insert. The
   insert policy permits this; the column default is only a fallback.
2. Poll `wik_posts?id=eq.<uuid>` every ~1.5s for ~12s. The read policy already
   returns approved rows only, so **the row becoming visible IS the signal that
   it published** — no new endpoint, no status leak, nothing to secure.
3. Row appears → "It's live" plus a link to it on the board.
   Timeout → fall back to today's "a person reads every one" copy.

This is why the screen has to be fast. A single cheap-model call is 1-2s;
pg_net fires the trigger near-instantly. Budget 2-4s end to end.

## Build list

1. **Migration** — add `ai_verdict` (clean/borderline/violation), `ai_reason`,
   `screened_at` to `wik_posts`. Add an insert trigger calling `net.http_post`
   into a new `wik-screen` function. Match `0004_notify_triggers.sql` exactly:
   pg_net direct, `x-webhook-secret` header, `{type, table, record}` body. This
   project has no managed `supabase_functions` schema.
2. **`wik-screen` edge function** — reads the row, calls the model with the
   house rules (positive, practical, no named teachers or students, no
   contact details), writes the verdict, flips `status` to `approved` when
   clean, then sends the Telegram message with an inline keyboard.
3. **`wik-telegram` edge function** — receives `callback_query` from the button
   tap, verifies it came from Mose's chat id, updates `status`, and edits the
   original message in place so the button is replaced by "Published ✓" or
   "Declined ✓". Editing rather than replying is what makes it feel instant.
4. **Frontend** — client-generated id, the poll, and the new confirmation.
5. **Back office link** — see below.

## Credentials needed (only Mose can create these)

- **Telegram bot token** — @BotFather → `/newbot` → copy the token. Two minutes
  on a phone.
- **Mose's Telegram chat id** — message the new bot once, then
  `getUpdates` returns it. Can be fetched automatically given the token.
- **A model API key** for the screen.

All three go in **Supabase Edge Function secrets**, never in this repo — it is
public. See the warning below.

## ⚠ The passcode is in this public repository

`rcap2026` appears in **25 places across the migrations**, and this repo is
public. Anyone who reads it can open:

- the Wish I Knew back office — read, approve and decline pending posts
- the **Uniform Exchange** back office — which holds family names and phone
  numbers

That is the more serious of the two. The whole safety model of the moderation
work above rests on this passcode, so it should be rotated **before** any of it
ships, and moved out of the SQL into a secret the functions read. Rotating it
means one migration replacing every `p_pass is distinct from '...'` comparison
and re-issuing the new value to the people who use the exchange back office.

## Back office discoverability

`#admin` on a page with no link to it is why Mose could not find it. Options,
cheapest first: give it a real path (`/wish-i-knew/admin/`), and once Telegram
is wired the notification itself carries the link, which mostly retires the
problem.

---

# Setup walkthrough

Three things to create. None of them should ever be pasted into a chat or into
this repo — they go straight into Supabase Edge Function secrets, and the
functions read them with `Deno.env.get()`.

## 1. The Telegram bot (about two minutes, works fine on a phone)

1. Open Telegram and search for **@BotFather** (the one with the blue check).
2. Send `/newbot`.
3. It asks for a **display name** — anything, e.g. `RCAP Wish I Knew`.
4. It asks for a **username** — must be unique and must end in `bot`,
   e.g. `wearercap_wik_bot`.
5. It replies with a **token** shaped like `8123456789:AAH...`. That token is
   the bot. Anyone holding it can post as the bot, so treat it as a password.

## 2. Your chat id

A bot cannot message you first — you have to speak to it once so it has a
conversation to reply into.

1. Open your new bot in Telegram (BotFather's message links to it) and send it
   anything at all, e.g. `hi`.
2. In a browser, open:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
   (paste the whole token in place of `<TOKEN>`, keeping the word `bot` in
   front of it).
3. Find `"chat":{"id":123456789` — that number is your chat id.

**Do this before the webhook is set.** Once a webhook exists, `getUpdates`
stops returning anything and this step gets confusing. Telegram also only keeps
undelivered updates for 24 hours, so if the response is empty, message the bot
again and refresh.

## 3. The model API key

The screen needs one call per submission. `claude-haiku-4-5-20251001` is the
right model here: fast enough to fit inside the writer's 12-second poll, and
cheap enough that the cost is not a consideration — a moderation call is a few
hundred tokens, so a hundred submissions lands in the pennies.

Create the key at **console.anthropic.com → API Keys**. Note that API usage is
billed separately from a Claude subscription and needs credit on the account;
having Claude does not mean the API works.

## 4. Put all three into Supabase

Supabase dashboard → this project → **Edge Functions → Secrets** (also
reachable via Project Settings → Edge Functions). Add:

| Name | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | from step 1 |
| `TELEGRAM_CHAT_ID` | from step 2 |
| `ANTHROPIC_API_KEY` | from step 3 |

## 5. Point Telegram at the button handler — LAST

Only after `wik-telegram` is deployed:

`https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://kcsrtwwpnekqdrfgcfys.supabase.co/functions/v1/wik-telegram`

A `{"ok":true}` response means it took. To undo it and go back to `getUpdates`,
call `deleteWebhook` the same way.

Anyone who finds the bot can message it, so `wik-telegram` must check that the
incoming `callback_query` came from `TELEGRAM_CHAT_ID` and ignore everything
else. Otherwise a stranger who guesses the bot name could approve posts.
