# Wish I Knew — instant publishing and one-tap moderation

**Status: built, deployed and working as of 2026-08-17.** This file was a plan;
it is now a record. Read it to understand why the pieces are shaped the way
they are before changing any of them.

## What it does

A parent submits on `/wish-i-knew/`. A Postgres trigger hands the row to the
`wik-screen` edge function within a second or so. That function asks
`claude-haiku-4-5` whether the post is plainly fine and sorts it:

| Verdict | Behaviour |
|---|---|
| `clean` | published immediately; writer sees "It's live" and a link to their post |
| `borderline` | stays `pending`; Telegram with **Publish** / **Decline** |
| `violation` | stays `pending`; same buttons, flagged as a problem |

Either way a Telegram lands on Mose's phone. Published posts carry a single
**Take it down**. Tapping any button hits `wik-telegram`, which flips the row
and rewrites the original message in place so the buttons are replaced by the
outcome and a timestamp.

Verified live: ordinary advice auto-published; a post naming a teacher was held
with the reason "Names teacher by name; complaint about a person".

## The parts, and why

**Fail-closed by construction.** `wik-screen` can only ever move a row from
`pending` to `approved`. No key, a model outage, a timeout, unparseable JSON —
every one of those returns `borderline`, which means the row sits exactly where
it started and a human gets asked. A broken screen degrades to the behaviour
the site had before the screen existed. The prompt is also told, explicitly,
that unsure means borderline and never to stretch to clean.

**The writer's own row id comes from the browser.** `addPost` generates a UUID
rather than letting Postgres do it. It has to: the read policy hides `pending`
rows, so there is otherwise no way to ask "what happened to the thing I just
wrote". The client then polls `wik_posts?id=eq.<uuid>` for twelve seconds —
**the row coming back at all is the confirmation that it published**, because
approved is the only thing that policy returns. No status endpoint, nothing new
to secure.

**`wik-telegram` needs two locks, not one.** Telegram's `secret_token` (sent
back in `X-Telegram-Bot-Api-Secret-Token`) *and* a chat id match. The project
ref is in the site's own JS bundle so the function URL is effectively public,
and the client picks its own post id — without the secret token an author could
forge a callback approving their own post, which would make the screen theatre.

**The board link is a constant, not `SITE_URL`.** That secret is shared with the
carpool notifier and already ends in `/carpool/`, so building on it produced
`wearercap.org/carpool//wish-i-knew/read/` and a 404. Cost one round trip to
find. Do not reintroduce it.

**The webhook secret is never written into the repo.** Migration `0044` reads it
back out of `notify_carpool_webhook`'s own definition at apply time, so the two
webhooks stay in step and the value never lands in a public repository.

## Moving parts

| Thing | Where |
|---|---|
| Trigger + verdict columns + `wik_apply_verdict` | `supabase/migrations/0044_wik_screen.sql` |
| The screen | `supabase/functions/wik-screen/` (`verify_jwt: false`) |
| Button taps | `supabase/functions/wik-telegram/` (`verify_jwt: false`) |
| Client poll | `waitForPublish` in `src/wik/data.js` |
| Three-state confirmation | `DonePanel` in `src/wik/App.jsx` |
| Bot | `@wearercap_wik_bot` |

Secrets live in Supabase → Edge Functions → Secrets on project
**`kcsrtwwpnekqdrfgcfys` (wearercap-carpool)**: `ANTHROPIC_API_KEY`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_WEBHOOK_SECRET`.

> Mose has more than one Supabase project and they look identical in the
> dashboard. The first attempt put all three secrets on `reps`
> (`yyhitkfxbjqrhuphqlck`) and everything silently failed closed. If something
> here stops working, check the project ref in the URL first.

`wik-envcheck` is a retired one-off that returns 410. It reported which secret
*names* were present, never values, and later registered the Telegram webhook
from inside the project so the bot token never had to travel. Left inert rather
than deleted.

## Still open

- **Mose's own post has never been published** — "There are no off days",
  submitted 2026-08-16, predates the screen so it never got a verdict.
- **The passcode is in this public repo.** `rcap2026` appears in 25 places
  across the migrations. It opens the Wish I Knew back office and, more
  seriously, the Uniform Exchange one, which holds family names and phone
  numbers. Less urgent now that nobody has to live in the back office, but
  unresolved.
- **Test rows** prefixed `SCREENTEST` may still be in `wik_posts`.

## Next

The morning briefing moves onto the same rails — see
`docs/telegram-notify.md`.
