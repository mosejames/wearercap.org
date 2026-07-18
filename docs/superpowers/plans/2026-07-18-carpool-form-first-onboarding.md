# Carpool: Form-First Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the family form the front door. A new parent lands on `/carpool`, is greeted ("Welcome to RCA Carpool. Let's get you set up."), fills out their family immediately, and verifies with a **6-digit code typed on the page** — never leaving the site. No magic link, no bounce to an inbox and back.

**Architecture:** `FamilyForm` is decoupled from saving: it collects, validates, geocodes, and hands a payload to its parent via `onSubmitData`. A new `Onboarding` view renders that form for signed-out visitors; on submit it stashes the payload in `sessionStorage`, calls `signInWithOtp`, and swaps to an inline code step. After `verifyOtp` the auth state flips and `App` renders `Ready`, which picks up the stashed payload and saves the family. The stash makes the save race-proof across the remount that the auth change causes.

**Tech Stack:** Existing Vite/React/Supabase stack. Supabase email OTP (custom SMTP via Resend already configured; templates already emit `{{ .Token }}`, 6 digits).

## Global Constraints

- **Email verification is NOT removed.** This is a directory of children's names and home areas; an unverified signup could plant a fake family. The code replaces the *link*, not the verification.
- **RLS unchanged.** A family row still requires `auth.uid() = user_id` and membership (migration 0003). The save therefore happens strictly AFTER `verifyOtp` succeeds. Never attempt to persist family data pre-auth.
- **Stash hygiene:** the pending payload lives in `sessionStorage` only between submit and save, is cleared immediately after a successful save, and holds only what the user just typed about themselves.
- **Approval flow unchanged:** new users still land pending, still get the admin-notify email, still see the count teaser.
- **Do not disturb** the marketing homepage, the admin approvals view, or the map/directory behavior.
- Site auto-deploys on push to `main`; Vite inlines env at build time.

## Carry-over facts

- `src/carpool/`: `App.jsx` (routes on `resolveView`), `views/SignedOut.jsx` (email → magic link; to be RETIRED), `views/Ready.jsx` (`isAdmin`/`isPending`; fetches own family; renders `FamilyForm` or summary + `MapView`), `views/FamilyForm.jsx` (Places autocomplete, stale-selection guard, geocodes postal code, currently calls `saveFamily` itself), `family.js` (`buildFamilyRecord`, `fetchFamily`, `saveFamily`), `directory.js`, `maps.js`, `auth.js` (`resolveView`, `fetchMember`, `ensureMemberRow`).
- `buildFamilyRecord({userId, parentName, childNames, place, areaGeocode, direction, weekdays, contactPhone, contactEmail})` → snake_case row; validates direction/weekdays/required fields.
- Stale-address guard compares the widget's displayed text captured at selection time (NOT `formattedAddress`).
- Supabase auth: OTP length 6; sender `RCA Carpool <carpool@wearercap.org>`; confirmation + magic-link templates both emit `{{ .Token }}`.

---

## Task 1: Decouple `FamilyForm` from saving (+ stash helpers, TDD)

**Files:**
- Modify: `src/carpool/views/FamilyForm.jsx`
- Modify: `src/carpool/views/Ready.jsx`
- Create: `src/carpool/pendingFamily.js`
- Create: `src/carpool/pendingFamily.test.js`

**Interfaces:**
- `FamilyForm({ family, initialEmail, submitLabel, onSubmitData })`. It no longer imports `saveFamily` and no longer takes `userId`/`onSaved`. On submit it validates + geocodes as today, then calls `await onSubmitData(payload)` where
  `payload = { parentName, childNames, place: {formattedAddress, lat, lng, postalCode}, areaGeocode: {lat, lng, label}, direction, weekdays, contactPhone, contactEmail }`.
  The form keeps owning its own `status`/`error` UI: if `onSubmitData` throws, show the message and re-enable the button.
- `pendingFamily.js` exports `stashPendingFamily(payload)`, `readPendingFamily()` → payload|null, `clearPendingFamily()`. Backed by `sessionStorage` key `carpool.pendingFamily`. `readPendingFamily` returns null (and clears) on malformed JSON. All three are no-throw when storage is unavailable (private-mode Safari).

- [ ] **Step 1: Failing tests for the stash**

