# Carpool Phase 2B: Map, One-Sitting Onboarding & Lifecycle Emails — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A parent signs in and does everything in one sitting — fill the family form immediately (even while approval is pending), land on a map centered on their area — and the waiting moves to the background: pending parents see a live count of families already near them, admins get emailed on every new signup, parents get emailed on approval, and approved families get emailed when someone new appears nearby. Approved parents see the full map + ranked nearby list.

**Architecture:** A migration relaxes the `families` write policies from approved-member to any-member (own row only), and adds two SECURITY DEFINER RPCs: `family_directory()` (safe columns only, approved members only) and `area_family_count()` (an integer, any member). The client restructures routing so `pending` users reach the same family-form/map surface as `ready` users, with a pending banner and count teaser instead of the directory. The map renders Google Maps pins at zip-centroid area points with a haversine-ranked nearby list (pure, tested). A single Supabase Edge Function `notify` — triggered by database webhooks on `members` INSERT, `members` UPDATE, and `families` INSERT — sends the three lifecycle emails via Resend using the service-role key (server-side only).

**Tech Stack:** Existing Vite/React/Supabase/Google Maps stack; adds Google Maps `maps`+`marker` libraries, Supabase Edge Functions (Deno), Resend for email, Supabase Database Webhooks.

## Global Constraints

- **Privacy is DB-enforced.** `family_directory()` may return ONLY: `user_id, parent_name, child_names, area_lat, area_lng, area_label, direction, weekdays` — never `address`, `lat`, `lng`, `contact_*` — and only to APPROVED members. `area_family_count()` returns a bare integer to any member (Mose's decision: count-only teaser for pending users). Real address/coords/contact stay readable by owner/admin only (existing SELECT policy unchanged).
- **Writes stay own-row-only.** Relaxing insert/update to pending members must NOT allow writing another user's row.
- **Secrets stay server-side.** `RESEND_API_KEY` and the service-role key live in Supabase Edge Function secrets — never in Vite env, never in the client bundle, never committed.
- **Nearby-notification throttle from day one:** at most ~1 nearby email per recipient per day (`nearby_notified_at` on `families`).
- **Do not disturb** the marketing homepage or the shipped Phase 1/2A behavior beyond what this plan specifies. `resolveView`'s contract is unchanged (App routing changes instead).
- Vite inlines env at build time; site auto-deploys on push to `main`.
- Google APIs change: for the Maps rendering and Edge Function/webhook surfaces, VERIFY current docs before writing code (marker guidance: `AdvancedMarkerElement` needs a Map ID; use one if provided, else `DEMO_MAP_ID`).

## Carry-over facts (do not re-derive)

- Supabase ref `kcsrtwwpnekqdrfgcfys`; migrations applied by pasting into the SQL Editor. `0001` = members + `is_admin()`; `0002` = families + `is_approved_member()` + column-split RLS.
- `src/carpool/`: `supabaseClient.js` (named `{ supabase }`), `auth.js` (`resolveView`, `fetchMember`, `ensureMemberRow`), `family.js` (`buildFamilyRecord`, `fetchFamily`, `saveFamily`), `maps.js` (lazy `loadPlaces`/`loadGeocoding` via `setOptions`+`importLibrary`), views: `SignedOut`, `Pending` (to be retired), `Ready` (form/summary + admin link), `AdminApprovals`, `FamilyForm`.
- `resolveView(session, member)` → `signed-out | pending | ready | admin`. App currently routes `pending` → Pending screen; `ready`/`admin` → Ready.
- Stale-address guard compares against the widget's displayed text at selection time (NOT `formattedAddress`).
- Google key `VITE_GOOGLE_MAPS_KEY` is referrer-restricted; Maps JS + Places New + Geocoding enabled.

## External Setup (Mose, in a browser; the plan says when)

- **R1. Resend account** at resend.com (free tier). Create an **API key**. Needed by Task 5.
- **R2. Domain.** Verify `wearercap.org` in Resend (DNS records) so emails send from e.g. `carpool@wearercap.org`. Until verified, Resend's sandbox sender only delivers to the account owner's own address — fine for testing, not for launch.
- **R3. Set Edge Function secrets** in Supabase (Dashboard → Edge Functions → Secrets): `RESEND_API_KEY`, `NOTIFY_FROM` (e.g. `RCA Carpool <carpool@wearercap.org>`), `SITE_URL` (`https://wearercap.org/carpool/`). Needed by Task 5.
- **M1 (optional). Map ID:** Google Cloud → Maps Platform → Map Management → create a Map ID (JS, vector) as `VITE_GOOGLE_MAPS_MAP_ID` in Vercel + `.env.local`. If skipped, code falls back to `DEMO_MAP_ID`.
- **G. Apply migration `0003`** (Task 1) in the SQL Editor; create the three Database Webhooks (Task 5, exact fields given there).

---

## Task 1: Migration 0003 — member writes, directory + count RPCs, throttle column

**Files:**
- Create: `supabase/migrations/0003_onboarding_map.sql`

**Interfaces:**
- Consumes: `public.members`, `public.families`, `public.is_admin()`, `public.is_approved_member()`.
- Produces: `public.is_member()`; replaced `families` insert/update policies (own row + any member); `public.family_directory()` returning the 8 safe columns to approved members (empty set otherwise); `public.area_family_count(radius_miles double precision default 5)` returning `integer` (families other than caller's within radius of caller's area point; 0 if caller has no family row); `families.nearby_notified_at timestamptz null`.

> Author the file only; Mose applies it (G). No DB access from the implementer.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0003_onboarding_map.sql`:

```sql
-- Phase 2B: one-sitting onboarding + map.
-- 1) Pending members may create/edit THEIR OWN family row (approval no longer
--    gates writing your own profile — it gates seeing others).
-- 2) family_directory(): the ONLY cross-family read path. Safe columns only,
--    approved members only.
-- 3) area_family_count(): count-only teaser for pending members.
-- 4) nearby_notified_at: throttle for "new family near you" emails.

