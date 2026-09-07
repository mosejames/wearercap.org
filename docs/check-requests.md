# RCAP check requests

URL: https://wearercap.org/check-requests/

Uses the existing Vite/Vercel app, Supabase project, email-code sign-in, and Resend sender. It does not replace or import the old Google Form or spreadsheet. Those originals were not located in the connected Drive search.

## Access

Parents sign in with their own email to submit requests and see only their records. Receipt files are private and downloaded through short-lived signed URLs.

Initial board access is tied to verified email addresses:

- `rcaparents@ronclarkacademy.com`: secretary, for Latasha's RCAP secretary account.
- `rcapfinance@ronclarkacademy.com`: treasurer.
- `mose@mosejames.com`: setup manager.

The secretary or manager can add or update board members in **Board review > Board access**. Add Latasha's personal email there if she prefers it over the shared secretary account. Reviewers see only requests assigned to them and their own submissions. Secretary, treasurer, and manager see the full queue. Secretary access does not itself authorize approval: the assigned board member approves, and cannot approve their own request. Only the treasurer records payment, after approval, and cannot record their own payment.

## Workflow

1. Parent supplies payee, contact and delivery information, committee, purpose, and itemized expenses.
2. Every expense requires 1 to 5 PDF/JPG/PNG receipts, each at most 10 MB. The server verifies the stored objects and computes the total in integer cents.
3. Parent chooses an overseeing board member or lets the secretary assign one.
4. A reviewer can approve, decline, or request corrections. Reasons are required for decline/corrections. A corrected request retains its ID and returns to review.
5. Treasurer records the check/payment reference and date. The app records a payment; it does not transfer funds.

All mutations and permissions are enforced by database functions, not just buttons. Requests use version checks to prevent stale decisions. Submissions are idempotent by request ID. Uploaded receipts cannot be overwritten or deleted by clients once submitted.

## Notifications

Every request change creates delivery records for the requester, secretary/manager, and assigned reviewer. Approval and payment also notify treasurer accounts. Emails contain a request number and authenticated link, not receipt contents or financial details.

`check-request-notify` reuses existing `RESEND_API_KEY` and `RESEND_FROM` secrets. A database-held random key authorizes the worker, atomic claims prevent concurrent sends, and Resend idempotency keys protect delivery retries. A trigger starts delivery; a two-minute cron job recovers failed or missed calls, up to five attempts. Delivery states are visible in the request. Never copy the dispatch key into this repository or browser code.

The UI shows the newest 500 accessible requests. No historical records were imported.

## Verification

Run `npm run build` and `npm test` with the existing Supabase environment configured.

`supabase/tests/check_requests.sql` tests the actual database workflow, receipt requirements, privacy, self-review restrictions, assigned review, resubmission, stale updates, payment gates, history, and the outbox. It rolls back all test data and queued notifications. It does not send test emails.

The private config table intentionally has row-level security with no client policies, so the database advisor's informational no-policy finding is expected. It is not accessible to client roles. Unrelated existing Supabase findings belong to the other applications.
