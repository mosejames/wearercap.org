# Carpool Group Handoff — Design

Date: 2026-07-20
Status: Approved in chat by Mose, pending spec review

## Origin

Feedback from Kita (Mose's wife) after registering and using the app: it is
easy and looks good, but once a group forms the app just stops. The last thing
a parent sees is a phone number, with no sense of what to do next or how the
group communicates going forward. Her guardrail, which shapes this whole
design: the app should NOT own the ongoing process (no daily reminders, no
running the carpool). It should provide "just a starter, to hand off."

Mose's refinement: a starter kit that is also actionable, and one that stays on
the group so a parent can refer back to it in real time (for example while
standing in the pickup line), not a popup that fires once and vanishes.

## What this is NOT

Not the re-engagement nudge ("your carpool is waiting", status buttons,
scheduled reminders, opt-out). That is a separate lifecycle subsystem, designed
and built on its own afterward. This spec is deliberately small: a persistent,
client-only panel. See "Deferred" at the end.

## Principle that keeps it safe

This feature adds ZERO new data exposure. Everything it acts on (group members'
names, phone numbers, emails) is already revealed to a group member through
`group_roster` (migration 0005) and already rendered in the roster today. The
handoff only makes what a member can already see *actionable*. Therefore:

- No database change, no migration, no new RLS, no security-review round.
- Pure front-end, in `src/carpool/views/Groups.jsx` plus one new small helper.

## Where it lives

A "Getting started" panel on each group in the **My groups** section of
`Groups.jsx`, rendered for EVERY member of that group (not organizer-only, so
any parent can restart the group text). Persistent: it is part of the group
card, always present, so it is the thing a parent reopens in real time. It sits
below the existing roster ("Families in this group"), because the roster is the
guaranteed fallback that the actions below depend on.

## The panel, two parts

### Part 1 — the action: "Start our group text"

A button that opens the parent's own Messages app with every group member who
has a phone number pre-added, and a starter message pre-filled. After the tap
the app is out of it; the thread belongs to the families.

Starter message (plain, editable by them once it opens):
> Hi, this is our RCA carpool group from wearercap. [organizer first name] set
> it up. Let's sort out who drives which days and a pickup time and spot.

Implementation is a pure, unit-tested helper `buildGroupText({ members,
message, platform })` that returns an `sms:` href, isolated because the `sms:`
scheme is the one genuinely fiddly part:

- **Platform divergence is real.** iOS wants `sms:/open?addresses=n1,n2&body=...`
  (ampersand before body); Android wants `sms:n1,n2?body=...` (question mark).
  The helper branches on a `platform` argument derived from `navigator.userAgent`
  (ios | android | other), and `other` gets the iOS-style form as the safest
  default. Both branches are unit-tested.
- **Phone was optional** on the family form. Only members with a phone are
  included. If NO member has a phone, the text button is not rendered at all
  and the panel leans on the email action below.
- **Best-effort, with a guaranteed fallback.** Group SMS with a prefilled body
  is the least reliable deep-link combination across phones; some only add the
  first recipient. Two things cover that: the roster with every number sits
  directly above, and a **"Copy the starter message"** button (clipboard) means
  a parent always has the text to paste even if the deep link only adds one
  person. Numbers visible + message copyable = the group text is always
  reachable by hand.

### Part 2 — the kit: a short checklist to refer to

Static reference guidance directly under the action, the three things a new
carpool must settle. NOT a tracked to-do list (no checkboxes, no persisted
state; that would be scope creep and a DB write for no real gain). Just the
prompt so nobody faces a blank thread:

- Who drives which days.
- The pickup time and spot. (If the group has a `meeting_point` set, show it
  here so the checklist references the real one.)
- A backup plan for a day someone cannot drive.

## Secondary, reliable channel: "Email everyone" (keep, low cost)

Because email is required on every family and multi-recipient `mailto:` is rock
solid on every platform, a quiet secondary "Email the group" link builds a
`mailto:` with all member emails and the same starter subject/body. This
guarantees at least one always-working group action even for a group where
nobody entered a phone. Rendered as a secondary link under the text button, not
a co-equal button, so texting stays the clear primary.

## Components / seams

- `src/carpool/groupHandoff.js` (new): pure helpers, fully unit-tested.
  - `starterMessage(organizerName)` -> string.
  - `groupTextHref({ members, message, platform })` -> `sms:` href or null
    (null when no member has a phone).
  - `groupEmailHref({ members, subject, body })` -> `mailto:` href.
  - `detectPlatform(userAgent)` -> 'ios' | 'android' | 'other'.
- `src/carpool/views/Groups.jsx`: render the panel per group in My groups,
  wiring the helpers to the roster data it already has. No new fetch. The
  organizer's first name comes from the roster (the group's `created_by`
  matched to that member's `parent_name`, first token).

## Copy rules

Plain, warm, parent-facing. No em dashes, no hyphens as sentence breaks, no
exclamation points. Consistent with the rest of the app.

## Testing

- Unit tests for every helper in `groupHandoff.js`: iOS vs Android vs other
  href shape, correct recipient list, phone-optional handling (some/none),
  message encoding, email href. This is where the real logic lives.
- No component test harness exists in the repo, so `Groups.jsx` rendering is
  verified by build + reading, consistent with existing views.
- Live acceptance on Mose's actual iPhone: tap "Start our group text" in a real
  group (Mose + Dana test accounts) and confirm Messages opens with recipients
  and the starter text. Confirm the copy button and email link. This is the
  step that proves the best-effort deep link on a real device.

## Deferred (next feature, its own spec)

Re-engagement nudge: "your carpool is waiting" reminder that fires on a
schedule (the July-signup, September-start gap is the point), with the status
buttons Kita and Mose floated (we already started / on hold / remind me later /
not interested-silence). This is a lifecycle subsystem: it needs a scheduler,
persisted per-person reminder state, and a real opt-out (silence must mean
forever, a consent obligation), and it draws on the shared Resend daily cap.
The unused `groups.status` column is the seed of the group-status half. Design
it as one connected system next.