-- Any member (pending or approved)?
create or replace function public.is_member()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

-- Relax writes: own row + any member (was: own row + approved member).
drop policy if exists families_insert_self_approved on public.families;
drop policy if exists families_update_self_approved on public.families;

create policy families_insert_self_member
  on public.families for insert
  with check (user_id = auth.uid() and public.is_member());

create policy families_update_self_member
  on public.families for update
  using (user_id = auth.uid() and public.is_member())
  with check (user_id = auth.uid() and public.is_member());

-- Throttle column for nearby notifications.
alter table public.families
  add column if not exists nearby_notified_at timestamptz;

-- The one sanctioned cross-family read: safe columns, approved members only.
-- SECURITY DEFINER bypasses families RLS; the WHERE clause is the gate.
create or replace function public.family_directory()
returns table (
  user_id uuid,
  parent_name text,
  child_names text,
  area_lat double precision,
  area_lng double precision,
  area_label text,
  direction text,
  weekdays text[]
)
language sql
security definer
set search_path = public
as $$
  select f.user_id, f.parent_name, f.child_names,
         f.area_lat, f.area_lng, f.area_label, f.direction, f.weekdays
  from public.families f
  where public.is_approved_member();
$$;

revoke all on function public.family_directory() from public;
grant execute on function public.family_directory() to authenticated;

-- Count-only teaser for pending members: how many OTHER families sit within
-- radius_miles of the caller's own area point. 0 if the caller has no family
-- row yet. Haversine on area centroids (coarse by design).
create or replace function public.area_family_count(radius_miles double precision default 5)
returns integer
language sql
security definer
set search_path = public
as $$
  select coalesce((
    select count(*)::int
    from public.families f, public.families me
    where me.user_id = auth.uid()
      and f.user_id <> auth.uid()
      and public.is_member()
      and 3959 * acos(
            least(1.0,
              cos(radians(me.area_lat)) * cos(radians(f.area_lat))
              * cos(radians(f.area_lng) - radians(me.area_lng))
              + sin(radians(me.area_lat)) * sin(radians(f.area_lat))
            )
          ) <= radius_miles
  ), 0);
