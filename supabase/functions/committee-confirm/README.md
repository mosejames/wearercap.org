# committee-confirm

Sends the confirmation email after a completed committee interest submission,
and records the outcome on the row.

**Deployed from the Supabase API, not the CLI.** The live source is the
deployed version; `supabase functions download committee-confirm` will pull it
if this folder is ever out of date.

## Why it does not import notify-send/email.ts

The deploy bundler cannot reach outside a function folder, so the shell is
duplicated in `shell.ts` with the tokens copied exactly. The other option was
to queue through `ue_notifications`, whose `kind` column is constrained to four
Uniform Exchange values and whose `phone` column is `NOT NULL` — bending that
table means editing something with live families on it. Isolation beat DRY.

**Follow-up worth doing** once nothing is mid-flight: move the shell to
`supabase/functions/_shared/email.ts`, have both functions import it, and
redeploy notify-send. Until then, a palette change has to be made in two files.

## Auth

`verify_jwt` is off, because the site ships a new-style publishable key which
is not a JWT. The guards are:

- the caller supplies a token, never an address — the address is read off the
  row, so this cannot be turned into an open relay;
- `status` must be `complete`;
- `confirm_sent_at` must be null, so the same parent cannot be mailed twice.

Failures are written to `confirm_error` rather than swallowed, so the back
office can see a parent who thinks they were confirmed and was not.
