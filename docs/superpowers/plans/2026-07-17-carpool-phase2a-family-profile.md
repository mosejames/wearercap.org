# Carpool Phase 2A: Family Profile & Data Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An approved parent can create and edit their own family profile at `/carpool` — parent name, child name(s), home address (entered via Google address autocomplete), AM/PM/both, weekdays, and contact — with the real address, real coordinates, and contact details stored in DB columns that row-level security keeps private, and a coarse "area center" (zip centroid) stored separately as the only location that Phase 2B will ever expose to other families.

**Architecture:** A new `families` table keyed by `user_id`, with RLS that lets a member read/write ONLY their own row (admins read all). Real address/coords/contact live in protected columns; the exposed `area_*` columns hold the zip centroid. Reading OTHER families (the directory/map) is deliberately NOT possible via direct select and is deferred to Phase 2B's `family_directory()` RPC. The family form uses Google Maps Places autocomplete to capture the real address + coordinates, then geocodes the postal code to derive the zip-centroid area point. Everything integrates into the existing `Ready` view from Phase 1.

**Tech Stack:** Vite + React 18, `@supabase/supabase-js` v2 + Postgres RLS, Google Maps JavaScript API (Places + Geocoding) via `@googlemaps/js-api-loader`, Vitest.

## Global Constraints

From the design spec (`docs/superpowers/specs/2026-07-17-carpool-matching-design.md`) and Phase 1's shipped foundation. Every task implicitly includes these.

- **Privacy is DB-enforced, column-split.** The real `address`, real `lat`/`lng`, and `contact_phone`/`contact_email` are PROTECTED: no path in this phase lets any user read another user's row. Only the family itself and admins can read the full row. The EXPOSED location is `area_lat`/`area_lng`/`area_label` = the zip centroid (never the house). Phase 2B will expose only name + child + area + schedule to other approved members; this phase must not open any wider read path.
- **Only approved members may write a family.** Insert/update of a family row requires the caller to be an approved member (defense in depth behind the UI gate). RLS enforces it, not just the UI.
- **RLS on every table.** `families` ships with RLS enabled and no public read of other rows. The publishable/anon key is public; safety rests entirely on these policies.
- **Do not disturb** the marketing homepage (`src/main.jsx`, root `index.html`) or the Phase 1 carpool auth (`src/carpool/{App,auth,supabaseClient,main}.jsx`, `views/*`). Extend, don't rewrite.
- **Google Maps key is referrer-restricted** (safe in client) — never commit an unrestricted key; the key is a build-time env var like the Supabase ones.
- Site auto-deploys on push to `main`; `dist/` is gitignored, built by Vercel. Vite env vars are inlined at build time.

## Carry-over facts from Phase 1 (do not re-derive)

- Supabase project ref `kcsrtwwpnekqdrfgcfys`. Migrations live in `supabase/migrations/`; `0001_members.sql` created `public.members(user_id, email, role, approval)` + `public.is_admin()` (SECURITY DEFINER). Applied by pasting SQL into the Supabase SQL Editor (runs as table owner).
- `src/carpool/supabaseClient.js` exports a NAMED `supabase` client. All consumers use `import { supabase }`.
- `src/carpool/auth.js` has `resolveView(session, member)` → `signed-out|pending|ready|admin`, plus `fetchMember`/`ensureMemberRow`. The `Ready` view (`src/carpool/views/Ready.jsx`) is the approved-parent screen and currently just says "approved; Phase 2 coming."
- Env vars in `.env.local` (gitignored) and Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## External Setup (Mose does these in a browser; agent cannot)