$$;

revoke all on function public.area_family_count(double precision) from public;
grant execute on function public.area_family_count(double precision) to authenticated;
```

- [ ] **Step 2: Verify structure** — `cat` the file; confirm: `is_member()` definer + pinned search_path; both old policies dropped and replaced with member (not approved) variants still bound to `user_id = auth.uid()`; `family_directory()` selects ONLY the 8 safe columns and is gated on `is_approved_member()`; count fn gated on `is_member()`; revokes/grants present on all three functions; `nearby_notified_at` added. Do NOT apply.

- [ ] **Step 3: Commit** — `git add supabase/migrations/0003_onboarding_map.sql && git commit -m "feat(carpool): member writes, directory/count RPCs, notify throttle"`

---

## Task 2: Directory helpers + haversine ranking (TDD)

**Files:**
- Create: `src/carpool/directory.js`
- Create: `src/carpool/directory.test.js`

**Interfaces:**
- Consumes: `{ supabase }`.
- Produces:
  - `milesBetween(aLat, aLng, bLat, bLng)` → number (haversine, statute miles). PURE.
  - `rankNearby(me, families, { limit = 20 } = {})` → families (excluding `me.user_id`) each annotated `{ ...f, distanceMiles }`, sorted ascending; ties by `parent_name`. PURE. `me` is `{ user_id, area_lat, area_lng }`.
  - `fetchDirectory()` → `Promise<row[]>` via `supabase.rpc('family_directory')`.
  - `fetchAreaCount()` → `Promise<number>` via `supabase.rpc('area_family_count')`.

- [ ] **Step 1: Failing tests**

Create `src/carpool/directory.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { milesBetween, rankNearby } from './directory.js';

const CP = { lat: 33.6534, lng: -84.4494 };   // College Park
const DECATUR = { lat: 33.7748, lng: -84.2963 };

describe('milesBetween', () => {
  it('is zero for identical points', () => {
    expect(milesBetween(CP.lat, CP.lng, CP.lat, CP.lng)).toBe(0);
  });
  it('College Park to Decatur is roughly 12-14 miles', () => {
    const d = milesBetween(CP.lat, CP.lng, DECATUR.lat, DECATUR.lng);
    expect(d).toBeGreaterThan(11);
    expect(d).toBeLessThan(15);
  });
  it('is symmetric', () => {
    expect(milesBetween(CP.lat, CP.lng, DECATUR.lat, DECATUR.lng))
      .toBeCloseTo(milesBetween(DECATUR.lat, DECATUR.lng, CP.lat, CP.lng), 10);
  });
});

