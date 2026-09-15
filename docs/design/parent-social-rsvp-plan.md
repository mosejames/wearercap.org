# Parent Social RSVP: build plan

Event pages with RSVP for wearercap.org, starting with the R&B Karaoke Parent Social on Sunday, September 27, 2026, 5 to 7pm at Ron Clark Academy. Written as a handoff for the build session. Read the whole thing before touching code.

## What we are making

A Posh-style event page. A parent lands on it and in one glance knows: this is happening, this is when and where, these people are coming, and I can be one of them in thirty seconds. The page carries the flyer's energy (navy, gold, cream, the WE ARE RCAP lockup, the neon karaoke sign) and does three jobs:

1. RSVP. Name, phone, email, house, grade, an optional +1, an optional photo. No login.
2. Guest wall. Everyone who is coming, as a wall of chips: first name and last initial, house color, photo if they added one, a "+1" badge if they are bringing someone. A live count up top.
3. Comments. A short thread under the event. "Pick your song." "Who's riding from College Park?" Only people who have RSVP'd can post.

Built so the next event is a row in a table, not a new page.

## Decisions already made

- Identity: name + phone + email, no login. A private edit link (token in the URL) lets a parent change or cancel their RSVP later. Comments and photos require an RSVP first.
- Guests: one RSVP per person, with an optional +1 (a named spouse, partner or friend). Two parents from one family can each RSVP or one can bring the other as a +1. Either is fine.
- Guest wall shows first name + last initial, house color, photo if provided. Phone and email are never rendered anywhere public.
- Adults only. Say it once on the page, plainly.
- No capacity cap for this event. Build the field so a later event can set one.
- No em dashes in any reader-facing copy. No exclamation points in body copy.

## Route and entry

- New Vite entry `rsvp` at `rsvp/index.html`, mounted at `/rsvp/`. Add a Vercel rewrite so `/rsvp/:slug` serves that entry, and the app reads the slug from `location.pathname`.
- First event slug: `karaoke-sept-27`. Short redirect `/karaoke` to `/rsvp/karaoke-sept-27` for the flyer and the recap email.
- Source lives in `src/rsvp/` following the `src/carpool/` and `src/committee/` conventions: `main.jsx`, `App.jsx`, `api.js`, `model.js`, `rsvp.css`, `views/`. Supabase client is the shared one at `src/carpool/supabaseClient.js`.
- OG image: `public/rsvp-karaoke-og.png`, rendered with `docs/og-render.mjs` like the others. Use the flyer's mic and neon sign.

## The page, top to bottom

**Hero.** The WE ARE RCAP. lockup on cream, then the flyer's dark band: PARENT SOCIAL / R&B KARAOKE, date, time, "at Ron Clark Academy," the mic. Directly under the band, before anything else scrolls into view: the guest count ("38 parents are in") and the RSVP button. Both the count and the button are visible without scrolling on a phone.

**Guest wall.** A grid of chips, newest first. Each chip: a 44px circle (photo, or initials on the house color), first name and last initial beneath, "+1" pill when they bring someone. The house colors are the four already in `src/directory/model.js` (`HOUSES`). No house picked gets the navy. Tapping a chip does nothing. It is a wall, not a directory.

**Details.** Three lines with icons: when, where (with a Maps link to RCA, 228 Margaret St SE), who (RCA parents, adults only). One paragraph of copy in the house voice. Something like: "Two hours. A mic. The parents you wave at in the carpool line. Bring a song or bring a friend who has one."

**Comments.** Heading "The thread." Each comment: the same chip avatar, first name and last initial, relative time, the text. Composer at the bottom, shown only to a browser that holds an RSVP token; otherwise a line that says "RSVP to join the thread" and scrolls to the button. Max 280 characters. No replies, no likes. Keep it a wall of short notes.

**Footer.** The shared RCAP footer language. "Organized by parent volunteers. Not sponsored by or affiliated with Ron Clark Academy."

## RSVP flow

Opens as a sheet from the bottom on phone, a centered card on desktop. One screen, not a wizard. Fields in this order:

