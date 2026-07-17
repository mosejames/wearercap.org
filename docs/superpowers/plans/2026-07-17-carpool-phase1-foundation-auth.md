# Carpool Phase 1: Foundation & Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a gated `/carpool` app inside wearercap.org where an RCA parent signs in with a magic link, lands in a pending state until a committee admin approves them, and approved parents reach an (empty for now) app shell — with approval authority enforced by the database, not the UI.

**Architecture:** `/carpool` ships as a second Vite entry point (a real React app at `carpool/index.html`) so the existing marketing homepage in `src/main.jsx` is never touched. Supabase provides magic-link auth plus a Postgres `members` table that records each authenticated user's approval status and role. Row-level security (RLS) guarantees a user can read their own membership but cannot self-approve or self-promote; only admins can change approval/role. The React shell reads the session + the member row and renders one of four views (signed-out / pending / ready / admin) from a single pure function.

**Tech Stack:** Vite (multi-page), React 18, `@supabase/supabase-js` v2, Supabase Auth (magic link / OTP email) + Postgres + RLS, Vitest for unit tests. No Google Maps yet (Phase 2).

## Global Constraints

Copied from the design spec (`docs/superpowers/specs/2026-07-17-carpool-matching-design.md`). Every task's requirements implicitly include these.

- **Access gate:** magic-link sign-in **+ admin approval** of new signups. New emails land in a pending queue until an admin approves.
- **Privacy is DB-enforced, not UI-enforced:** a tampered page must not be able to escalate its own access. Approval and role live behind RLS.
- **Admins:** Mose **+ a couple committee admins**. Admin power = approve pending members, and (later phases) oversee/remove/export.
- **Must not disturb** the existing marketing homepage (`src/main.jsx`) or the static standalone pages under `public/<name>/` (e.g. `/invite/`, `/what-to-expect/`).
- **Site deploys** to Vercel, auto-deploy on push to `main`; `dist/` is gitignored and built by Vercel.
- **Anon key is public by design** — it is safe in client code *only because RLS is on every table*. No table ships without RLS enabled.

## Implementation Refinements to the Spec

Small structural choices this plan locks in (flag to Mose; none change product behavior):

1. **`members` table** holds per-user auth state: `user_id`, `email`, `role` (`parent` | `admin`), `approval` (`pending` | `approved`). This **replaces the spec's separate `admins` table** (an admin is just `role='admin'`) and **moves `approval`/`role` off the `families` table**, because a user signs in *before* they fill out a family profile. The spec's `families` table (Phase 2) becomes purely the profile and references `members.user_id`.
2. **`/carpool` is a single client-rendered page** with in-app view state (no sub-URLs like `/carpool/admin`), so no Vercel rewrite is needed in Phase 1.

## External Setup (Mose does these in a browser; agent cannot)

These block the tasks noted. Do them when the task says so, not before.

