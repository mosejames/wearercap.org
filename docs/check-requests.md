# RCAP check requests

URL: https://wearercap.org/check-requests/

Uses the existing Vite/Vercel app, Supabase project, cellphone text-code sign-in, and Resend sender. It does not replace or import the old Google Form or spreadsheet. Those originals were not located in the connected Drive search.

## Access

Anyone can sign up with their own US cellphone number and a texted verification code. No invitation, school email, or membership approval is required. Parents see only their records. Existing email-based board accounts retain an email fallback under Board review until phone access is configured. Receipt files are private and downloaded through short-lived signed URLs.

Initial board access is tied to verified email addresses:

- `rcaparents@ronclarkacademy.com`: secretary, for Latasha's RCAP secretary account.
- `rcapfinance@ronclarkacademy.com`: treasurer.
- `mose@mosejames.com`: setup manager.

The secretary or manager can add or update board cellphone numbers in **Board review > Board access**. Add Latasha's verified cellphone number there for cellphone-based secretary access. Reviewers see only requests assigned to them and their own submissions. Secretary, treasurer, and manager see the full queue. Secretary access does not itself authorize approval: the assigned board member approves, and cannot approve their own request. Only the treasurer records payment, after approval, and cannot record their own payment.

## Workflow

1. Parent supplies payee, contact information, committee, purpose, and itemized expenses. Payment options are Mail, Pickup at school, and Zelle. Mail requires a complete address; Zelle requires its registered email or cellphone number.
2. Every expense requires 1 to 5 PDF/JPG/PNG receipts, each at most 10 MB. The server verifies the stored objects and computes the total in integer cents.
3. Parent chooses an overseeing board member or lets the secretary assign one.
4. A reviewer can approve, decline, or request corrections. Reasons are required for decline/corrections. A corrected request retains its ID and returns to review.
5. Treasurer records the check/payment reference and date. The app records a payment; it does not transfer funds.

All mutations and permissions are enforced by database functions, not just buttons. Requests use version checks to prevent stale decisions. Submissions are idempotent by request ID. Uploaded receipts cannot be overwritten or deleted by clients once submitted.

## Notifications

Every request change creates delivery records for the requester, secretary/manager, and assigned reviewer. Approval and payment also notify treasurer accounts. Notifications contain a request number and authenticated link, not receipt contents or financial details. Verified phone recipients receive texts; existing email contacts continue receiving email.

`check-request-notify` reuses existing Twilio messaging credentials for texts and `RESEND_API_KEY` / `RESEND_FROM` for email. Verification codes use the existing Supabase Twilio Verify configuration. A database-held random key authorizes the worker, atomic claims prevent concurrent sends, and Resend idempotency keys protect delivery retries. A trigger starts delivery; a two-minute cron job recovers failed or missed calls, up to five attempts. Delivery states are visible in the request. Never copy the dispatch key into this repository or browser code.

The UI shows the newest 500 accessible requests. No historical records were imported.

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
