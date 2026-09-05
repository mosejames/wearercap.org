# Agent handoff: wearercap.org

Read this before changing anything. It covers access, how to run and verify the
project, and the house rules that are not obvious from the code.

Repository: `mosejames/wearercap.org`. Production branch is `main`. Vercel
deploys on every push to `main`, so a push is a release.

## 1. Access you need

Four separate systems. Only the first is required to write code.

### GitHub (required)

The remote is HTTPS: `https://github.com/mosejames/wearercap.org`.

```bash
gh auth login          # pick HTTPS, authenticate in the browser
gh auth setup-git      # let git reuse that credential
git clone https://github.com/mosejames/wearercap.org
```

Without `gh`, use an SSH key (`git remote set-url origin
git@github.com:mosejames/wearercap.org.git`) or a personal access token with
`repo` scope. Push access is required; work lands on `main` directly.

### Supabase (required for `npm test` and for the app to run)

Every app here talks to one Supabase project. The browser only ever uses the
publishable anon key, which is safe to ship, but it still must be present at
build and test time or module import throws.

Get `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase
dashboard under Project Settings, API. Copy `.env.example` to `.env` and fill
them in. `.env` is gitignored; never commit it.

### Vercel (only to inspect deploys or edit env vars)

`npx vercel login`, then `npx vercel link` to attach the local checkout. You do
not need this to ship, since GitHub push triggers the deploy. You do need it to
read build logs or change production env vars.

Server-side env vars live in the Vercel project, not in the repo. The
serverless functions in `api/` read them at runtime:

| Variable | Used by | Notes |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | all of `api/` | falls back to the `VITE_` pair |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE` | `api/vault-sign.js`, `api/vault-link.js` | Cloudflare R2 photo storage |
| `VAULT_STORAGE` | `api/vault-sign.js` | forces `r2` or `supabase`; unset means R2 when its five vars exist |

### Cloudflare R2 (rarely)

Only needed if you touch photo storage. Credentials live in the Vercel env, not
here. `api/vault-sign.js` documents both storage modes at the top of the file.

## 2. Run it

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run build      # must pass before every push
npm test           # vitest, 361 tests across 19 files
```

**`npm test` fails without Supabase env vars, and that failure is not a bug.**
`src/carpool/supabaseClient.js` throws on import when they are missing, which
takes down `src/carpool/auth.test.js` and its 6 tests. With `.env` present, all
19 files and 361 tests pass. If you see exactly one failing file and the error
is `Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY`, fix your environment
rather than the test.

`npm run build` does not need the env vars, because the build never executes
that module.

## 3. Layout

A Vite multi-entry app. Each directory with an `index.html` is a separate page
registered in `vite.config.js`, and each has its React source under `src/`.

```
index.html            main site          src/main.jsx
ami-vault/            Amistad Vault      src/vault/
carpool/              carpool            src/carpool/
uniform-exchange/     uniform exchange   src/exchange/
rcap-recap/           recap              src/recap/
wish-i-knew/          wish I knew        src/wik/
committee-interest/   committee signup   src/committee/
api/                  Vercel serverless functions
supabase/migrations/  SQL migrations
```

Adding a page means adding both the `index.html` and an entry in
`vite.config.js`. Forgetting the second means it silently never builds.

### The Amistad Vault, in brief

A photo vault for one RCA house at `/ami-vault/`. Key facts:

- **It is a hash router.** `#/e/<slug>` never reaches the server, which is why
  share cards need the serverless detour described below.
- **There is no sign-in.** Identity is a random token in `localStorage`, and the
  database only ever sees `sha256(token)` as `owner`. Admin is a shared house
  passphrase checked by the `vault_pass_ok` RPC, held in component state
  (`App.jsx`, `const [admin, setAdmin]`). It gates destructive and expensive
  actions, not ordinary participation.
- **Share cards.** `/ami-vault/e/<slug>` is rewritten by `vercel.json` to
  `api/vault-link.js`, which renders per-event Open Graph tags and then bounces
  a real visitor into the hash route. This exists so a texted invite previews as
  that one event instead of the generic vault.

## 4. House rules

**No em-dashes in anything a person reads.** This is a standing rule, not a
style preference. It covers UI copy, share-card text, invite messages, headings,
and documents like this one. Code comments are exempt, since nobody outside the
repo reads them. Use a sentence break, a colon, or a comma instead.

Before pushing copy changes:

```bash
grep -rn '—' --include=*.jsx --include=*.js --include=*.html src/ api/ ami-vault/
```

Filter out comment lines and the placeholder dashes in the admin tables in
`src/vault/App.jsx`, which are intentional.

Known outstanding violations, not yet cleaned up: `ami-vault/index.html`
(`og:title` and the meta description) and body copy throughout
`public/what-to-expect/index.html`.

**Other conventions**

- Commit messages explain *why*, not what. Read `git log` before writing one;
  the existing messages are the spec.
- One logical change per commit.
- Comments explaining a non-obvious gate stay attached to the thing they
  explain. Moving code past a comment without moving the comment is a bug.
- Derive URLs from runtime location rather than hardcoding, so the vault works
  at `/ami-vault/` or at its own domain. See `SITE.base` in
  `src/vault/config.js`, and read its comment before touching it.

## 5. Shipping and verifying

```bash
npm run build && npm test        # both must pass
git commit                       # one logical change, why not what
git push -u origin main          # this deploys
```

Wait roughly 60 to 90 seconds for Vercel, then verify against the live site
rather than the source. Source correctness does not prove a correct deploy.

```bash
curl -s 'https://wearercap.org/ami-vault/e/sparkles-takeover' | grep 'og:'
```

Expected `og:title`: `RCA Takeover at Sparkles: add your photos`.

A stale response means the deploy has not landed. Check `x-vercel-cache` with
`curl -sI`; a `MISS` is a fresh render.

### Verification traps

- **Distinguish "not deployed yet" from "could not connect."** A curl that
  fails at the network layer prints nothing and looks exactly like unchanged
  content. Check the exit code or `-w '%{http_code}'` before concluding
  anything about the deploy.
- **Hashed bundle names differ between local and production.** Vercel inlines
  its own env vars, so `dist/assets/amivault-<hash>.js` will not match the
  deployed filename. To check a string reached production, read the deployed
  `/ami-vault/` HTML for the current `<script src>`, then fetch that file.
- **`/ami-vault` without a trailing slash is served directly, with no redirect
  to `/ami-vault/`.** Any code deriving a path prefix from
  `window.location.pathname` must handle both. This exact gap once shipped
  invite links as `/e/<slug>` instead of `/ami-vault/e/<slug>`, sending real
  families to a 404. `vercel.json` now routes bare `/e/:slug` as a rescue for
  links already sent; the generator fix is in `SITE.base`.

## 6. Recent context

The last four commits on `main`:

- `65a0829` route bare `/e/<slug>` to the vault card so already-sent invites resolve
- `f987111` keep the `/ami-vault/` prefix when the path has no trailing slash
- `37f254e` show "Invite to upload" to everyone, not just admins
- `e7e730c` remove em-dashes from share-card copy

The reasoning behind `37f254e` is worth carrying forward: the parent who was at
the event knows which families were there, so sharing is theirs to do. Bulk
download is a different risk and stays admin-only. Prefer opening up sharing and
gating bulk or destructive actions.