1. Your name (first and last, one field; we derive the wall label)
2. Phone (required, US format, stored E.164)
3. Email (required)
4. Your house (four chips with house colors, plus "Not sure yet")
5. Your student's grade (chips: 5, 6, 7, 8; multi-select, since some families have two)
6. Bringing someone? (toggle, reveals one field: their name)
7. Add a photo (optional, one image, square-cropped client side to 400px, JPEG, under 300 KB before upload)

Button: "I'm in." Then the done state replaces the sheet: "You're on the wall." with their chip rendered, an "Add to calendar" link (.ics), and "Change or cancel" pointing at their private link `/rsvp/karaoke-sept-27?t=<token>`.

Confirmation email goes out through the same pattern as `committee-confirm` (an edge function that reads the address off the row by token, refuses to send twice). Contents: date, time, address, the private link, "Add to calendar," and the flyer.

Progressive save is not needed here. One insert on submit. If it fails, keep the sheet open and show the error.

Returning visitor: the token in `localStorage` (`rcap_rsvp_<slug>`) or in `?t=` opens the page in the "you're in" state, with the comment composer unlocked and an edit button.

## Data model

All writes go through security-definer RPCs. Tables have no anon grants. Reads that the public needs come from views that expose only public fields.

```sql
create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,              -- "Parent Social: R&B Karaoke"
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue_name text not null,         -- "Ron Clark Academy"
  venue_address text,
  blurb text,
  hero_image text,                  -- public path
  capacity int,                     -- null = open
  allow_plus_one boolean default true,
  comments_open boolean default true,
  status text default 'open',       -- open | closed | past
  created_at timestamptz default now()
);

create table public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  token uuid unique not null default gen_random_uuid(),   -- the private link
  full_name text not null,
  wall_name text not null,          -- "Jamelia J." derived server side
  phone text not null,              -- E.164
  email text not null,
  house text,                       -- amistad | isibindi | reveur | altruismo | null
  grades int[] default '{}',
  plus_one_name text,
  photo_path text,                  -- storage path, nullable
  status text default 'going',      -- going | cancelled
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (event_id, phone)          -- one RSVP per phone per event
);

create table public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  rsvp_id uuid references public.event_rsvps(id) on delete cascade,
  body text not null check (char_length(body) <= 280),
  hidden boolean default false,     -- admin moderation
  created_at timestamptz default now()
);
```

Public read views (grant select to anon):

- `event_public`: everything on `events` except nothing sensitive is there anyway; include `going_count` as a subquery over `event_rsvps where status = 'going'`, counting +1s too.
- `event_wall`: `rsvp id, event_id, wall_name, house, has_plus_one, photo_url, created_at` for `status = 'going'`. No phone, email, full name, or grades.
- `event_thread`: `comment id, event_id, body, created_at, wall_name, house, photo_url` joined through the rsvp, where `hidden = false`.

RPCs (security definer, `search_path` pinned, every one of them):

- `event_rsvp_upsert(p_slug, p_token, p_payload jsonb)` returns the token. Creates on first call, updates on later calls with a matching token. Enforces `unique (event_id, phone)`: a second RSVP with the same phone and a different token returns an error that the UI turns into "That number is already on the wall. Check your email for your link." Derives `wall_name`. Validates phone with a regex, email loosely, house against the four keys, grades against 5 to 8.
- `event_rsvp_cancel(p_token)` sets `status = 'cancelled'`.
- `event_comment_post(p_token, p_body)` inserts a comment for the RSVP behind that token. Rate limit: refuse if that rsvp posted in the last 20 seconds.
- `event_admin_hide_comment(p_id)` and `event_admin_export(p_slug)` gated on `public.is_admin()` from the carpool schema.

Storage: bucket `event-photos`, public read, upload only through a signed upload URL minted by `event_photo_upload_url(p_token)` so only a token holder can write, and only to `<event>/<rsvp_id>.jpg`. Same shape as the `directory-photos` bucket.

