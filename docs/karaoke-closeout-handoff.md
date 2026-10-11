# Karaoke organizer closeout

Website: https://wearercap.org/karaoke/closeout/
Interactive preview: https://wearercap.org/karaoke/closeout/?preview=1

The preview starts with an empty form, never loads private event data, disables receipt uploads and never calls save/submit. Its completion screen explicitly says nothing was sent. The normal page requires a confirmed Google or email sign-in and explicit event-team membership. It reuses the playbook sign-in session.

## What is ready

Eleven questions are grounded in the September 27 karaoke closeout: actual flow, attendance, responsibilities, equipment, approved budget, catering discrepancy, décor invoice year, proposed overage split, facilities notification, lessons and reusable materials. Three chapters lead to a review with vendor confirmations, reconciliation flags and supporting files. A partial submission is welcome. Marking Needs follow-up records a suggested person; it does not send them a message.

Drafts belong to their author and use optimistic revisions. Submitted snapshots preserve earlier versions and receipt references. Receipts are private PDF/JPG/PNG bytes in the private database until Google delivery is authorized, capped at 2 MB per file and 20 files per author/event. Excluding a file removes it from subsequent submissions while preserving earlier evidence. Website storage is not a completed Google Drive archive. The interface distinguishes saved, waiting for Drive, and archived states.

The authorized team and financial reference amounts were seeded privately from the existing record. The migration initializes only existing organization administrators; do not put personal email addresses or financial amounts in public source. Additional members must be explicitly authorized and added by a project administrator. There is no anonymous contributor access. Direct table access is denied, RLS is enabled, public functions are invoker wrappers, and private functions verify confirmed account identity plus event membership. The machine archive function instead requires a separately generated 256-bit key, stored hashed in the database, and targets only karaoke.

## One-time Google setup, still required

The lead-only Archive setup panel provides the prepared source and a setup-key action. The key is revealed in memory only and is never sent to third-party analytics, URLs or local storage. Creating a replacement key invalidates the older key. Do not generate one until preparing the RCAP-owned installation.

1. Sign into rcaparents@ronclarkacademy.com and create an Apps Script project. Paste `server/closeout/Archive.gs` (also downloadable from `/downloads/karaoke-closeout-archive.gs`).
2. Put `CLOSEOUT_KEY` from the lead-only website setup action and `SUPABASE_ANON_KEY` from the existing website project into Script properties. Do not put a service role key in this script.
3. Run `setupCloseout`. The RCAP owner must review and approve Google's requested Drive, Docs, external requests, user email and scheduled-trigger permissions. This has not been approved by the agent.
4. The script checks RCAP owns both the fixed report and event folder, installs a five-minute trigger, and pulls only immutable submitted snapshots. No new Vercel function or publicly deployed Apps Script web app is needed.
5. Submit a clearly marked test and verify the original JSON, receipt files and attributed report supplement. Verify the website reports Archived in Drive. Until then, do not claim automatic Google delivery has been verified.

The script writes the exact submitted words under headings that map to report sections. It appends attributed organizer follow-ups rather than silently replacing the original evidence or approving a financial total. Budget differences and unsupported paid claims remain flagged. Each submitted version has deterministic file names and a completion marker. Receipts are acknowledged after file creation; submissions only after the original JSON and report are saved. Retried deliveries find existing files and markers. It serializes trigger execution. Original receipt bytes remain in the private database as a recovery copy.

## Validation

`npm run build` and `npm test` are required. `supabase/tests/karaoke_closeout.sql` runs against the project in a rollback-only transaction. It verifies outsider denial, direct grants, draft restore, stale revisions, immutable submitted history, evidence retention after exclusion, file signatures and archive-key rejection. No test contribution is retained. New private tables intentionally have RLS without direct access policies; clients use the verified RPC boundary. Unrelated project-wide advisor findings are outside this change.

The branded thumbnail is `public/karaoke-closeout-og.jpg`, generated at 1200 by 630, with absolute HTTPS OG and Twitter large-image metadata. The public HTML contains no private financial values or answers.
