# RCAP check requests

URL: https://wearercap.org/check-requests/

Uses the existing Vite/Vercel app, Supabase project, cellphone text-code sign-in, and Resend sender. It does not replace or import the old Google Form or spreadsheet. Those originals were not located in the connected Drive search.

## Access

Anyone can sign up with their own US cellphone number and a texted verification code. No invitation, school email, or membership approval is required. Parents see only their records. Existing email-based board accounts retain an email fallback under Board review until phone access is configured. Receipt files are private and downloaded through short-lived signed URLs.

Initial board access is tied to verified email addresses:

- `rcaparents@ronclarkacademy.com`: secretary (the RCAP officers' shared inbox).
- `lemeri@abc-seniors.com`: treasurer (Latasha Emeri).
- `mose@mosejames.com`: setup manager.

`rcapfinance@ronclarkacademy.com` was removed on September 23, 2026 at the Treasurer's request. The board does not use it, and it must not be given access or notices again.

A request link from an email (`/check-requests/#request/<id>`) opened while signed out shows a sign-in step, email first, and returns to that request after sign-in.

The secretary or manager can add or update board cellphone numbers in **Board review > Board access**. Add Latasha's verified cellphone number there for cellphone-based secretary access. Reviewers see only requests assigned to them and their own submissions. Secretary, treasurer, and manager see the full queue. Secretary access does not itself authorize approval: the assigned board member approves, and cannot approve their own request. Only the treasurer records payment, after approval, and cannot record their own payment.

## Who approves (since Sept 26, 2026)

The treasurer approves every request and is the overseeing board member;
nothing is assigned. Roles in `cr_staff`:

- `treasurer`: approves, declines, sends back, sends to the board, votes,
  records payment. Any login listed as treasurer works (cellphone or email).
- `board`: votes when the treasurer sends a request to the board; can close
  duplicates.
- `secretary`, `manager`: admins. See the full queue, send requests back,
  close duplicates, manage Board access. They do not approve or vote.

A board vote passes or fails when a majority of eligible voters (board plus
treasurer, counted once per name, never the requester) agree. A treasurer's
own request goes straight to a board vote, and an admin records its payment.
Any board member or admin can close a request as a duplicate of another
number; the requester is texted. Migration:
`20260926180000_check_request_treasurer_approval.sql`.

## Workflow

1. Parent supplies payee, contact information, committee, purpose, and itemized expenses. Choose reimbursement or direct vendor payment. Reimbursements use Zelle; vendors use Zelle or debit card when Zelle is unavailable. No card credentials are collected. Zelle requires its registered email or cellphone number.
2. Every expense requires 1 to 5 PDF/JPG/PNG paid receipts or unpaid vendor invoices, each at most 10 MB. Requesters confirm expenses are within budget and identify covered items and amounts. Order confirmations alone are insufficient proof of payment, particularly Amazon/Walmart. The server checks requested amounts against entered document totals and computes the request total in integer cents. Board reviewers verify the documents themselves; no OCR verification is claimed.
3. Parent chooses an overseeing board member or lets an admin assign one. Approval within the form is sufficient.
4. A reviewer can approve, decline, or request corrections. Reasons are required for decline/corrections. A corrected request retains its ID and returns to review.
5. Treasurer records the check/payment reference and date. The app records a payment; it does not transfer funds.

All mutations and permissions are enforced by database functions, not just buttons. Requests use version checks to prevent stale decisions. Submissions are idempotent by request ID. Uploaded receipts cannot be overwritten or deleted by clients once submitted.

## Notifications

Every request change creates delivery records for the requester, secretary/manager, and assigned reviewer. Approval and payment also notify treasurer accounts. Notifications contain a request number and authenticated link, not receipt contents or financial details. Verified phone recipients receive texts; existing email contacts continue receiving email.

`check-request-notify` reuses existing Twilio messaging credentials for texts and `RESEND_API_KEY` / `RESEND_FROM` for email. Verification codes use the existing Supabase Twilio Verify configuration. A database-held random key authorizes the worker, atomic claims prevent concurrent sends, and Resend idempotency keys protect delivery retries. A trigger starts delivery; a two-minute cron job recovers failed or missed calls, up to five attempts. Delivery states are visible in the request. Never copy the dispatch key into this repository or browser code.

The UI shows the newest 500 accessible requests. No historical records were imported.

## Treasurer ledger

Finance roles can open the live, read-only [treasurer ledger](https://docs.google.com/spreadsheets/d/1M5XRQp56NytaV8bYh6-f4aotsg6J7v3raSfiiKmnRuI/edit) from Board review. The Requests tab has one row per site request and links to its private document folder. The History tab lists every recorded action with actor and time. The existing ZIP export remains available as a dated backup. The Sheet and document folder are shared as readers with Latasha and `rcaparents@ronclarkacademy.com`; they are not public.

The initial backfill includes every site request, including archived and test records. It does not import the old Google Form history. A five-minute Apps Script sync refreshes both tabs and copies new private documents. See [the integration runbook](../integrations/rcap-treasurer-ledger/README.md) for setup and recovery.

## Verification

Run `npm run build` and `npm test` with the existing Supabase environment configured.

`supabase/tests/check_requests.sql` tests the actual database workflow, receipt requirements, privacy, self-review restrictions, assigned review, resubmission, stale updates, payment gates, history, and the outbox. It rolls back all test data and queued notifications. It does not send test emails.

The private config table intentionally has row-level security with no client policies, so the database advisor's informational no-policy finding is expected. It is not accessible to client roles. Unrelated existing Supabase findings belong to the other applications.

## Phone rollout

Migration `20260907010038_check_requests_phone_signin.sql` lets the legacy `email` and `approver_email` fields carry a verified E.164 contact identity as well as an email. No client-supplied contact or profile metadata is trusted for identity. The database reads confirmed contact fields from `auth.users`. Existing email identities remain compatible; no accounts are automatically merged by an unverified phone or email.

`supabase/tests/check_requests_phone.sql` verifies phone-only accounts with no email, private receipts, approval gates, SMS queueing, and valid/invalid Zelle recipients. Test data and notifications roll back. SMS notification delivery is at least once; provider/network ambiguity can cause a duplicate retry.

## Permanent PDF archives

Each submitted/resubmitted, needs-changes, approved, declined, or paid history
entry captures an immutable request and history snapshot in the same transaction.
The existing notification worker renders the summary and receipts into PDFs,
stores them privately in `check-archives`, and emails them to
`rcaparents+check-requests@ronclarkacademy.com`. Parents may request an emailed
copy without changing their sign-in method. PDFs are available inside each Past
requests detail view to its owner and authorized board reviewers.

Each image is fitted intact to one letter-sized page. Uploaded PDF receipts keep
every source page, each fitted onto one archive page. Large bundles become
numbered PDF parts to stay under email limits. Missing or corrupt receipts fail
visibly rather than producing an incomplete archive. The original JSON snapshot
is embedded in each PDF to preserve exact text, including Unicode not available
in the printed standard font. Stored files are reused on mail retry; each email
part has its own provider idempotency key. Provider acceptance is recorded as
sent, not a guarantee that the recipient read the email.

The school Gmail account has a `RCAP Check Requests` label and a filter matching
the tagged destination. Google Drive filing remains a separate manual action
unless the school authorizes an automation. No Drive API credentials are used.

Cellphone remains the default sign-in method. Account & backup sign-in lets a
signed-in parent verify an email on the same auth user. Google uses the existing
Supabase Google provider and automatic matching of verified email identities.
Phone-first users must add/verify their Google email first to avoid creating a
separate account. The optional PDF delivery email is not a verified login email.

## Status notification preferences

Past requests and Board review include a Request notifications selector for text,
email, or both. Preferences are stored against the auth user, and both requester
and staff destinations resolve to verified contacts. Cellphone users default to
text. Email/both require a verified backup email; users cannot set preferences
for another account. Preferences affect future events on current and new requests.
Assignment, approval, decline, requested changes, and payment each produce clear
status wording. Email updates to the owner include the request recap. Optional PDF
emails remain separate; an identical destination's PDF recap replaces a duplicate
status email. Login verification codes are unaffected by these preferences.

## Staff-prepared approval requests (September 29)

The board dashboard now has **Request approval** and **Needs my approval**.
Secretary, treasurer, and manager accounts can prepare a request for someone
else. They enter their own name as preparer, the payee's contact, the event,
receipts, the RCAP amount, and an independent board approver. The preparer
retains responsibility for corrections. A payee contact does not create an
account or grant access to private records. For an existing request, use its
record rather than creating a second request for the same expense.

Personal requests retain the existing treasurer review and board-vote rules.
Staff-prepared requests require the assigned reviewer to approve or decline.
The preparing treasurer can record payment after approval, provided they are
not the recipient. Self-dealing checks also recognize existing staff email and
phone entries with the same name. The server remains the permission authority.

Each expense separates its document total from the requested RCAP amount.
A difference requires an explanation of excluded items or personal coverage,
including planned versus completed contributions. This note does not increase
a committee budget or record a donation transfer. The approval button names the
exact requested amount, and the decision history records the amount and payee.
The receipt total and coverage explanation are preserved in the PDF archive.

Assignment sends the existing text/email notifications and authenticated request
link. Staff select the reviewer entry matching the login they should use.
Daily reminders for assigned requests older than 24 hours run at 10 a.m.
America/New_York, respecting daylight saving time and channel preferences.
They are deduplicated per reviewer/contact/day; undelivered reminders are
cancelled at claim time when no assigned approvals remain or the day has passed.
A message already accepted by the provider cannot be recalled.

After approval, one confirmation email includes the configured board list,
the preparer's/requester's verified email when available, a payee email for
staff-prepared requests, and any additional committee chair or other contacts
selected by staff. The reviewer can amend the additional list before approving.
Phone-only requesters keep their normal text updates; add an appropriate email
to the circulation list when an email copy is wanted. Recipients are deduplicated
and visible on the To line. The email states amount, payee, committee, event,
approver and decision time, and that payment is still pending. It does not attach
receipts or include Zelle details. A notification recipient does not gain access
to the private request. Replies use the existing shared officers inbox.

`supabase/tests/staff_payment_approvals.sql` exercises permissions, partial
coverage, notifications, correction, exact amounts, approval circulation,
idempotency, stale decisions, reminder suppression, payment gates and existing
treasurer routing in a rollback-only transaction. No test emails are sent.

## Isolated approval simulations

Operator-created fixtures are registered in `cr_private.test_requests`, which
has no client grants. Their notifications are clearly marked TEST, deduplicated
per request version, and routed only to the registered test recipient. PDF
archives and reminders are suppressed, and a database trigger prevents recording
payment. The request follows the normal assigned approval UI; the synthetic
preparer account has no login credentials and is banned. Do not use these fixtures
for actual expenses. `supabase/tests/isolated_approval_tests.sql` verifies this
isolation in a rollback-only transaction.

### Cellphone sign-in with backup email

Check requests defaults to cellphone OTP and no longer offers Google sign-in.
Email OTP is for a previously verified backup email (or an existing legacy
email account), with `shouldCreateUser: false` so it cannot create a new account.
Add a backup email while signed in through Account & backup sign-in. The
existing `updateUser` and `email_change` verification flow attaches it to the
same user ID; the backend continues resolving that user's verified cellphone
for board permissions regardless of the sign-in method. An email already on a
separate account requires account support, not an automatic merge.

### Queue and archive

Board review puts clickable summary totals first, followed by the personal
approval queue. Request rows expand in place, keeping receipts and review
actions hidden until opened. Settings contains collapsed account, notification,
and administrator board-access panels. Board contacts are grouped visually by
name without merging their authentication accounts.

Administrators can archive and restore a request. `archived_at` excludes it
from queue totals and approval reminders while preserving its business status,
receipts, and history. The Archived filter exposes these records. Archive and
restore use a version-checked RPC and append history. A database trigger blocks
business updates until the archived request is restored. Tests #4 and #25 were
archived at the owner's request on September 29, 2026.
