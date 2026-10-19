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

"Copy for Gmail" puts the formatted email on the clipboard; paste into a new
Gmail message on a computer. Kim's version planned a Gmail API draft button,
which needed a Google Cloud OAuth app and stalled there. Copy and paste is the
method already proven with the September 20 issue, so it is the default here.

Publishing an issue gives it a web address. Publish before copying and the
email carries a "View on the web" link.

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