describe('rankNearby', () => {
  const me = { user_id: 'me', area_lat: CP.lat, area_lng: CP.lng };
  const families = [
    { user_id: 'far', parent_name: 'Far Fam', area_lat: DECATUR.lat, area_lng: DECATUR.lng },
    { user_id: 'me', parent_name: 'Me', area_lat: CP.lat, area_lng: CP.lng },
    { user_id: 'near', parent_name: 'Near Fam', area_lat: 33.66, area_lng: -84.45 },
  ];
  it('excludes self, sorts by distance, annotates distanceMiles', () => {
    const r = rankNearby(me, families);
    expect(r.map((f) => f.user_id)).toEqual(['near', 'far']);
    expect(r[0].distanceMiles).toBeLessThan(r[1].distanceMiles);
    expect(typeof r[0].distanceMiles).toBe('number');
  });
  it('respects limit', () => {
    expect(rankNearby(me, families, { limit: 1 })).toHaveLength(1);
  });
  it('handles empty input', () => {
    expect(rankNearby(me, [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm RED** — `npm test src/carpool/directory.test.js` → fails (module not found).

- [ ] **Step 3: Implement**

Create `src/carpool/directory.js`:

```js
import { supabase } from './supabaseClient.js';

const EARTH_RADIUS_MILES = 3959;

export function milesBetween(aLat, aLng, bLat, bLng) {
  const toRad = (d) => (d * Math.PI) / 180;
  const h =
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.cos(toRad(bLng) - toRad(aLng)) +
    Math.sin(toRad(aLat)) * Math.sin(toRad(bLat));
  return EARTH_RADIUS_MILES * Math.acos(Math.min(1, h));
}

export function rankNearby(me, families, { limit = 20 } = {}) {
  return families
    .filter((f) => f.user_id !== me.user_id)
    .map((f) => ({ ...f, distanceMiles: milesBetween(me.area_lat, me.area_lng, f.area_lat, f.area_lng) }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles || a.parent_name.localeCompare(b.parent_name))
    .slice(0, limit);
}

export async function fetchDirectory() {
  const { data, error } = await supabase.rpc('family_directory');
  if (error) throw error;
  return data ?? [];
}

export async function fetchAreaCount() {
  const { data, error } = await supabase.rpc('area_family_count');
  if (error) throw error;
  return data ?? 0;
}
```

- [ ] **Step 4: GREEN + full suite** — `npm test` → all pass (12 prior + 6 new).
- [ ] **Step 5: Commit** — `git add src/carpool/directory.js src/carpool/directory.test.js && git commit -m "feat(carpool): directory fetch + haversine nearby ranking (tested)"`

---

## Task 3: Route pending users into the one-sitting flow

**Files:**
- Modify: `src/carpool/App.jsx`
- Modify: `src/carpool/views/Ready.jsx`
- Delete: `src/carpool/views/Pending.jsx`

**Interfaces:**
- `resolveView` and its tests are UNTOUCHED. App maps `pending` → `<Ready isPending />`, `ready` → `<Ready />`, `admin` → `<Ready isAdmin />`.
- `Ready({ isAdmin = false, isPending = false })`: pending users get the same form/summary surface plus a banner: "You're awaiting approval — a committee admin has been notified. You can set up your family now." Pending users NEVER see the admin bar. Pass `isPending` down so Task 4's map view can choose count-teaser vs full directory.

- [ ] **Step 1:** In `App.jsx`: remove the `Pending` import and the `if (view === 'pending') return <Pending />;` line; replace final routing with:

```jsx
  if (view === 'signed-out') return <SignedOut />;
  // One-sitting onboarding: pending parents fill their family and see the
  // map teaser immediately; approval gates only other families' details.
  return <Ready isAdmin={view === 'admin'} isPending={view === 'pending'} />;
```

- [ ] **Step 2:** In `Ready.jsx`: accept `isPending = false`; render (above everything, in both form and summary branches) when `isPending`:

```jsx
  const pendingBanner = isPending ? (
    <div className="carpool-shell" style={{ paddingBottom: 0 }}>
      <p><strong>You're awaiting approval.</strong> A committee admin has been notified — meanwhile, set up your family below.</p>
    </div>
  ) : null;
```

Include `{pendingBanner}` before `{adminBar}` in both return branches. Keep `adminBar` admin-only as-is. Pass `isPending` through to the summary branch for Task 4's use (a comment marker is enough: `{/* Task 4 mounts MapView here with isPending */}` replacing the "The map of nearby families arrives next." line is done in Task 4 — leave the line for now).

- [ ] **Step 3:** Delete `src/carpool/views/Pending.jsx` (no remaining imports — grep to confirm).
- [ ] **Step 4:** `npm test && npm run build` → 18 tests pass; build emits both entries.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(carpool): pending parents get the one-sitting form flow"`

---

## Task 4: MapView — pins at area centroids + ranked nearby list / count teaser

**Files:**
- Modify: `src/carpool/maps.js` (add `loadMaps()` + `loadMarker()` memoized loaders, same pattern)
- Create: `src/carpool/views/MapView.jsx`
- Modify: `src/carpool/views/Ready.jsx` (mount MapView in the summary branch, replacing the "arrives next" line)

**Interfaces:**
- `MapView({ family, isPending })`. `family` is the caller's own row (has `area_lat/area_lng/area_label`).
- Pending: shows the map with ONLY the caller's pin + the count teaser from `fetchAreaCount()` ("N families are already in your area — they'll appear when you're approved." / "You're the first in your area — invite a neighbor!"). NO directory call.
- Approved: calls `fetchDirectory()`, renders one pin per family at `(area_lat, area_lng)` (multiple families sharing a centroid get a small deterministic jitter ~0.002° based on index so pins don't fully overlap — display only), plus a list from `rankNearby(family, rows)` showing name, child(ren), area label, schedule, and `X.X mi`.
- VERIFY current docs before coding (Maps JS `importLibrary('maps')` → `Map`; `importLibrary('marker')` → `AdvancedMarkerElement`, which requires `mapId` — use `import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? 'DEMO_MAP_ID'`): https://developers.google.com/maps/documentation/javascript/advanced-markers/start
- Map container needs an explicit height (~380px) in `carpool.css`. Guard effects against unmount; errors surface in-view (`role="alert"`), never a blank page.

- [ ] **Step 1:** Add to `maps.js` (same memoized-IIFE pattern): `loadMaps()` → `importLibrary('maps')`, `loadMarker()` → `importLibrary('marker')`.
- [ ] **Step 2:** Write `MapView.jsx` per the interface above (verify docs first; structure: one effect loads maps+marker, creates `new Map(el, { center: {lat: family.area_lat, lng: family.area_lng}, zoom: 11, mapId })`, adds own pin; if approved, fetch directory → add pins → `setRows`; if pending, fetch count → `setCount`).
- [ ] **Step 3:** Mount in `Ready.jsx` summary branch: replace `<p>The map of nearby families arrives next.</p>` with `<MapView family={family} isPending={isPending} />`.
- [ ] **Step 4:** `npm test && npm run build` → green. (Live map render verified in Task 6.)
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(carpool): area map with nearby ranking and pending count teaser"`

---

## Task 5: `notify` Edge Function + Resend + database webhooks

**Files:**
- Create: `supabase/functions/notify/index.ts`
- Create: `docs/superpowers/plans/notes/2026-07-18-webhook-setup.md` (Mose's click-by-click for the 3 webhooks + secrets)

**Behavior (one function, three events, dispatched on payload `table` + `type`):**
1. `members` INSERT → email all approved admins: "New carpool signup: {email} is waiting for approval." Link `SITE_URL`.
2. `members` UPDATE where `record.approval = 'approved'` and `old_record.approval = 'pending'` → email that member: "You're approved — your carpool map is live." Link.
3. `families` INSERT → find APPROVED families (not the new one) within 5 miles of the new family's area point whose `nearby_notified_at` is null or > 24h ago; email each "A new family just joined the carpool map in your area"; update their `nearby_notified_at`. Never include the new family's name/address in the email — the recipient logs in to see the area pin. (Throttle + no-PII in email bodies are Global Constraints.)

**Implementation notes (VERIFY current docs):**
- Supabase Edge Functions (Deno): https://supabase.com/docs/guides/functions — use `Deno.serve`, service-role client via `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (auto-injected), `npm:@supabase/supabase-js` import.
- Webhook payload shape: https://supabase.com/docs/guides/database/webhooks (`{ type, table, record, old_record }`).
- Resend API: `POST https://api.resend.com/emails` with `Authorization: Bearer ${RESEND_API_KEY}`, JSON `{ from, to, subject, html }`.
- Fire-and-forget: each email wrapped in try/catch; a failure logs and continues (never 500 the webhook for one bad address). Haversine reimplemented in TS in the function (no shared import with the client).
- Deploy: preferred `npx supabase functions deploy notify --project-ref kcsrtwwpnekqdrfgcfys` (needs Mose's `SUPABASE_ACCESS_TOKEN` in the shell env, or `supabase login`); fallback: paste into Dashboard → Edge Functions editor. Function must be deployed with `--no-verify-jwt` (webhooks don't send a user JWT) — or set that in the dashboard.

**Webhook setup doc must specify, for each of the 3 webhooks:** Dashboard → Database → Webhooks → Create: table (`members`/`members`/`families`), events (INSERT / UPDATE / INSERT), type: Supabase Edge Function → `notify`, and add header `x-webhook-secret: <value Mose invents>` — the function checks this header against secret `WEBHOOK_SECRET` (add to R3 secrets) and 401s otherwise, so random internet POSTs can't trigger email sends.

- [ ] **Step 1:** Verify docs (function runtime, webhook payload, Resend API).
- [ ] **Step 2:** Write `supabase/functions/notify/index.ts` per behavior above, including the `x-webhook-secret` check.
- [ ] **Step 3:** Write the setup doc (secrets R3 incl. `WEBHOOK_SECRET`, deploy command + dashboard fallback, the 3 webhook configs, Resend R1/R2).
- [ ] **Step 4:** `npm test && npm run build` still green (function is outside the Vite build).
- [ ] **Step 5: Commit** — `git add supabase/functions docs/superpowers/plans/notes && git commit -m "feat(carpool): notify edge function (signup/approved/nearby emails)"`

---

## Task 6: Deploy + live acceptance

- [ ] **Step 1:** Mose: apply migration 0003 (G); Resend R1–R3 + `WEBHOOK_SECRET`; deploy the function; create the 3 webhooks; (optional M1 Map ID).
- [ ] **Step 2:** Merge to `main`, push (finishing-a-development-branch flow). Vercel builds.
- [ ] **Step 3: Live acceptance:**
  - Mose (approved, has family): map renders centered on 30337 with his pin; nearby list empty-state sensible.
  - New test account: sign in → form IMMEDIATELY (no pending dead-end) → save → map with own pin + "1 family is already in your area…" teaser → admin gets the signup email → approve from admin view → parent gets approved email → reload shows full map with both pins + ranked list showing distance.
  - Nearby email: on the test family's INSERT, Mose (approved, within 5 mi) receives the "new family in your area" email; a second immediate insert would NOT re-email him (throttle).
  - Privacy spot-checks: pending account's network calls contain NO directory data (only the count RPC); anonymous REST reads of `families`/`members` still return `[]`; `family_directory()` via REST with a pending user's JWT returns `[]`.

---

## Self-Review

- **Spec coverage:** one-sitting onboarding (Tasks 1 policy relax + 3 routing) ✓; count-only pending map (Tasks 1 RPC + 4) ✓; map + ranked nearby list (Tasks 2 + 4) ✓; three pulled-forward emails with throttle + admin fast-turnaround (Task 5) ✓; privacy invariants restated in Global Constraints and asserted in acceptance ✓. Groups/suggestions remain Phase 3; rollover/admin-panel extras remain Phase 4 — intentional.
- **Placeholder scan:** Tasks 1–3 carry complete code; Tasks 4–5 are deliberately verify-docs-first (Google marker + Edge Function surfaces churn) with full behavioral contracts — consistent with how Phase 2A handled Google surfaces.
- **Name consistency:** `family_directory` / `area_family_count` / `is_member` match between SQL, `directory.js` RPC calls, and MapView usage; `nearby_notified_at` matches Task 5; `isPending`/`isAdmin` prop names consistent across App/Ready/MapView. ✓

## Roadmap after 2B
- **Phase 3 — Groups:** groups/memberships/join_requests + RLS; create/browse/join; contact reveal on shared membership; proximity+schedule suggestions; meeting point; join-request emails.
- **Phase 4 — Remainder:** availability toggle, year rollover, admin master map/remove/CSV, rollover email.