- **S1. Create a Supabase project** at supabase.com (free tier). Copy the **Project URL** and **anon public key** from Project Settings → API. Needed by Task 2.
- **S2. Set Auth redirect URLs** in Supabase → Authentication → URL Configuration: add `http://127.0.0.1:5173/carpool/` (dev) and `https://wearercap.org/carpool/` (prod) to the redirect allow-list; set Site URL to `https://wearercap.org`. Needed by Task 5.
- **S3. Add Vercel env vars** (Vercel → wearercap-org → Settings → Environment Variables): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` for Production + Preview. Needed before the first deploy that includes carpool.
- **S4. Promote yourself to admin** by running the SQL in Task 6, Step 5 *after* you have signed in once.

---

## File Structure

- Create `vite.config.js` — declares the two entry points (root homepage + carpool). First config file the repo has had; must preserve current root behavior.
- Create `carpool/index.html` — HTML entry for the carpool app (mounts `src/carpool/main.jsx`).
- Create `src/carpool/main.jsx` — React root for the carpool app.
- Create `src/carpool/supabaseClient.js` — the single shared Supabase client.
- Create `src/carpool/auth.js` — pure logic: `resolveView(session, member)` and the member-fetch helper.
- Create `src/carpool/App.jsx` — top-level component: wires session + member state to the view.
- Create `src/carpool/views/SignedOut.jsx`, `Pending.jsx`, `Ready.jsx`, `AdminApprovals.jsx` — the four view components.
- Create `src/carpool/carpool.css` — carpool-only styles (does not import the homepage stylesheet).
- Create `supabase/migrations/0001_members.sql` — the `members` table + RLS policies (source of truth for the schema; also pasted into the Supabase SQL editor).
- Create `src/carpool/auth.test.js` — Vitest unit tests for `resolveView`.
- Modify `package.json` — add `@supabase/supabase-js`, `vitest`, and a `test` script.
- Create `.env.local` (gitignored) — dev Supabase creds.
- Modify `.gitignore` — ensure `.env.local` is ignored.

---

## Task 1: Vite multi-page entry for `/carpool` (marketing homepage untouched)

**Files:**
- Create: `vite.config.js`
- Create: `carpool/index.html`
- Create: `src/carpool/main.jsx`
- Create: `src/carpool/carpool.css`

**Interfaces:**
- Consumes: nothing.
- Produces: a working dev route `/carpool/` that renders a placeholder React app; a build that emits both `index.html` and `carpool/index.html`.

- [ ] **Step 1: Create the Vite config declaring both entries**

Create `vite.config.js`:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        carpool: resolve(__dirname, 'carpool/index.html'),
      },
    },
  },
});
```

- [ ] **Step 2: Create the carpool HTML entry**

Create `carpool/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#172026" />
    <title>Carpool · We Are RCAP</title>
  </head>
  <body>
    <div id="carpool-root"></div>
    <script type="module" src="/src/carpool/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Create a placeholder React root + minimal stylesheet**

Create `src/carpool/carpool.css`:

```css
:root { color-scheme: light; }
body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: #f6f7f8; color: #172026; }
.carpool-shell { max-width: 720px; margin: 0 auto; padding: 2rem 1.25rem; }
```

Create `src/carpool/main.jsx`:

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import './carpool.css';

function Placeholder() {
  return (
    <div className="carpool-shell">
      <h1>Carpool</h1>
      <p>Coming online.</p>
    </div>
  );
}

createRoot(document.getElementById('carpool-root')).render(<Placeholder />);
```

- [ ] **Step 4: Verify dev serves both routes**

Run: `npm run dev`
Then in the browser pane, load `http://127.0.0.1:5173/` and confirm the existing homepage still renders, then `http://127.0.0.1:5173/carpool/` and confirm it shows "Carpool / Coming online."
Expected: homepage unchanged; `/carpool/` renders the placeholder.

- [ ] **Step 5: Verify the production build emits both HTML files**

Run: `npm run build && ls dist dist/carpool`
Expected: `dist/index.html` exists AND `dist/carpool/index.html` exists.

- [ ] **Step 6: Commit**

```bash
git add vite.config.js carpool/index.html src/carpool/main.jsx src/carpool/carpool.css
git commit -m "feat(carpool): add /carpool as second Vite entry point"
```

---

## Task 2: Supabase client + env wiring

**Files:**
- Modify: `package.json` (add dependency)
- Create: `src/carpool/supabaseClient.js`
- Create: `.env.local`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` from the environment.
- Produces: `supabase` (a configured `SupabaseClient`) as the default export of `supabaseClient.js`.

> **Blocked by External Setup S1** (Supabase project must exist so you have a URL + anon key).

- [ ] **Step 1: Install the Supabase client**

Run: `npm install @supabase/supabase-js`
Expected: `@supabase/supabase-js` appears under `dependencies` in `package.json`.

- [ ] **Step 2: Ensure `.env.local` is gitignored**

Confirm `.gitignore` contains a line `.env.local`. If absent, append it:

```
.env.local
```

- [ ] **Step 3: Create `.env.local` with the dev creds (from S1)**

Create `.env.local` (replace with real values from Supabase → Settings → API):

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```

- [ ] **Step 4: Create the shared client**

Create `src/carpool/supabaseClient.js`:

```js
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, anonKey);
```

- [ ] **Step 5: Verify the client loads without error**