Seed the first event row in the migration itself so the page works the moment it deploys.

## Notifications

- Parent: confirmation email on RSVP (edge function `event-confirm`, Resend, same as committee). A reminder the morning of is a nice-to-have. Build the function so it can be called with `kind = 'confirm' | 'reminder'`.
- Board: reuse `notify` / `wik-telegram` pattern to post to the board Telegram on each new RSVP and each new comment: "Jamelia J. is in (+1). 39 going." Comments need eyes, since they are public.

## Admin

Add a card to the existing back office rather than a new admin page: RSVP list with full names, phones, emails, house, grades, +1 names, and a CSV export; comment moderation (hide/unhide). Gate on `is_admin()`. Keep it plain. It is a list.

## Copy, in the house voice

- Hero eyebrow: PARENT SOCIAL · SEPT 27
- Count line: "38 parents are in." At zero: "Be the first name on the wall."
- Button: "I'm in"
- Done state: "You're on the wall."
- Duplicate phone: "That number is already on the wall. Check your email for your link."
- Comment lock: "RSVP to join the thread."
- Adults-only line: "Adults only. Leave the kids with someone who loves them."
- Thread heading: "The thread"
- No em dashes. No exclamation points.

## Design notes

- Palette from the flyer: navy `#1a2a56`, gold `#f0b323`, cream `#faf4ea`, ink `#1a1613`. Photo band uses the flyer image itself as a background with a navy overlay.
- Type: Archivo (already loaded site-wide) for the lockup and headings, weights 800 and 900; system sans for body.
- The wall should feel like it is filling up. New chips animate in (scale from 0.6, 200ms, ease-out-back) on first paint and on realtime insert. Use Supabase Realtime on `event_rsvps` inserts so a parent watching the page sees the room fill.
- The RSVP button is sticky at the bottom on phone until the parent has RSVP'd, then it disappears and the composer takes its place.
- Phone first, not desktop. Test on iOS Safari; the sheet, the photo picker, and the sticky button are the three things that break there.

## Build order

1. Migration: tables, views, RPCs, storage bucket, seed the karaoke event. Run `get_advisors` after; fix every mutable `search_path` warning it raises on the new functions.
2. `src/rsvp/model.js` with validation (phone normalization, wall name derivation, house and grade checks) and tests. Port `HOUSES` from the directory model rather than duplicating.
3. `api.js`: `loadEvent(slug)`, `loadWall`, `loadThread`, `rsvp`, `cancel`, `comment`, `uploadPhoto`, token helpers.
4. Page: hero, count, wall, details, thread, footer. Static data first.
5. RSVP sheet and done state. Then the private link and edit path.
6. Comments composer and realtime.
7. `event-confirm` edge function and the Telegram hook.
8. Admin card and export.
9. OG image, `/karaoke` redirect, Vercel rewrite.
10. Vitest coverage for model and api (mock supabase like `src/carpool/*.test.js`). `npm test` clean before push.
11. Update the recap email: the two karaoke links go to `https://wearercap.org/karaoke`.

## Open questions for Mose

- Capacity for the room? Left open for now.
- Should a parent be able to see who else is going before they RSVP? Plan says yes (the wall is public). Posh does this and it is the point.
- Photo moderation: photos go live immediately. Admin can remove. Is that acceptable for a parent audience, or should photos wait for approval?
- Reminder text the morning of: email only, or SMS through Twilio (cost per message)?

## Where things are

- Repo: `mosejames/wearercap.org`, `main`. Local: `~/Desktop/Claude/wearercap.org`. Git only from the native Mac shell.
- Supabase project `kcsrtwwpnekqdrfgcfys`. Migrations via `apply_migration`, timestamp-named.
- Flyer: `public/meeting/sept-14/parent-social-flyer.jpg` (1000x1500). Source PNG is 1024x1536.
- Existing patterns to copy: `src/committee/api.js` (token + definer RPC), `src/directory/media.js` (client-side image resize), `supabase/functions/committee-confirm` (email by token), `supabase/functions/wik-telegram` (board alerts).
