# Carpool notify function: webhook + Resend setup (click-by-click)

This is what you (Mose) need to do by hand to wire up the `notify` Edge
Function once it's deployed: get a Resend account + API key, set the function
secrets, deploy the function, and create the three Database Webhooks in the
Supabase dashboard that call it.

Project ref: `kcsrtwwpnekqdrfgcfys`

---

## R1. Create a Resend account + verify a sending domain

1. Go to https://resend.com and sign up (free tier is fine to start).
2. **Domain verification (do this before going live):**
   - Dashboard → **Domains** → **Add Domain** → enter `wearercap.org` (or a
     subdomain you're fine sending from, e.g. `mail.wearercap.org`).
   - Resend gives you 3-4 DNS records (SPF/DKIM, sometimes a DMARC
     suggestion). Add them wherever `wearercap.org`'s DNS is managed
     (Cloudflare, Namecheap, wherever the domain lives).
   - Back in Resend, click **Verify** once DNS has propagated (can take
     minutes to a few hours). Status must show **Verified** before this
     domain can send.
   - **Sandbox limitation:** until a domain is verified, Resend accounts can
     usually only send to the email address you signed up with (a test
     sandbox mode) — so admin/member-approval emails to real families
     WON'T deliver until verification is done. Don't skip this step before
     go-live.
3. **Get the API key:** Dashboard → **API Keys** → **Create API Key**.
   - Name it something like `wearercap-carpool-notify`.
   - Permission: "Sending access" is enough (no need for full access).
   - Copy the key immediately — Resend only shows it once. It starts with
     `re_`.

---

## R2. Decide your "From" address

Pick an address on the domain you just verified, e.g.:

```
RCA Carpool <carpool@wearercap.org>
```

That exact string (display name + address) is what you'll set as the
`NOTIFY_FROM` secret below. It must be on the verified domain from R1 — Resend
will reject sends from an unverified domain.

---

## R3. Set the Edge Function secrets

The function needs 4 secrets that are NOT auto-injected by Supabase (unlike
`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`, which every Edge Function gets
for free):

| Secret | Value |
|---|---|
| `RESEND_API_KEY` | the `re_...` key from R1 |
| `NOTIFY_FROM` | the from address from R2, e.g. `RCA Carpool <carpool@wearercap.org>` |
| `SITE_URL` | `https://wearercap.org/carpool` |
| `WEBHOOK_SECRET` | a long random string you invent — see below |

**`WEBHOOK_SECRET`:** this is not a Resend or Supabase value — you make it up.
It's a shared password between Supabase's webhook caller and the function, so
random internet traffic can't POST to the function and trigger email blasts.
Generate one with:

```bash
openssl rand -hex 32
```

Save that string somewhere (password manager) — you'll paste it into BOTH the
function secret (below) and each of the 3 webhook headers (Step 2 below).

**Set the secrets** (from the repo root, with the Supabase CLI):

```bash
npx supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  NOTIFY_FROM="RCA Carpool <carpool@wearercap.org>" \
  SITE_URL=https://wearercap.org/carpool \
  WEBHOOK_SECRET=<paste the openssl output here> \
  --project-ref kcsrtwwpnekqdrfgcfys
```

If that command fails with an auth error, you need to log in first:

```bash
npx supabase login
```

(follow the browser prompt, then re-run the `secrets set` command), OR set
`SUPABASE_ACCESS_TOKEN` in your shell env (get it from
https://supabase.com/dashboard/account/tokens) and re-run.

**Dashboard fallback** (if the CLI login is a hassle): Dashboard → your
project → **Edge Functions** → **Manage secrets** (or **Settings** →
**Edge Functions** depending on current dashboard layout) → add the same 4
key/value pairs there directly. Functionally identical to the CLI command.

---

## Step 2: Deploy the function

From the repo root, on the `carpool-phase2b` branch, with the function code
already at `supabase/functions/notify/index.ts`:

```bash
npx supabase functions deploy notify \
  --project-ref kcsrtwwpnekqdrfgcfys \
  --no-verify-jwt
```

`--no-verify-jwt` is required — Database Webhooks call the function as a
server-to-server POST with no user JWT attached, so JWT verification (the
default) would reject every webhook call with a 401 before our own
`x-webhook-secret` check even runs.

Same auth requirement as Step 1 — if it fails, `npx supabase login` or set
`SUPABASE_ACCESS_TOKEN`, then retry.

**Dashboard fallback:** Dashboard → **Edge Functions** → **Create a new
function** (or select `notify` if it already exists from a prior deploy) →
paste the full contents of `supabase/functions/notify/index.ts` into the
editor → **Deploy**. In the function's settings, make sure **Enforce JWT
Verification** is turned OFF (this is the dashboard equivalent of
`--no-verify-jwt`) — otherwise every webhook call 401s before it reaches our
code.

**Verify it deployed:** Dashboard → **Edge Functions** → `notify` should show
a green "Deployed" status with a recent timestamp.

---

## Step 3: Create the three Database Webhooks

Dashboard → **Database** → **Webhooks** → **Create a new hook**, three times,
with these exact settings. All three use the SAME header:

```
Header name:  x-webhook-secret
Header value: <the WEBHOOK_SECRET you generated in R3>
```

### Webhook 1 — new signup notifies admins

| Field | Value |
|---|---|
| Name | `notify-member-signup` |
| Table | `members` |
| Events | `Insert` (only) |
| Type | Supabase Edge Function |
| Edge Function | `notify` |
| HTTP Headers | `x-webhook-secret: <your secret>` |

### Webhook 2 — member approved notifies member

| Field | Value |
|---|---|
| Name | `notify-member-approved` |
| Table | `members` |
| Events | `Update` (only) |
| Type | Supabase Edge Function |
| Edge Function | `notify` |
| HTTP Headers | `x-webhook-secret: <your secret>` |

(The function itself checks that the update was specifically
`pending -> approved` and no-ops on any other update — e.g. someone editing
their own email — so it's safe to fire this webhook on every `members`
update.)

### Webhook 3 — new family notifies nearby families

| Field | Value |
|---|---|
| Name | `notify-family-nearby` |
| Table | `families` |
| Events | `Insert` (only) |
| Type | Supabase Edge Function |
| Edge Function | `notify` |
| HTTP Headers | `x-webhook-secret: <your secret>` |

For all three: leave "Conditions" / filters blank — the function itself does
all the filtering (role/approval checks, pending->approved detection,
distance + throttle math). Save each one.

---

## Sanity check after setup

1. Sign up a brand-new test account (or have someone else do it) → an
   approved admin should get "New carpool signup awaiting approval" within a
   minute or two.
2. As an admin, approve that pending member → the member should get "You're
   approved — your carpool map is live."
3. Have that member fill out their family/onboarding form → any OTHER
   approved family within 5 miles (and not already notified in the last 24h)
   should get "A new family joined the carpool map in your area" — with no
   name or address of the new family in the email body.

If an email doesn't arrive:
- Check Dashboard → **Database** → **Webhooks** → click the webhook →
  **Logs** to confirm it fired and got a 200 back (not a 401 — that means the
  header secret doesn't match what's in the function's `WEBHOOK_SECRET`).
- Check Dashboard → **Edge Functions** → `notify` → **Logs** for
  `console.error` lines (bad Resend key, unverified domain, etc.).
- Check Resend Dashboard → **Emails** for delivery/bounce status on the
  specific send.