- **G1. Create a Google Maps Platform API key.** In Google Cloud Console: create/select a project, enable **Maps JavaScript API**, **Places API**, and **Geocoding API**, then create an **API key**. Needed before Task 2 verification.
- **G2. Restrict the key.** Application restriction → **HTTP referrers**: add `https://wearercap.org/*` and `http://127.0.0.1:5173/*` (and `http://localhost:5173/*`). API restriction → limit to the three APIs above. Set a billing account (required by Google Maps) with a low budget alert; school-scale usage stays within the free monthly credit.
- **G3. Add the key to `.env.local` and Vercel** as `VITE_GOOGLE_MAPS_KEY` (Vercel: Production + Preview). Needed before Task 4 and before deploy.
- **G4. Apply migration `0002_families.sql`** by pasting it into the Supabase SQL Editor (Task 1 authors it; you run it, as the table owner).

---

## File Structure

- Create `supabase/migrations/0002_families.sql` — `families` table, `is_approved_member()`, RLS. Schema source of truth.
- Create `src/carpool/maps.js` — loads the Google Maps JS API (Places + Geocoding) once; exports a memoized loader.
- Create `src/carpool/family.js` — data helpers: `fetchFamily(userId)`, `saveFamily(record)`, and the PURE `buildFamilyRecord(...)` that assembles a row from autocomplete + geocode results + form fields.
- Create `src/carpool/family.test.js` — Vitest unit tests for `buildFamilyRecord` (pure).
- Create `src/carpool/views/FamilyForm.jsx` — the create/edit form (Places autocomplete, schedule, contact).
- Modify `src/carpool/views/Ready.jsx` — fetch own family; show `FamilyForm` if none, else a summary + Edit.
- Modify `package.json` — add `@googlemaps/js-api-loader`.
- Modify `.env.local` — add `VITE_GOOGLE_MAPS_KEY` (done under G3, not committed).

---

## Task 1: `families` table + RLS + `is_approved_member()` (author SQL; human applies)

**Files:**
- Create: `supabase/migrations/0002_families.sql`

**Interfaces:**
- Consumes: `public.is_admin()` and `public.members` from `0001_members.sql`.
- Produces: `public.families` with columns below; `public.is_approved_member()` (SECURITY DEFINER boolean); three RLS policies. Column contract other tasks rely on:
  `user_id uuid` PK, `parent_name text`, `child_names text`, `address text`, `lat double precision`, `lng double precision`, `area_lat double precision`, `area_lng double precision`, `area_label text`, `direction text ('am'|'pm'|'both')`, `weekdays text[]` (subset of mon..fri), `contact_phone text` (nullable), `contact_email text`, `created_at timestamptz`, `updated_at timestamptz`.

> This task only AUTHORS the file. Applying it (G4) and any live check are done by a human in the Supabase SQL Editor. Do not attempt DB access.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0002_families.sql`:

```sql
-- families: one row per member; the family's carpool profile.
-- PROTECTED columns (address, lat, lng, contact_*) are readable only by the
-- family itself and admins. EXPOSED area_* columns (zip centroid) are what a
-- later phase will surface to other families. RLS enforces this.
create table if not exists public.families (
  user_id uuid primary key references auth.users (id) on delete cascade,
  parent_name text not null,
  child_names text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  area_lat double precision not null,
  area_lng double precision not null,
  area_label text not null,
  direction text not null check (direction in ('am', 'pm', 'both')),
  weekdays text[] not null check (weekdays <@ array['mon','tue','wed','thu','fri']),
  contact_phone text,
  contact_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.families enable row level security;

-- Helper: is the caller an approved member? (SECURITY DEFINER to bypass RLS on
-- members and avoid any policy recursion, mirroring is_admin().)
create or replace function public.is_approved_member()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.user_id = auth.uid()
      and m.approval = 'approved'
  );
$$;

-- Read: only your own row; admins read all. No path to read another family here.
create policy families_select_self_or_admin
  on public.families for select
  using (user_id = auth.uid() or public.is_admin());

-- Insert: only your own row, and only if you are an approved member.
create policy families_insert_self_approved
  on public.families for insert
  with check (user_id = auth.uid() and public.is_approved_member());

-- Update: only your own row, and only while an approved member.
create policy families_update_self_approved
  on public.families for update
  using (user_id = auth.uid() and public.is_approved_member())
  with check (user_id = auth.uid() and public.is_approved_member());

