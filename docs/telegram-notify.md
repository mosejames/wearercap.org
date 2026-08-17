# Telegram as the notification rail

Wish I Knew proved the pattern: a decision that used to need a laptop becomes
one tap on a phone. This is that pattern generalised, so the next thing to use
it does not have to rebuild any of it.

## The pieces

| | |
|---|---|
| `tg-send` | edge function. Send a message, or ask what has been dismissed. |
| `wik-telegram` | edge function. Every button tap in the bot lands here and routes on the callback prefix. |
| `brief_dismissals` | table. What Mose has already dealt with. |
| `scripts/tg_notify.py` | in `~/Desktop/Claude`. The local front door. |
| `~/.config/wearercap/notify.json` | endpoint + shared secret, chmod 600, never committed. |

One bot, `@wearercap_wik_bot`, and therefore **one webhook for everything**.
That is why `wik-telegram` is a router rather than a moderation handler: the
`callback_data` prefix decides what a tap means.

| Prefix | Means |
|---|---|
| `pub:<uuid>` | publish a held Wish I Knew post |
| `dec:<uuid>` | decline one, or take a published one down |
| `done:<hash>` | mark a morning-briefing item dealt with |

Keep prefixes short. `callback_data` is capped at 64 bytes and a UUID already
eats 36 of them.

## Sending from anything

```python
import sys; sys.path.insert(0, '/Users/mosejames/Desktop/Claude/scripts')
from tg_notify import send, dismiss_key

send("<b>Heads up</b>\nsomething happened", buttons=[
    {"label": "✓ Handled", "action": "done:" + dismiss_key("+14045029377")},
])
```

Telegram HTML only: `<b>`, `<i>`, `<code>`, `<a href="">`. No markdown, no
`<br>`, no nesting. Escape `&`, `<`, `>` in anything a person wrote. Phone
numbers as `<a href="tel:+1...">` so a tap dials.

Long messages split on paragraph breaks rather than truncating — a briefing
that hides something waiting on him is a bug, so the 1400-character squeeze the
SMS version needed is gone.

## Why the dismissals table holds nothing

The morning briefing carries OMG business contacts, and this Supabase project
was built for a school carpool. So `tg_notify.dismiss_key()` hashes the phone
or email locally and only the hash ever leaves the Mac. `brief_dismissals` has
no name, no number, no address — just an opaque string and a timestamp. It also
has RLS on with **no policies at all**, so nothing reaches it through the anon
key; both the briefing and the callback go through the service role.

Changing `_SALT` in `tg_notify.py` forgets every dismissal ever recorded.

**A dismissal is not a block.** It holds only until that person does something
new: the check compares `dismissed_at` against their latest message, so anyone
who messages again resurfaces on their own. That is deliberate — a permanent
mute is how you lose a client you meant to get back to.

## Adding a new kind of notification

1. Send with `tg_notify.send()`, with buttons if a tap would be useful.
2. If it needs a new action, add a prefix to the router in `wik-telegram` and
   redeploy. Do not create a second webhook; Telegram allows one per bot and
   setting a new one silently unhooks the old.

## Secrets

All on Supabase project **`kcsrtwwpnekqdrfgcfys` (wearercap-carpool)** →
Edge Functions → Secrets:

`TELEGRAM_BOT_TOKEN` · `TELEGRAM_CHAT_ID` · `TELEGRAM_WEBHOOK_SECRET` ·
`ANTHROPIC_API_KEY` · `NOTIFY_PUSH_SECRET`

`NOTIFY_PUSH_SECRET` must equal `secret` in `~/.config/wearercap/notify.json`.
If they drift, `tg_notify.py` exits with a 401 saying exactly that.

> Mose has more than one Supabase project and they are indistinguishable in the
> dashboard. Secrets have already gone to the wrong one once. Check the project
> ref in the URL before pasting.

## Where the briefing changed

`~/.claude/scheduled-tasks/omg-morning-lead-briefing/SKILL.md`. Steps 1-3
(Quo, iMessage, Gmail) are untouched. New step 3.6 drops anything already
handled. Steps 5-6 compose Telegram HTML and send with buttons instead of
building a 1400-character SMS. The old SMS path is preserved in `SKILL.md.bak`
next to it and is still the fallback if `tg-send` is down.