Temporarily add `import { supabase } from './supabaseClient.js'; console.log('supabase ready', !!supabase);` to `src/carpool/main.jsx`, run `npm run dev`, load `/carpool/`, and check the browser console.
Expected: console logs `supabase ready true`, no thrown error.
Then remove the temporary import/log line.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/carpool/supabaseClient.js .gitignore
git commit -m "feat(carpool): add shared Supabase client + env wiring"
```

---

## Task 3: `members` table + RLS (the enforcement boundary)

**Files:**
- Create: `supabase/migrations/0001_members.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: a `public.members` table with columns `user_id uuid` (PK, FK→`auth.users`), `email text`, `role text` (`parent`|`admin`, default `parent`), `approval text` (`pending`|`approved`, default `pending`), `created_at timestamptz`; RLS policies named below.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0001_members.sql`:

```sql
-- members: one row per authenticated user; the authorization record.
create table if not exists public.members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null default 'parent' check (role in ('parent', 'admin')),
  approval text not null default 'pending' check (approval in ('pending', 'approved')),
  created_at timestamptz not null default now()
);

alter table public.members enable row level security;

-- Helper: is the calling user an approved admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.user_id = auth.uid()
      and m.role = 'admin'
      and m.approval = 'approved'
  );
$$;

-- Read: a user sees their own row; admins see all.
create policy members_select_self_or_admin
  on public.members for select
  using (user_id = auth.uid() or public.is_admin());

-- Insert: a user may create ONLY their own row, and only as a pending parent.
create policy members_insert_self_pending
  on public.members for insert
  with check (
    user_id = auth.uid()
    and role = 'parent'
    and approval = 'pending'
  );

-- Update: admins only (this is what makes self-approval impossible).
create policy members_update_admin_only
  on public.members for update
  using (public.is_admin())
  with check (public.is_admin());
```

- [ ] **Step 2: Apply the migration in Supabase**

Paste the full contents of `0001_members.sql` into Supabase → SQL Editor → run.
Expected: "Success. No rows returned." Table `members` appears under Table Editor with RLS enabled (shield icon).

- [ ] **Step 3: Verify RLS blocks self-approval (negative test)**

In the Supabase SQL Editor, run this simulation of an ordinary (non-admin) user trying to approve themselves:

```sql
-- Simulate an authenticated non-admin user.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
-- Seed a pending row for them (allowed by insert policy).
insert into public.members (user_id, email) values ('00000000-0000-0000-0000-000000000001', 'test@example.com');
-- Attempt self-approval (must affect 0 rows).
update public.members set approval = 'approved' where user_id = '00000000-0000-0000-0000-000000000001';
select approval from public.members where user_id = '00000000-0000-0000-0000-000000000001';
```

Expected: the `update` reports `UPDATE 0`; the final `select` still shows `pending`. Then clean up: `delete from public.members where email = 'test@example.com';` (run as the table owner / reset role first with `reset role;`).

- [ ] **Step 4: Commit the migration**

```bash
git add supabase/migrations/0001_members.sql
git commit -m "feat(carpool): members table with RLS (no self-approval)"
```

---

## Task 4: `resolveView` — the pure view-selection logic (TDD)

**Files:**
- Modify: `package.json` (add `vitest` + `test` script)
- Create: `src/carpool/auth.js`
- Create: `src/carpool/auth.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `resolveView(session, member)` returning one of `'signed-out' | 'pending' | 'ready' | 'admin'`; and `fetchMember(userId)` (added in Task 5) — this task defines only `resolveView`.

- [ ] **Step 1: Add Vitest and a test script**

Run: `npm install -D vitest`
Then add to `package.json` `scripts`: `"test": "vitest run"`.

- [ ] **Step 2: Write the failing test**

