# We Are RCAP Carpool Matching — Design Spec

**Date:** 2026-07-17
**Owner:** Mose James IV
**Lives at:** `wearercap.org/carpool`
**Status:** Approved design, pre-implementation

---

## Problem

Ron Clark Academy families commute to school from across metro Atlanta and beyond. A carpool committee used to match families by hand: parents filled out a PDF survey, emailed it to `rcapcarpool@gmail.com`, and the committee paired people by zip code and mailed back a list. Families then coordinated their own carpools.

The committee is being revived, and the ask is to digitize it. The goal of the digital version is narrow and specific: **remove the manual middle step**. Parents self-serve, the system does the proximity + schedule matching instantly, and families still build and run the actual carpools themselves. "We organize it, parents build it from there."

## Goals

- Parents sign in, enter their family + schedule once, and immediately see who is near them.
- Matching is by proximity **and** schedule overlap, surfaced as both a map and a ranked nearby list.
- Families form **carpool groups** (not just one-to-one pairs); multiple families in one pocket share a rotation.
- Children's names and home locations are protected: gated access, coarse location shown to others, contact details hidden until families are in a group together.
- A small committee can administer it (approve members, oversee, export) without engineering help.

## Non-Goals (YAGNI)

- No in-app messaging. Families connect via revealed phone/email once grouped.
- No route/direction-of-travel matching in v1 (proximity + schedule only).
- No automated carpool scheduling, driver rotation, or day-to-day logistics. Groups handle that themselves off-platform.
- No payments, no rich admin reporting/merging tools in v1.
- No committee pre-seeding of existing carpools (considered; declined for v1).

## Product Decisions (locked)

| Decision | Choice |
|---|---|
| Find model | Map **and** ranked nearby list together |
| Location shown to others | Snapped to zip / area center (never the real house). Real address used only for behind-the-scenes distance math. |
| Access gate | Magic-link sign-in **+ admin approval** of new signups (pending queue) |
| Connecting | Request to **join a group**; contact info unlocks only between group-mates |
| Group formation | Families can **create** a group **and** the system **suggests** nearby clusters (both) |
| Group membership | A family may belong to **multiple** groups (e.g. separate AM and PM groups) |
| Form depth | Name, child name(s), address (with Places autocomplete), **AM/PM/both**, **weekdays**, contact |
| Admin | Mose **+ a couple committee admins**; approve, master map, remove, CSV export |
| Notifications | Transactional email at each loop step (see Notifications section) |
| Freshness | Family status toggle (looking / matched / inactive) + annual school-year re-confirmation |

## Approach (chosen: A)

A `/carpool` React area inside the existing wearercap.org Vite site, backed by **Supabase** (Postgres + magic-link auth + row-level security) and **Google Maps Platform** (Geocoding + Maps JS). Chosen over hand-rolled auth (Approach B) and a low-code Airtable backend (Approach C) because it enforces the privacy model **at the database layer** rather than relying on client-side discipline, while keeping custom code small enough for one maintainer. Both new services confirmed acceptable; free/near-free at school scale.

## Architecture

```
wearercap.org (Vite + React, Vercel, auto-deploy from main)
   └── /carpool  ── React area
         ├── Sign-in (email → magic link; pending → approved)
         ├── Parent app (family form, map + nearby list, groups, my requests)
         └── Admin panel (approve, master map, remove, export)
               │
               ▼
   Supabase ── Auth (magic links) + Postgres + Row-Level Security
               │            └── Edge function → email sender (transactional notifications)
               ▼
   Google Maps Platform ── Geocoding + Places autocomplete (form) + Maps JS (display)
```

**Integration note:** the current site is a single-entry Vite SPA (`src/main.jsx`, no router). Adding `/carpool` requires either introducing a router (e.g. react-router) with a lazy-loaded carpool area, or a separate Vite multi-page entry. Exact mechanism is deferred to the implementation plan; either keeps the marketing site untouched.

### Units (each independently understandable/testable)

- **auth** — magic-link sign-in, session, approval-status gating.
- **family profile** — create/edit own family; owns geocoding on save.
- **map + list view** — render approved families + groups near the viewer, snapped to zip area; ranked list.
- **suggestion engine** — pure function: given a family, return nearby families/groups with overlapping schedule.
- **groups** — create group, browse, join-request lifecycle, membership → contact reveal.
- **notifications** — edge function watching lifecycle events; sends transactional email. Fire-and-forget; app works if email fails.
- **admin** — approval queue, master map, remove, export.
- **privacy layer (RLS policies)** — the enforcement boundary; not UI.

## Data Model (five tables)

**families**
- id, user_id (auth link)
- parent_name, child_names
- address (real, protected), lat, lng (real coords, protected)
- area_lat, area_lng (zip/area-center coords — the only location exposed to non-group-mates)
- zip / area label
- direction: `am` | `pm` | `both`
- weekdays (set of Mon–Fri)
- contact_phone, contact_email (protected; revealed to group-mates + admins)
- approval: `pending` | `approved` (set by admin)
- availability: `looking` | `matched` | `inactive` (set by the family; keeps the map honest — matched/inactive families drop out of nearby lists and suggestions but keep their memberships)
- school_year (e.g. `2026-27`) + confirmed_at — annual re-confirmation; unconfirmed families from a prior year are treated as inactive until they confirm
- timestamps