Create `src/carpool/pendingFamily.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { stashPendingFamily, readPendingFamily, clearPendingFamily } from './pendingFamily.js';

const payload = {
  parentName: 'Pat Parent',
  childNames: 'Kid One',
  place: { formattedAddress: '1 Main St', lat: 33.6, lng: -84.4, postalCode: '30337' },
  areaGeocode: { lat: 33.66, lng: -84.49, label: '30337' },
  direction: 'both',
  weekdays: ['mon'],
  contactPhone: '',
  contactEmail: 'pat@example.com',
};

beforeEach(() => { window.sessionStorage.clear(); });

describe('pendingFamily', () => {
  it('returns null when nothing is stashed', () => {
    expect(readPendingFamily()).toBeNull();
  });
  it('round-trips a payload', () => {
    stashPendingFamily(payload);
    expect(readPendingFamily()).toEqual(payload);
  });
  it('clears the stash', () => {
    stashPendingFamily(payload);
    clearPendingFamily();
    expect(readPendingFamily()).toBeNull();
  });
  it('returns null and clears when the stash is malformed', () => {
    window.sessionStorage.setItem('carpool.pendingFamily', '{not json');
    expect(readPendingFamily()).toBeNull();
    expect(window.sessionStorage.getItem('carpool.pendingFamily')).toBeNull();
  });
});
```

Vitest needs a DOM for `sessionStorage`: add `environment: 'jsdom'` to a `test` block in `vite.config.js` and install `jsdom` as a dev dependency (`npm i -D jsdom`). Keep the existing build config untouched.

- [ ] **Step 2: Run to confirm RED** — `npm test src/carpool/pendingFamily.test.js` → fails (module missing).

- [ ] **Step 3: Implement `pendingFamily.js`**

```js
const KEY = 'carpool.pendingFamily';

export function stashPendingFamily(payload) {
  try { window.sessionStorage.setItem(KEY, JSON.stringify(payload)); } catch { /* storage unavailable */ }
}

export function readPendingFamily() {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    clearPendingFamily();
    return null;
  }
}

export function clearPendingFamily() {
  try { window.sessionStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
```

- [ ] **Step 4: GREEN** — `npm test` → all pass (18 existing + 4 new = 22).

- [ ] **Step 5: Refactor `FamilyForm`**
Remove the `saveFamily`/`buildFamilyRecord` import and the `userId` prop. Keep every existing behavior (Places autocomplete, `gmp-select`, `gmp-error`, the submit-time stale-selection comparison, the no-postal-code message, unmount guards, error rendering). Replace the save block in `handleSubmit` with: assemble `payload` (same fields it already computes, including the geocoded `areaGeocode`), then `await onSubmitData(payload)`. Accept `initialEmail` (used for the contact-email default, replacing the old `email` prop) and `submitLabel` (default: `family ? 'Save changes' : 'Add my family'`).

- [ ] **Step 6: Update `Ready.jsx` to the new contract**
Where it renders `FamilyForm`, pass `initialEmail={email}` and an `onSubmitData` that builds the record with the authenticated `userId` and saves:

```jsx
<FamilyForm
  family={family}
  initialEmail={email}
  onSubmitData={async (payload) => {
    const record = buildFamilyRecord({ ...payload, userId });
    await saveFamily(record);
    setFamily(record);
    setEditing(false);
  }}
/>
```
Import `buildFamilyRecord` and `saveFamily` in `Ready.jsx`. Behavior for existing signed-in users must be identical to today.

- [ ] **Step 7:** `npm test && npm run build` → green.
- [ ] **Step 8: Commit** — `git add -A && git commit -m "refactor(carpool): FamilyForm collects, caller saves; add pending-family stash"`

---

## Task 2: `Onboarding` view — welcome, form, inline code

**Files:**
- Create: `src/carpool/views/Onboarding.jsx`

**Interfaces:**
- Default export `Onboarding()`. Self-contained; no props. Internal `step` state: `'form' | 'code' | 'signin-email'`.

**Behavior:**
1. **`form` (default).** Heading "Welcome to RCA Carpool", subtext "Add your family and we'll show you who is already carpooling near you." Renders `<FamilyForm submitLabel="Continue" onSubmitData={...} />`. On submit: `stashPendingFamily(payload)`, then `await supabase.auth.signInWithOtp({ email: payload.contactEmail, options: { shouldCreateUser: true } })`; on success set `email` state and `step='code'`. If it throws, let it propagate so the form shows the error (do NOT swallow).
   Also render a small footer link: "Already added your family? Sign in" → `step='signin-email'`.