-- No delete policy: deletes are denied by default (admin removal is Phase 4).
```

- [ ] **Step 2: Verify the file matches this spec** (structure only — do NOT apply)

Run: `cat supabase/migrations/0002_families.sql`
Expected: table with all columns above; RLS enabled; `is_approved_member()` SECURITY DEFINER with `set search_path = public`; exactly three policies (select self/admin, insert self+approved, update self+approved); no delete policy.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_families.sql
git commit -m "feat(carpool): families table with column-split RLS"
```

---

## Task 2: Google Maps loader

**Files:**
- Modify: `package.json` (add dependency)
- Create: `src/carpool/maps.js`

**Interfaces:**
- Consumes: `import.meta.env.VITE_GOOGLE_MAPS_KEY`.
- Produces: `loadPlaces()` → `Promise` resolving to the Google Places library, and `loadGeocoding()` → `Promise` resolving to the Geocoding library. Both memoized so the API loads once.

> Blocked for VERIFICATION by G1+G3 (key must exist). The code can be written first; verification (that the library actually loads) needs the key.

- [ ] **Step 1: Install the loader**

Run: `npm install @googlemaps/js-api-loader`
Expected: appears under `dependencies`.

- [ ] **Step 2: VERIFY the current loader API before writing code**

The `@googlemaps/js-api-loader` API and the Google Places API have changed (legacy `Autocomplete` is deprecated in favor of `PlaceAutocompleteElement`; the loader exposes `importLibrary`). Open the current docs and confirm the exact calls before writing:
- https://www.npmjs.com/package/@googlemaps/js-api-loader (Loader usage, `importLibrary`)
- https://developers.google.com/maps/documentation/javascript/places-autocomplete-data (current autocomplete)
- https://developers.google.com/maps/documentation/javascript/geocoding (Geocoder)
Write `maps.js` to match what the docs currently show, not memory. If the modern API differs from the sketch below, follow the docs and note the deviation in your report.

- [ ] **Step 3: Write `maps.js` (sketch — reconcile with Step 2 docs)**

Create `src/carpool/maps.js`:

```js
import { Loader } from '@googlemaps/js-api-loader';

const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
if (!key) throw new Error('Missing VITE_GOOGLE_MAPS_KEY');

const loader = new Loader({ apiKey: key, version: 'weekly' });

let placesPromise;
let geocodingPromise;

export function loadPlaces() {
  if (!placesPromise) placesPromise = loader.importLibrary('places');
  return placesPromise;
}

export function loadGeocoding() {
  if (!geocodingPromise) geocodingPromise = loader.importLibrary('geocoding');
  return geocodingPromise;
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: succeeds; `dist/carpool/index.html` emitted. (Runtime load of the API is exercised in Task 4 / by the human, since it needs the real key + a browser.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/carpool/maps.js
git commit -m "feat(carpool): Google Maps JS API loader (places + geocoding)"
```

---

## Task 3: Family data helpers + pure `buildFamilyRecord` (TDD)

**Files:**
- Create: `src/carpool/family.js`
- Create: `src/carpool/family.test.js`