**groups**
- id, name, area label, direction (`am`/`pm`/`both`), weekdays
- meeting_point (optional: label + coords, e.g. a park-and-ride or shopping-center lot; visible to members and to nearby families browsing the group)
- created_by (family id), status: `open` | `full`
- timestamps

**memberships**
- id, group_id, family_id, joined_at
- (a family may have many rows across different groups)

**join_requests**
- id, group_id, requesting_family_id
- status: `pending` | `accepted` | `declined`, timestamps

**admins**
- email (or user_id), granted_by, timestamp

## Privacy Model (the core requirement)

The system knows every real address so it can compute true distance. The database refuses to hand a family's **real address, real coordinates, or contact info** to anyone except: (1) the family itself, (2) its current group-mates, (3) admins. Everyone else receives only: parent name, child name(s), zip-area pin, schedule.

Enforced via Supabase **row-level security policies**, not client code — a tampered page still cannot read protected columns. Practically this means the exposed location and the protected location are **separate columns**, and the "others" read path selects only the exposed set.

Contact reveal is a consequence of membership: two families sharing a row-set in `memberships` for the same group can read each other's contact fields; no membership, no contact.

## Key Flows

**New parent:** sign in (magic link) → if new, land in pending until admin approves → fill family form (address entered once via Places autocomplete, geocoded in background into real coords + derived area-center) → map + nearby list → request to join a nearby group **or** create one.

**Create group:** name + direction + weekdays → appears on the map for nearby families → creator approves join requests → on first accepted member, group-mates' contacts unlock for each other.

**Suggestion:** for a family, find approved, **currently-looking** families whose **area is within a radius** (start ~3 miles, tunable) **and** whose direction + weekday needs overlap; rank by distance; surface top few, plus matching existing groups. Pure proximity + schedule filter — same logic the committee did by hand, made instant. No ML.

**Found a carpool / stepping away:** a family flips its availability to `matched` (or `inactive`). It vanishes from nearby lists and suggestions but keeps its group memberships and contact reveals. Flipping back to `looking` restores visibility. Groups similarly flip `open`/`full`.

**Year rollover:** at the start of each school year, all families are prompted (email + in-app banner) to re-confirm their info for the new year. Unconfirmed families are treated as inactive until they do, so year two never launches on stale pins. Admins can trigger the rollover.

**Admin:** approve/deny pending signups; master map of all families + groups; remove a family/group; export CSV; trigger year rollover.

## Notifications

Transactional email at each step of the loop, sent by a Supabase edge function through a free-tier email provider (e.g. Resend); provider choice deferred to the implementation plan. Fire-and-forget: a failed email never blocks the underlying action.

| Event | Who gets emailed |
|---|---|
| Signup approved by admin | The new family |
| Join request submitted | The group's creator |
| Join request accepted / declined | The requesting family |
| New family (status `looking`) approved within radius of you | Nearby looking families (batched/throttled so it never spams) |
| Year rollover opens | All families ("confirm your info for the new year") |
| New signup pending | Admins |

No marketing email, no digest engine — lifecycle pings only.

## Known Deliberate Choices / Risks

- **Area snapping starts at zip-center.** Two families a street apart in different zips can look far; a large rural zip can look misleadingly close. Ship zip-center first; refine to a neighborhood grid only if it feels off in practice.
- **Google Maps billing.** Requires a billing account + API key with usage caps set so it stays within free tier at school scale. Key restricted to the wearercap.org origin.
- **Children's data.** Names + home areas of minors. This is the reason for admin-gated access, coarse public location, and DB-enforced (not UI-enforced) privacy. Any change that would expose more must be evaluated against this.
- **Router introduction.** Adding `/carpool` touches the site's entry setup for the first time; must not disturb existing marketing pages or the `public/<name>/` standalone pages.
- **Meeting points are semi-public.** A group's meeting point is visible to nearby browsing families (that's its job), so the UI must steer creators toward public spots (lot, park-and-ride) and never default it to anyone's home address.
- **Nearby-family emails need throttling.** The "new family near you" ping is the one notification that could annoy at scale; batch it (e.g. at most one such email per family per day) from day one.

## Success Criteria

- A parent can sign in, enter their family, and see accurate nearby families + groups on both map and list, filtered by schedule.
- A non-group-mate can never obtain another family's exact address or contact info (verified against RLS, not just UI).
- Families can create and join multiple groups; contact info reveals only within a shared group.
- The system suggests relevant nearby clusters by proximity + schedule, considering only families currently looking.
- Every lifecycle step (approval, join request, accept/decline) triggers an email to the right person without blocking the action itself.
- A family can mark itself matched/inactive and disappear from suggestions without losing its groups.
- Admins can approve, oversee via master map, remove, export, and run the annual rollover — with no code changes.
