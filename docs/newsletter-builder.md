# RCAP Newsletter Builder

Adapted in October 2026 from the RCA "In the Loop" builder Mose made for
Kim Bearden (`mosejames/rca-in-the-loop`, never launched). Same idea: a form
on the left, the real email on the right, one button to get it into Gmail.
Rebuilt on this site's Supabase and Vercel setup instead of Railway, R2 and
Prisma.

## Where things are

| Address | What |
| --- | --- |
| `/newsletter/builder/` | The builder. Invited officers only. `?preview=quick` or `?preview=full` opens it with sample words and no saving. |
| `/newsletter` | Public list of published issues. |
| `/newsletter/<slug>` | One published issue, server-rendered with its own share card. |
| `/newsletter/september-20/` | The hand-built September 20 issue. Static, untouched, explicitly routed ahead of the slug rule. |

Source: `src/newsletter/` (builder), `server/newsletter-page.js` (public
pages, reached through `api/link.js?p=newsletter`), `server/newsletter-sign.js`
(photo uploads, reached through `api/m3-sign.js?vault=newsletter`). No new
Vercel function was added; the Hobby plan's function limit is close.

## Two formats

- **Quick Hello**: masthead, a short note, dates to circle, one link. Most weeks.
- **Full Issue**: a letter plus photos, a student quote, a thank-you, dates.
  For the issues worth dressing up.

Both render through `src/newsletter/render.js`, which matches the September 20
issue exactly: tables, inline styles, Arial, navy masthead, paper body. That
issue survived a paste into Gmail, so the vocabulary stays the same. The
renderer is pure so the builder, the public page and the tests share it.

## Sending

Sending happens from the shared RCAP Gmail, rcaparents@ronclarkacademy.com.
The "Open in RCAP Gmail" button copies the formatted newsletter and opens a
new Gmail message in that account (Gmail's compose link, `authuser` set to the
RCAP address) with the subject, To (the RCAP address itself) and a hidden BCC
already filled. Gmail's compose link only carries plain text, so the sender
pastes the copied newsletter into the body. The BCC defaults to the five class
lists, rcap2027 through rcap2031@ronclarkacademy.com, and can be changed per
issue in Sending ("Sends to").

Steps for whoever sends, also shown in the builder's Send it card:

1. Use a computer, signed in to rcaparents@ronclarkacademy.com in that
   browser. Personal Google accounts can stay signed in alongside it.
2. Optional: put the issue on the website first so the email carries a
   "View on the web" link.
3. Click Open in RCAP Gmail. The newsletter is copied and a new message opens
   from the RCAP account with subject and recipients filled in.
4. Click in the message body and paste (Cmd+V on a Mac, Ctrl+V on Windows).
5. Check the From line shows the RCAP address, then Send.

If the browser blocks the new tab, the builder shows a link to open the
message by hand. "Copy only", "Copy subject" and "Download" remain as
fallbacks.

A true one-click draft (Gmail API) would need a Google Cloud OAuth app with
the gmail.compose scope and approval from RCA's Google Workspace admin, since
ronclarkacademy.com is the school's domain. Not built.

## Access

`newsletter_private.editors`. Owners were seeded from
`playbook_private.admins` (Mose's accounts). Owners add officers by email in
the builder; officers sign in with Google or an email link. The shared
Supabase session means a Living Playbook sign-in also works here.

All reads and writes go through `rcap_newsletter(action, payload)` (security
definer, editor check on every call). The public archive reads only published
rows through `rcap_newsletter_archive(slug)`.

## Photos

Officers' photos are resized in the browser (`prepareImage` from the vault
pipeline) and stored as one JPEG at `newsletter/<issue>/<id>.jpg` in the
shared R2 bucket. No Supabase Storage fallback, per the vault rule.

## House style check

The builder flags em dashes, exclamation points in body copy, photos without
a description, and quotes without a named student. Suggestions only. "Fix the
dashes for me" swaps them the way the house style asks.