**Interfaces:**
- Consumes: `supabase` from `supabaseClient.js`.
- Produces:
  - `buildFamilyRecord({ userId, parentName, childNames, place, areaGeocode, direction, weekdays, contactPhone, contactEmail })` → a plain object matching the `families` columns. PURE — no I/O. `place` is the shape `{ formattedAddress, lat, lng, postalCode }` (already extracted from the Google place); `areaGeocode` is `{ lat, lng, label }` (zip centroid). Throws if a required field is missing or `direction`/`weekdays` are invalid.
  - `fetchFamily(userId)` → `Promise<family|null>` (selects the caller's own row).
  - `saveFamily(record)` → `Promise<void>` (upsert on `user_id`).

- [ ] **Step 1: Write the failing test**

Create `src/carpool/family.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildFamilyRecord } from './family.js';

const base = {
  userId: 'u1',
  parentName: 'Pat Parent',
  childNames: 'Kid One, Kid Two',
  place: { formattedAddress: '123 Main St, College Park, GA 30349', lat: 33.65, lng: -84.44, postalCode: '30349' },
  areaGeocode: { lat: 33.66, lng: -84.49, label: '30349' },
  direction: 'both',
  weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  contactPhone: '404-555-0100',
  contactEmail: 'pat@example.com',
};

describe('buildFamilyRecord', () => {
  it('maps inputs to the families row shape', () => {
    const r = buildFamilyRecord(base);
    expect(r).toEqual({
      user_id: 'u1',
      parent_name: 'Pat Parent',
      child_names: 'Kid One, Kid Two',
      address: '123 Main St, College Park, GA 30349',
      lat: 33.65,
      lng: -84.44,
      area_lat: 33.66,
      area_lng: -84.49,
      area_label: '30349',
      direction: 'both',
      weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      contact_phone: '404-555-0100',
      contact_email: 'pat@example.com',
    });
  });

  it('allows a null phone', () => {
    const r = buildFamilyRecord({ ...base, contactPhone: '' });
    expect(r.contact_phone).toBeNull();
  });

  it('rejects an invalid direction', () => {
    expect(() => buildFamilyRecord({ ...base, direction: 'evening' })).toThrow();
  });

  it('rejects an empty weekdays list', () => {
    expect(() => buildFamilyRecord({ ...base, weekdays: [] })).toThrow();
  });

  it('rejects a weekday outside mon..fri', () => {
    expect(() => buildFamilyRecord({ ...base, weekdays: ['sun'] })).toThrow();
  });

  it('rejects a missing required field', () => {
    expect(() => buildFamilyRecord({ ...base, parentName: '' })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/carpool/family.test.js`
Expected: FAIL — `buildFamilyRecord` not found.

- [ ] **Step 3: Implement `family.js`**

Create `src/carpool/family.js`:

```js
import { supabase } from './supabaseClient.js';

const VALID_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];

export function buildFamilyRecord(input) {
  const {
    userId, parentName, childNames, place, areaGeocode,
    direction, weekdays, contactPhone, contactEmail,
  } = input;

  const required = { userId, parentName, childNames, place, areaGeocode, contactEmail };
  for (const [k, v] of Object.entries(required)) {
    if (v === undefined || v === null || v === '') throw new Error(`Missing required field: ${k}`);
  }
  if (!['am', 'pm', 'both'].includes(direction)) throw new Error(`Invalid direction: ${direction}`);
  if (!Array.isArray(weekdays) || weekdays.length === 0) throw new Error('weekdays must be a non-empty array');
  if (!weekdays.every((d) => VALID_DAYS.includes(d))) throw new Error('weekdays must be within mon..fri');

  return {
    user_id: userId,
    parent_name: parentName,
    child_names: childNames,
    address: place.formattedAddress,
    lat: place.lat,
    lng: place.lng,
    area_lat: areaGeocode.lat,
    area_lng: areaGeocode.lng,
    area_label: areaGeocode.label,
    direction,
    weekdays,
    contact_phone: contactPhone ? contactPhone : null,
    contact_email: contactEmail,
  };
}

export async function fetchFamily(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('families')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveFamily(record) {
  const { error } = await supabase
    .from('families')
    .upsert(record, { onConflict: 'user_id' });
  if (error) throw error;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/carpool/family.test.js`
Expected: PASS (6 assertions).

- [ ] **Step 5: Full suite + commit**

Run: `npm test` (Phase 1's `resolveView` tests must still pass too.)
```bash
git add src/carpool/family.js src/carpool/family.test.js
git commit -m "feat(carpool): family data helpers + buildFamilyRecord (tested)"
```

---

## Task 4: The family form (Places autocomplete → geocode → save)

**Files:**
- Create: `src/carpool/views/FamilyForm.jsx`

**Interfaces:**
- Consumes: `loadPlaces`/`loadGeocoding` from `maps.js`; `buildFamilyRecord`/`saveFamily` from `family.js`; `supabase` session for the current user's id + email.
- Produces: `FamilyForm({ userId, email, family, onSaved })` — renders the create/edit form; on submit, upserts the family and calls `onSaved(savedRecord)`.

> Blocked for VERIFICATION by G1+G3 (needs the key + browser). Code is written now; the live autocomplete/geocode round-trip is verified by the human in Task 6.

- [ ] **Step 1: VERIFY current Places autocomplete + Geocoder API (same docs as Task 2 Step 2)**

Confirm the current way to (a) attach address autocomplete to an input (or use `PlaceAutocompleteElement`), (b) read the selected place's `formattedAddress`, location `lat`/`lng`, and postal code from address components, and (c) geocode a postal-code string to its centroid + a label. Build the component to the current API; the code below is a STRUCTURAL sketch to reconcile with the docs.

- [ ] **Step 2: Write `FamilyForm.jsx`**

Create `src/carpool/views/FamilyForm.jsx` implementing this behavior (reconcile the Google calls with Step 1):

```jsx
import React, { useEffect, useRef, useState } from 'react';
import { loadPlaces, loadGeocoding } from '../maps.js';
import { buildFamilyRecord, saveFamily } from '../family.js';

const DAYS = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' }, { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' }, { key: 'fri', label: 'Fri' },
];

export default function FamilyForm({ userId, email, family, onSaved }) {
  const addressInputRef = useRef(null);
  // Holds the address the user actually SELECTED from autocomplete:
  // { formattedAddress, lat, lng, postalCode }. Null until a valid pick.
  const selectedPlaceRef = useRef(
    family ? { formattedAddress: family.address, lat: family.lat, lng: family.lng, postalCode: family.area_label } : null
  );

  const [parentName, setParentName] = useState(family?.parent_name ?? '');
  const [childNames, setChildNames] = useState(family?.child_names ?? '');
  const [addressText, setAddressText] = useState(family?.address ?? '');
  const [direction, setDirection] = useState(family?.direction ?? 'both');
  const [weekdays, setWeekdays] = useState(family?.weekdays ?? ['mon', 'tue', 'wed', 'thu', 'fri']);
  const [contactPhone, setContactPhone] = useState(family?.contact_phone ?? '');
  const [contactEmail, setContactEmail] = useState(family?.contact_email ?? email ?? '');
  const [status, setStatus] = useState('idle'); // idle | saving | error
  const [error, setError] = useState('');

  // Attach Google address autocomplete to the address input (per current API,
  // verified in Step 1). On a valid selection, populate selectedPlaceRef with
  // formattedAddress + geometry lat/lng + postal_code, and sync addressText.
  useEffect(() => {
    let cancelled = false;
    loadPlaces().then((places) => {
      if (cancelled || !addressInputRef.current) return;
      // ... bind autocomplete; on place change, set selectedPlaceRef.current and setAddressText(...)
    });
    return () => { cancelled = true; };
  }, []);

  function toggleDay(key) {
    setWeekdays((cur) => (cur.includes(key) ? cur.filter((d) => d !== key) : [...cur, key]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const place = selectedPlaceRef.current;
    if (!place || !place.postalCode) {
      setError('Please pick your address from the suggestions so we can locate your area.');
      return;
    }
    setStatus('saving');
    try {
      // Derive the zip centroid (the only location shown to others) by geocoding the postal code.
      const { Geocoder } = await loadGeocoding();
      const geocoder = new Geocoder();
      const { results } = await geocoder.geocode({ address: place.postalCode });
      const loc = results[0].geometry.location;
      const areaGeocode = { lat: loc.lat(), lng: loc.lng(), label: place.postalCode };

      const record = buildFamilyRecord({
        userId, parentName, childNames, place, areaGeocode,
        direction, weekdays, contactPhone, contactEmail,
      });
      await saveFamily(record);
      onSaved(record);
    } catch (err) {
      setStatus('error');
      setError(err.message ?? 'Could not save. Please try again.');
    }
  }

  return (
    <form className="carpool-shell" onSubmit={handleSubmit}>
      <h1>{family ? 'Edit your family' : 'Add your family'}</h1>

      <label>Your name
        <input required value={parentName} onChange={(e) => setParentName(e.target.value)} />
      </label>

      <label>Child name(s)
        <input required value={childNames} onChange={(e) => setChildNames(e.target.value)} placeholder="e.g. Jordan, Riley" />
      </label>

      <label>Home address
        <input
          ref={addressInputRef}
          required
          value={addressText}
          onChange={(e) => { setAddressText(e.target.value); selectedPlaceRef.current = null; }}
          placeholder="Start typing and pick from the list"
        />
      </label>
      <p>We use your address only to match you by area. Other families see just your general area, never your exact address.</p>

      <fieldset>
        <legend>When do you need carpool?</legend>
        {['am', 'pm', 'both'].map((d) => (
          <label key={d}>
            <input type="radio" name="direction" value={d} checked={direction === d} onChange={() => setDirection(d)} />
            {d === 'am' ? 'Morning drop-off' : d === 'pm' ? 'Afternoon pickup' : 'Both'}
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Which days?</legend>
        {DAYS.map((d) => (
          <label key={d.key}>
            <input type="checkbox" checked={weekdays.includes(d.key)} onChange={() => toggleDay(d.key)} />
            {d.label}
          </label>
        ))}
      </fieldset>

      <label>Phone (optional)
        <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
      </label>
      <label>Contact email
        <input type="email" required value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
      </label>

      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={status === 'saving'}>
        {status === 'saving' ? 'Saving…' : family ? 'Save changes' : 'Add my family'}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Verify build + suite**

Run: `npm run build && npm test`
Expected: build emits `dist/carpool/index.html`; tests pass. (Autocomplete/geocode live behavior verified by the human in Task 6.)

- [ ] **Step 4: Commit**

```bash
git add src/carpool/views/FamilyForm.jsx
git commit -m "feat(carpool): family profile form with address autocomplete"
```

---

## Task 5: Wire the form into the `Ready` view

**Files:**
- Modify: `src/carpool/views/Ready.jsx`

**Interfaces:**
- Consumes: `fetchFamily` from `family.js`; `FamilyForm`; the current session (for `userId`/`email`).
- Produces: `Ready` renders a loading state, then either the `FamilyForm` (no family yet) or a family summary with an "Edit" button that reopens the form. On save, it shows the updated summary.

- [ ] **Step 1: Rewrite `Ready.jsx`**

Replace `src/carpool/views/Ready.jsx` with:

```jsx
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { fetchFamily } from '../family.js';
import FamilyForm from './FamilyForm.jsx';

export default function Ready() {
  const [userId, setUserId] = useState(null);
  const [email, setEmail] = useState('');
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user;
        if (!active) return;
        setUserId(user?.id ?? null);
        setEmail(user?.email ?? '');
        const fam = user ? await fetchFamily(user.id) : null;
        if (!active) return;
        setFamily(fam);
      } catch (e) {
        if (active) setError(e.message ?? 'Could not load your family.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <div className="carpool-shell"><p>Loading…</p></div>;
  if (error) return (
    <div className="carpool-shell">
      <p role="alert">Something went wrong: {error}</p>
      <button onClick={() => window.location.reload()}>Try again</button>
    </div>
  );

  if (!family || editing) {
    return (
      <FamilyForm
        userId={userId}
        email={email}
        family={family}
        onSaved={(rec) => { setFamily(rec); setEditing(false); }}
      />
    );
  }

  return (
    <div className="carpool-shell">
      <h1>Your family</h1>
      <p><strong>{family.parent_name}</strong> — {family.child_names}</p>
      <p>Area: {family.area_label}</p>
      <p>Needs: {family.direction === 'both' ? 'Morning & afternoon' : family.direction === 'am' ? 'Morning' : 'Afternoon'} · {family.weekdays.join(', ')}</p>
      <button onClick={() => setEditing(true)}>Edit</button>
      <p>The map of nearby families arrives next.</p>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build + suite**

Run: `npm run build && npm test`
Expected: build emits both entries; tests pass; homepage entry unaffected.

- [ ] **Step 3: Commit**

```bash
git add src/carpool/views/Ready.jsx
git commit -m "feat(carpool): show family form / summary in the approved view"
```

---

## Task 6: Deploy + live verification

**Files:** none (deploy + human acceptance).

- [ ] **Step 1: Confirm G3 (Vercel env var `VITE_GOOGLE_MAPS_KEY` for Production + Preview) and G4 (migration `0002_families.sql` applied).**

- [ ] **Step 2: Merge to `main` and push** (per superpowers:finishing-a-development-branch). Vercel auto-builds.

- [ ] **Step 3: Live acceptance (human).** On `wearercap.org/carpool/`, signed in as an approved user: the "Add your family" form appears; typing an address shows Google suggestions; picking one and filling schedule + contact saves; reloading shows the family summary (with only the area/zip, not the street address, in the summary); editing works. In Supabase → Table Editor → `families`, confirm the row has the real `address`/`lat`/`lng` AND a distinct `area_lat`/`area_lng` (zip centroid).
- [ ] **Step 4: Privacy spot-check (human).** With a SECOND approved account, confirm `select * from families` via the app returns only that user's OWN row (the API `GET /rest/v1/families` returns just their row, not everyone's) — proving the protected columns aren't readable across users.

---

## Self-Review

**Spec coverage (Phase 2A scope):**
- Family profile fields (name, child, address, AM/PM, weekdays, contact) → Task 4 form + Task 1 schema. ✓
- Real address/coords/contact protected; area-center exposed separately → Task 1 column split + RLS (select self/admin only). ✓
- Address via Google autocomplete; area-center = zip centroid via geocoding → Tasks 2–4. ✓
- Approved-members-only writes → Task 1 `is_approved_member()` in insert/update policies. ✓
- Integrates into Phase 1 `Ready` view without disturbing auth → Task 5. ✓
- Out of scope (intentional): reading other families / the map + nearby list (Phase 2B via `family_directory()` RPC); groups (Phase 3); notifications, availability toggle, rollover, admin panel (Phase 4).

**Placeholder scan:** SQL, the pure `buildFamilyRecord`, its tests, `Ready.jsx`, and `family.js` are complete. The Google-touching pieces (`maps.js`, the autocomplete/geocode calls in `FamilyForm.jsx`) are deliberately marked "verify against current Google docs" because that API surface has changed and must not be transcribed from memory — the surrounding component logic and data flow are fully specified.

**Type/name consistency:** `families` columns in the migration match `buildFamilyRecord`'s output keys and `fetchFamily`/`saveFamily` usage. `is_approved_member()` / `is_admin()` names match `0001`. `FamilyForm` and `Ready` prop contracts (`userId`, `email`, `family`, `onSaved`) match. ✓

---

## Roadmap — remaining phases (each its own plan)

- **Phase 2B — Map + nearby list:** `family_directory()` SECURITY DEFINER RPC returning ONLY safe columns (name, child, area_lat/lng, area_label, direction, weekdays) to approved members; load Maps JS; render pins at area-centers; ranked nearby list by distance from the viewer's area point. *Ships: the private family directory + map.*
- **Phase 3 — Groups:** `groups`/`memberships`/`join_requests` + RLS; create/browse/join; contact reveal within a shared group; proximity + schedule suggestion engine; optional meeting point.
- **Phase 4 — Notifications, status & admin:** edge-function lifecycle emails (throttled); availability toggle (looking/matched/inactive); annual rollover; full admin panel (master map, remove, CSV export).