2. **`code`.** "Check your email. We sent a 6-digit code to {email}." A numeric input (`inputMode="numeric"`, `autoComplete="one-time-code"`, maxLength 6), a Verify button, an error slot, a "Send a new code" link (re-calls `signInWithOtp`, shows a confirmation line), and a "Use a different email" link back to the previous step. Verify calls `supabase.auth.verifyOtp({ email, token, type: 'email' })`. On error show the message (e.g. wrong/expired code) and let them retry. On success do nothing further: the auth state change re-renders the app (Task 3 completes the save).
3. **`signin-email`.** For returning parents: just an email field → `signInWithOtp({ email, options: { shouldCreateUser: false } })` → `step='code'`. No family form, nothing stashed. A link back to "I'm new here".

**VERIFY before writing:** confirm the current supabase-js v2 signature and the correct `type` for verifying an emailed OTP for BOTH a brand-new user (created via `shouldCreateUser: true`) and a returning user. Docs: https://supabase.com/docs/reference/javascript/auth-verifyotp and https://supabase.com/docs/reference/javascript/auth-signinwithotp . If a new-user signup requires `type: 'signup'` while a returning user needs `type: 'email'`, handle both (e.g. try `'email'`, and on an invalid-type/token error retry with `'signup'`), and document what you found in your report. Getting this wrong silently breaks signup, so verify rather than assume.

Guard async work against unmount; never leave the button stuck disabled after an error.

- [ ] **Step 1:** Verify the OTP API per above.
- [ ] **Step 2:** Write `Onboarding.jsx`.
- [ ] **Step 3:** `npm test && npm run build` → green.
- [ ] **Step 4: Commit** — `git add -A && git commit -m "feat(carpool): form-first onboarding with inline 6-digit code"`

---

## Task 3: Route signed-out to `Onboarding`; `Ready` saves the stashed family

**Files:**
- Modify: `src/carpool/App.jsx`
- Modify: `src/carpool/views/Ready.jsx`
- Delete: `src/carpool/views/SignedOut.jsx`

- [ ] **Step 1:** In `App.jsx` replace the `SignedOut` import/branch with `Onboarding`: `if (view === 'signed-out') return <Onboarding />;`. Everything else unchanged.
- [ ] **Step 2:** In `Ready.jsx`'s load effect, after `fetchFamily(user.id)` returns:

```js
let fam = user ? await fetchFamily(user.id) : null;
if (!fam) {
  const pending = readPendingFamily();
  if (pending) {
    const record = buildFamilyRecord({ ...pending, userId: user.id });
    await saveFamily(record);
    clearPendingFamily();
    fam = record;
  }
}
```
Keep the existing `active` guards and error handling (a failed save must surface in the existing error state, and the stash must NOT be cleared if the save throws, so a retry is possible).

- [ ] **Step 3:** Delete `views/SignedOut.jsx`; grep to confirm no references remain.
- [ ] **Step 4:** `npm test && npm run build` → green; confirm only intended files changed.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat(carpool): land signed-out visitors on the onboarding form"`

---

## Task 4: Deploy + live acceptance

- [ ] **Step 1:** Merge to `main`, push (finishing-a-development-branch flow). Vercel builds.
- [ ] **Step 2: Live acceptance (human, Mose):**
  - Open `/carpool` signed out (private window): the **family form** is the first thing, with the welcome heading. No "email me a link" gate.
  - Fill it out with a fresh email, submit → inline "enter the code" step. The email arrives from `RCA Carpool <carpool@wearercap.org>` with a 6-digit code.
  - Enter the code → lands on the map with the pending banner, family already saved, count teaser correct. Never left the page.
  - Wrong code shows an error and allows retry; "Send a new code" works.
  - Returning-user path: sign out, use "Already added your family? Sign in", enter email, get code, land straight on the map with the existing family intact.
  - Admin still receives the new-signup email; approving still flips the parent to the full map.

## Self-Review

- **Spec coverage:** form-first (Tasks 2+3) ✓; no bounce, code typed on-page (Task 2) ✓; sender/copy fixed (done outside this plan, live-verified) ✓; verification retained (Global Constraints, save strictly post-auth) ✓; existing edit/save behavior preserved (Task 1 Step 6) ✓.
- **Placeholder scan:** Task 1 carries complete code; Task 2 is deliberately verify-docs-first on the one API whose shape must not be guessed (OTP type), with a full behavioral contract.
- **Name consistency:** `onSubmitData` / `initialEmail` / `submitLabel` used identically across FamilyForm, Ready, Onboarding; stash helpers named the same in `pendingFamily.js`, Onboarding, and Ready. ✓
