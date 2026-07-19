# Phase 3A handoff (groups) — 2026-07-18

Branch `carpool-phase3a` is finished and reviewed. **Not merged, on purpose.** Two
steps, in this order.

## Step 1: apply the migration (you have to do this, I can't)

Supabase SQL Editor → paste all of `supabase/migrations/0005_groups.sql` → run.

It is idempotent, so a second run is a clean no-op if you lose your place. It
was verified to run top to bottom on a fresh database, but nothing has executed
it yet, so watch for an error rather than assuming.

If it errors, stop and don't merge. The client expects every object in it.

## Step 2: merge and deploy

```
git checkout main && git merge carpool-phase3a && git push
```

Vercel auto-deploys from `main`.

**Order matters.** If the client ships first, the groups section shows "We could
not reach the carpool groups yet" and nothing else. The family form and the map
keep working, so it is contained rather than an outage, but there's no reason to
show anyone a broken section.

## Then check, live

1. Create a group. It should appear under "My groups" with you in the roster.
2. From the second test account (`mose+e2e@mosejames.com`, Dana Rivers), request
   to join. You should see the request with Dana's name, children, area, and
   schedule — and **no email or phone**. That's the design: contact details are
   held back until you accept.
3. Accept. Now contacts appear on both sides.
4. Have Dana leave, then confirm you cannot re-add her without a fresh request.
   This is the one that five review rounds went into.

## What's deliberately not built

Phase 3B/4, unchanged from the plan: suggestion engine, meeting-point
coordinates, join-request emails, availability toggle, year rollover.

Three things the final review surfaced that are **your call**, not oversights:

- **`groups.status`** ('open' | 'full') exists in the schema, is never read or
  written. Either wire up a "this group is full" state or drop the column later.
- **Declined families** re-appear in "Groups near you" with a live request
  button and no limit on re-asking. The DB allows re-requesting by design so a
  family isn't permanently locked out. Whether to show "you were declined", or
  rate-limit it, is a tone decision about parents talking to parents.
- **No organizer-removes-a-member and no delete-group UI.** Both are allowed by
  the database and admins can do either from the SQL editor, but there's no
  button. For a product about kids, worth deciding when that moderation path
  becomes real rather than console-only.

## One thing worth knowing

The consent copy now tells a parent that the organizer alone decides who joins
later, and that each family accepted after them sees their email and phone with
no fresh ask. That's how any group works, but it wasn't what the earlier copy
implied, and a parent consenting on behalf of a child should get the accurate
version.