Create `src/carpool/auth.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { resolveView } from './auth.js';

describe('resolveView', () => {
  it('returns signed-out when there is no session', () => {
    expect(resolveView(null, null)).toBe('signed-out');
  });

  it('returns pending when signed in but no member row yet', () => {
    expect(resolveView({ user: { id: 'u1' } }, null)).toBe('pending');
  });

  it('returns pending when member approval is pending', () => {
    expect(resolveView({ user: { id: 'u1' } }, { approval: 'pending', role: 'parent' })).toBe('pending');
  });

  it('returns ready for an approved parent', () => {
    expect(resolveView({ user: { id: 'u1' } }, { approval: 'approved', role: 'parent' })).toBe('ready');
  });

  it('returns admin for an approved admin', () => {
    expect(resolveView({ user: { id: 'u1' } }, { approval: 'approved', role: 'admin' })).toBe('admin');
  });

  it('treats an unapproved admin as pending', () => {
    expect(resolveView({ user: { id: 'u1' } }, { approval: 'pending', role: 'admin' })).toBe('pending');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot import `resolveView` from `./auth.js` (module/function not found).

- [ ] **Step 4: Write the minimal implementation**

Create `src/carpool/auth.js`:

```js
// Pure decision: given the current auth session and the user's member row
// (or null if none exists yet), which view should the app render?
export function resolveView(session, member) {
  if (!session) return 'signed-out';
  if (!member || member.approval !== 'approved') return 'pending';
  return member.role === 'admin' ? 'admin' : 'ready';
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all 6 assertions green.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/carpool/auth.js src/carpool/auth.test.js
git commit -m "feat(carpool): resolveView view-selection logic with tests"
```

---

## Task 5: Magic-link sign-in + session/member wiring + the four views

**Files:**
- Modify: `src/carpool/auth.js` (add `fetchMember` + `ensureMemberRow`)
- Create: `src/carpool/App.jsx`
- Create: `src/carpool/views/SignedOut.jsx`
- Create: `src/carpool/views/Pending.jsx`
- Create: `src/carpool/views/Ready.jsx`
- Modify: `src/carpool/main.jsx` (mount `App` instead of the placeholder)

**Interfaces:**
- Consumes: `supabase` from `supabaseClient.js`; `resolveView` from `auth.js`.
- Produces: `fetchMember(userId)` → `Promise<member | null>`; `ensureMemberRow(user)` → `Promise<void>` (inserts a pending row on first sign-in, ignoring duplicate-key conflicts); an `App` component that renders the correct view.

> **Blocked by External Setup S2** (redirect URLs must be allow-listed or the magic link won't return to the app).

- [ ] **Step 1: Add member helpers to `auth.js`**

Append to `src/carpool/auth.js`:

```js
import { supabase } from './supabaseClient.js';

// Read the caller's own member row (RLS restricts this to self/admin).
export async function fetchMember(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('members')
    .select('user_id, email, role, approval')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// On first sign-in, create the pending member row. Safe to call every login;
// a duplicate primary key is expected and ignored.
export async function ensureMemberRow(user) {
  if (!user) return;
  const { error } = await supabase
    .from('members')
    .insert({ user_id: user.id, email: user.email });
  // 23505 = unique_violation (row already exists) — not an error for us.
  if (error && error.code !== '23505') throw error;
}
```

- [ ] **Step 2: Create the SignedOut view (email → magic link)**

Create `src/carpool/views/SignedOut.jsx`:

```jsx
import React, { useState } from 'react';
import { supabase } from '../supabaseClient.js';

export default function SignedOut() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');

  async function sendLink(e) {
    e.preventDefault();
    setStatus('sending');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/carpool/` },
    });
    if (error) {
      setStatus('error');
      setMessage(error.message);
    } else {
      setStatus('sent');
    }
  }

  return (
    <div className="carpool-shell">
      <h1>RCA Carpool</h1>
      <p>Sign in with your email to find carpool families near you.</p>
      {status === 'sent' ? (
        <p>Check your email for a sign-in link.</p>
      ) : (
        <form onSubmit={sendLink}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Email me a link'}
          </button>
        </form>
      )}
      {status === 'error' && <p role="alert">Could not send link: {message}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create the Pending view**

Create `src/carpool/views/Pending.jsx`:

```jsx
import React from 'react';
import { supabase } from '../supabaseClient.js';

export default function Pending() {
  return (
    <div className="carpool-shell">
      <h1>You're on the list</h1>
      <p>
        Thanks for signing in. A carpool committee admin will approve your access
        shortly. You'll get an email when you're in.
      </p>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  );
}
```

- [ ] **Step 4: Create the Ready view (empty shell for now)**

Create `src/carpool/views/Ready.jsx`:

```jsx
import React from 'react';
import { supabase } from '../supabaseClient.js';

export default function Ready() {
  return (
    <div className="carpool-shell">
      <h1>Carpool</h1>
      <p>You're approved. Your family profile and the map arrive in Phase 2.</p>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
    </div>
  );
}
```

- [ ] **Step 5: Create `App.jsx` wiring session + member to the view**

Create `src/carpool/App.jsx`:

```jsx
import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient.js';
import { resolveView, fetchMember, ensureMemberRow } from './auth.js';
import SignedOut from './views/SignedOut.jsx';
import Pending from './views/Pending.jsx';
import Ready from './views/Ready.jsx';
import AdminApprovals from './views/AdminApprovals.jsx';

export default function App() {
  const [session, setSession] = useState(null);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load(nextSession) {
      if (nextSession?.user) {
        await ensureMemberRow(nextSession.user);
        const m = await fetchMember(nextSession.user.id);
        if (!active) return;
        setMember(m);
      } else {
        setMember(null);
      }
      if (active) setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      load(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(true);
      load(nextSession);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <div className="carpool-shell"><p>Loading…</p></div>;

  const view = resolveView(session, member);
  if (view === 'signed-out') return <SignedOut />;
  if (view === 'pending') return <Pending />;
  if (view === 'admin') return <AdminApprovals />;
  return <Ready />;
}
```

- [ ] **Step 6: Mount `App` in `main.jsx`**

Replace the entire contents of `src/carpool/main.jsx` with:

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import './carpool.css';
import App from './App.jsx';

createRoot(document.getElementById('carpool-root')).render(<App />);
```

- [ ] **Step 7: Verify the unit tests still pass**

Run: `npm test`
Expected: PASS (Task 4's `resolveView` tests unaffected).

- [ ] **Step 8: Browser verification of the magic-link round trip**

With `.env.local` set and S2 done, run `npm run dev`, load `/carpool/`, enter your email, submit. Confirm "Check your email for a sign-in link." Open the email, click the link, confirm it returns to `/carpool/` and shows the **Pending** view (you're not approved yet). In Supabase → Table Editor → `members`, confirm exactly one row for your email with `approval = pending`.
Expected: pending row created; Pending view shown; no console errors.

> **Note:** `AdminApprovals.jsx` is imported here but created in Task 6. Do Task 6 before running the app, or temporarily stub the import. Recommended: implement Task 6 immediately after Step 6, then run Steps 7–8 once.

- [ ] **Step 9: Commit**

```bash
git add src/carpool/auth.js src/carpool/App.jsx src/carpool/views/SignedOut.jsx src/carpool/views/Pending.jsx src/carpool/views/Ready.jsx src/carpool/main.jsx
git commit -m "feat(carpool): magic-link sign-in and pending/ready gating"
```

---

## Task 6: Admin approvals view + first-admin bootstrap

**Files:**
- Create: `src/carpool/views/AdminApprovals.jsx`

**Interfaces:**
- Consumes: `supabase` from `supabaseClient.js`.
- Produces: the `AdminApprovals` default component (approve pending members). Relies on RLS: a non-admin calling these queries gets empty results / denied updates, so this component is only *reached* by admins (via `resolveView`) and is also safe if reached otherwise.

- [ ] **Step 1: Create the AdminApprovals view**

Create `src/carpool/views/AdminApprovals.jsx`:

```jsx
import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient.js';

export default function AdminApprovals() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPending = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('members')
      .select('user_id, email, created_at')
      .eq('approval', 'pending')
      .order('created_at', { ascending: true });
    if (error) setError(error.message);
    else setPending(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  async function approve(userId) {
    const { error } = await supabase
      .from('members')
      .update({ approval: 'approved' })
      .eq('user_id', userId);
    if (error) setError(error.message);
    else loadPending();
  }

  return (
    <div className="carpool-shell">
      <h1>Pending approvals</h1>
      <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      {loading && <p>Loading…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && pending.length === 0 && <p>No one waiting. All caught up.</p>}
      <ul>
        {pending.map((m) => (
          <li key={m.user_id}>
            {m.email}
            <button onClick={() => approve(m.user_id)}>Approve</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Verify unit tests + build**

Run: `npm test && npm run build`
Expected: tests PASS; build succeeds and emits `dist/carpool/index.html`.

- [ ] **Step 3: Commit**

```bash
git add src/carpool/views/AdminApprovals.jsx
git commit -m "feat(carpool): admin approvals view"
```

- [ ] **Step 4: (Mose, browser) Sign in once so your member row exists**

If you have not already, run the app, sign in with your real email, and confirm your row appears in `members` (it will be `pending`, `parent`).

- [ ] **Step 5: (Mose, Supabase SQL editor) Promote yourself — External Setup S4**

Run, replacing the email with yours:

```sql
update public.members
set role = 'admin', approval = 'approved'
where email = 'mose@wearercap.org';
```

Expected: `UPDATE 1`. Reload `/carpool/`; you now land on the **Pending approvals** admin view.

- [ ] **Step 6: End-to-end verification of the gate**

With a *second* email (or a colleague), sign in → that user sees **Pending**. From your admin view, click **Approve**. Have the second user reload `/carpool/` → they now see the **Ready** shell.
Expected: approval flows one way, admin → parent; the parent could never approve themselves (proven in Task 3, Step 3).

---

## Task 7: Deploy verification

**Files:** none (deploy + config).

- [ ] **Step 1: Confirm Vercel env vars are set — External Setup S3**

In Vercel → wearercap-org → Settings → Environment Variables, confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exist for Production and Preview.

- [ ] **Step 2: Push and let Vercel build**

```bash
git push origin main
```

Expected: Vercel build succeeds; deploy includes `/carpool/`.

- [ ] **Step 3: Verify production**

Load `https://wearercap.org/carpool/`, confirm the SignedOut view renders and the homepage `https://wearercap.org/` is unchanged. (Do not fully sign in on prod unless you want a real prod member row; if you do, you can approve/remove it from Supabase.)
Expected: `/carpool/` live and gated; marketing site untouched.

---

## Self-Review

**Spec coverage (Phase 1 scope):**
- Magic-link sign-in → Tasks 5. ✓
- Admin approval / pending queue → Tasks 3 (data), 6 (UI). ✓
- DB-enforced access (no self-approval) → Task 3 RLS + Step 3 negative test. ✓
- `/carpool` inside wearercap.org without disturbing homepage/static pages → Task 1 (separate entry), Task 7 Step 3 (verified). ✓
- Anon key public only because RLS on every table → Task 3 enables RLS; `members` is the only Phase-1 table. ✓
- Out of Phase 1 scope (map, families profile, groups, notifications, status, rollover) → deferred to Phases 2–4 below. Intentional, not a gap.

**Placeholder scan:** No TBD/TODO; every code step shows complete code; RLS negative test has concrete expected output. The only cross-task import ordering risk (`AdminApprovals` imported in Task 5, created in Task 6) is called out explicitly in Task 5 Step 8.

**Type/name consistency:** `resolveView(session, member)`, `fetchMember(userId)`, `ensureMemberRow(user)`, `members` columns (`user_id`, `email`, `role`, `approval`, `created_at`), and `is_admin()` are used identically across Tasks 3–6. ✓

---

## Roadmap — subsequent phases (each gets its own plan when we reach it)

- **Phase 2 — Family profile + map/list:** `families` table (real coords protected, area-center exposed) with RLS; Google Maps setup (Geocoding + Places autocomplete + Maps JS); the signup/edit form; the map + ranked nearby list, snapped to zip/area center. *Ships: a working, private family directory.*
- **Phase 3 — Groups:** `groups`, `memberships`, `join_requests` tables + RLS; create-a-group and browse; join-request lifecycle; contact reveal on shared membership; the proximity+schedule suggestion engine; optional group meeting point. *Ships: families forming carpool groups.*
- **Phase 4 — Notifications, status & admin:** Supabase edge function + email provider for the six lifecycle emails (throttled near-you ping); availability toggle (looking/matched/inactive); annual year rollover; full admin panel (master map, remove, CSV export, trigger rollover). *Ships: the self-sustaining loop.*
