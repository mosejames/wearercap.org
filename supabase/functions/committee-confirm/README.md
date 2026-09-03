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

## Previewing the copy

`{"token":"...","preview":true}` renders the email as HTML and returns it
without sending anything or touching the row. Use it to read the copy over
before a parent ever gets it, and to check the chair-application variant, which
only appears when `chair_picks` is non-empty.

## Dated content

`NEXT_MEETING` carries an `until` date and the line drops itself once that date
has passed. A stale meeting date in a welcome email is worse than no line at
all, so anything dated added here should follow the same pattern.

## Committee copy is duplicated

The name and one-line description of each committee are repeated here from
`src/committee/data.js`, because that file ships to the browser and this runs in
Deno. Change one, change the other.
