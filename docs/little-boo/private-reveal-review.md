# Private Little Boo reveal preparation

This branch is local preparation only. Do not publish portraits or results until the organizer confirms reuse clearance and publication. No portrait files or student-name roster are included in this checkout.

The reveal uses the authenticated user's persisted student-game scores, including upload contributions, and that user's attempt status. It never accepts a client-selected player ID. Competition rank includes zero-point committed guessers and upload-only participants; excludes staff, anonymous/unverified/deleted/banned identities, sign-in-only and adult-only accounts. Practice data lives in the browser and is never eligible. No explicit production test/demo account marker exists in the game schema; do not exclude real people by guessing from their display names. If organizer-designated test identities exist, resolve them explicitly before publication.

`20261102031605_little_boo_confirmed_nickname_credit.sql` has already been applied and read back: four confirmed nickname corrections, +12 guessing points, no upload changes, no first-correct winner changes. Do not apply again manually. The subsequent 24 reviewed attempts (16 distinct target/guess pairs) were explicitly approved by the organizer and corrected through the DML repair below.

`20261102033228_little_boo_private_reveal.sql` is NOT applied. It installs closed/reviewed/explicit-publication gates, owner-only preparation/preview, and authenticated private media authorization. Publication also requires all active entries mapped to ready portraits. The public phase exposes only a boolean availability flag. Organizer import stores sealed objects and registrations, never publishes. Failed retries verify existing encrypted content instead of overwriting or deleting it.

Offline preparation:

```
node scripts/prepare-boo-reveal.mjs MANIFEST PORTRAIT_ROOT ROSTER OUTPUT_ROOT
```

The input must explicitly confirm stable game-photo IDs, names and relative JPEG paths. Output must be outside the repository. The actual Library portrait bundle schema and real-image layout still need inspection because materialization failed. The script is tested with synthetic JPEGs, shared portrait mappings and a combined two-child entry. The importer accepts the prepared output folder; uploads are sequential and mappings register only after all assets are ready.

Local checks:

```
npm test
npm run build
BOO_PGLITE_MODULE=/path/to/pglite/dist/index.js node scripts/test-boo-database.mjs
BOO_TEST_BASE=http://127.0.0.1:5183 node scripts/test-boo-reveal-browser.mjs
```

Browser verification uses only intercepted fictional responses and image fixtures. It verifies 55 distinct entries, shared portrait references, combined portraits, score/rank/status presentation, lazy authenticated media, mobile/desktop layout, logout clearing, unpublished/member-preview denial and import consent gating. It does not prove real portrait matching or production authentication/storage integration.

Private local review route after implementation deployment would be `/little-boo/reveal?preview=organizer`; it requires server-confirmed owner access. No deployed preview is claimed by this branch.

## Organizer-reviewed spelling correction

Applied once in production at 2026-11-02 03:46:22 UTC using `supabase/repairs/little_boo_reviewed_spelling_credit.sql`, with the exact 24 attempt IDs plus raw guess/name hashes supplied privately as a transaction-local parameter. No real identifiers or child names are embedded in this source. This DML repair is already complete; do not execute a new batch casually.

Audit reference: `little-boo-2026-11-02-organizer-reviewed-24-v1`. There are 24 per-attempt receipts and one batch receipt. Verified 15 affected players, +72 points (all late unaided, 3 points each), 657 to 681 correct, 152 to 128 incorrect, 1811 to 1883 guessing points, 809 attempts unchanged. Upload points remain 165. Existing positive scores and first-correct winners are fingerprint-checked in the transaction. No aliases, guesses, hint use, submissions or awards changed. Top-three order remains unchanged, scores 131/120/119, no top-three tie. These are a snapshot while guessing is still open, not final published standings.

The rollback-only SQL tests run the exact repair twice, check hint scoring, retain an unreviewed attempt unchanged, and verify atomic rejection when a target's raw guess changes. No deployment or reveal publication accompanied this correction.

## Canonical reveal route

Prepared locally at `/little-boo/reveal` (trailing slash also supported). The noindex HTML entry is included in the Vite build, explicit Vercel rewrites target that entry, and local development routes match production routing. The earlier `?view=reveal` route remains compatible. All existing sign-in, private media, organizer-preview and explicit publication gates remain in place. Build, full unit suite and fictional mobile/desktop browser verification passed. This route has not been pushed or deployed.

Read-only finalist-name check found only generated player labels for the exact top three and no supplied name/full_name/display_name/first_name/last_name fields in their account records. Do not infer identities from child entries or contact records; organizer confirmation is required for a named announcement.
