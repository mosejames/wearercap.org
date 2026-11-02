# Private Little Boo reveal preparation

This branch is local preparation only. Do not publish portraits or results until the organizer confirms reuse clearance and publication. No portrait files or student-name roster are included in this checkout.

The reveal uses the authenticated user's persisted student-game scores, including upload contributions, and that user's attempt status. It never accepts a client-selected player ID. Competition rank includes zero-point committed guessers and upload-only participants; excludes staff, anonymous/unverified/deleted/banned identities, sign-in-only and adult-only accounts. Practice data lives in the browser and is never eligible. No explicit production test/demo account marker exists in the game schema; do not exclude real people by guessing from their display names. If organizer-designated test identities exist, resolve them explicitly before publication.

`20261102031605_little_boo_confirmed_nickname_credit.sql` has already been applied and read back: four confirmed nickname corrections, +12 guessing points, no upload changes, no first-correct winner changes. Do not apply again manually. The subsequent 24 reviewed attempts (16 distinct target/guess pairs) were explicitly approved by the organizer and corrected through the DML repair below.

`20261102130332_little_boo_private_reveal.sql` is NOT applied. It installs closed/reviewed/explicit-publication gates, owner-only preparation/preview, and authenticated private media authorization. Publication also requires all active entries mapped to ready portraits. The public phase exposes only a boolean availability flag. Organizer import stores sealed objects and registrations, never publishes. Failed retries verify existing encrypted content instead of overwriting or deleting it.

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

## Passcode-only access requirement

The organizer explicitly confirmed school-portrait reuse and subsequently restricted the entire reveal to the existing passcode login. Names, then/current photos, scores and per-photo correctness are returned only through authenticated server checks. Non-participants cannot open the released reveal; owner preview requires verified owner access. Static route HTML contains no private payload or photo preview metadata. Images are encrypted in existing private R2 storage and decrypted only after the reveal media RPC authorizes the signed-in request, with private/no-store response headers. No public portrait files are part of the build.

Added explicit API tests for anonymous data/media/upload rejection before any storage access and invalid-session media rejection. SQL tests deny direct anonymous reveal/preview/media calls; browser tests confirm logged-out users see only sign-in and make no reveal requests. Existing cross-player score isolation and before-close/unpublished gates remain tested. A local integration check found the storage helper accepted only the original photo prefix; it now accepts the equally sealed reveal/v1 UUID bin prefix while rejecting plaintext/public/traversal keys.

Fresh supported Library preparation on November 2 again returned a transfer with no workspace_path; the bundled materialize helper failed with `library file transfer failed: download failed`. No bytes arrived, no real-image QA was possible, and neither deployment nor finalization/publication occurred. Permission is no longer the blocker; transfer and real-image verification are.

## Final access restriction

The organizer narrowed access to existing verified non-staff players with a committed student-game guess during the pre-close guessing window. Upload-only and sign-in-only accounts no longer qualify. All reveal data and both image types share this server-side eligibility gate. Owner-only preview/import remains separate. The private top-five table uses the same eligible population and total persisted student points, with all players tied at fifth shown. Per-photo results remain personal.

Reveal OTP requests use shouldCreateUser:false. The closed game's other sign-in flows consult the authoritative phase and also disable account creation. A server-side game profile guard rejects new player registrations after closing. Other applications keep their existing account behavior. No global Auth configuration or account access was changed.

The initial schema confirmation expired; the revised request was interrupted. Readback after both confirmed no schema execution, no finalization and all 28 prior correction receipts preserved. The user subsequently said publish. No scoring repair may be replayed during the release.

## Installed held schema

The authorized retry succeeded on November 2. Production recorded migration version 20261102130332, and this filename now matches that readback. The private reveal schema is installed with zero assets/mappings, publication flags false, and no finalization. The existing-guesser eligibility function returns 41 eligible non-staff players. Direct anonymous table/function access is revoked. The four nickname and 24 reviewed correction receipts remain unchanged. The next stage is the gated code deployment and owner-session producer import; real-image QA must precede finalization/publication.

## Imported portraits and presentation cleanup

Read-only production verification on November 2 confirmed 55/55 complete mappings, 52 ready sealed portraits, one combined two-child entry, zero invalid object keys, 41 eligible guessers and publication/finalization still off. Producer reported all 111 image slots decoded at desktop sizes (55 THEN and 56 NOW), including the combined entry and shared portrait mappings. Initial photo loading was delayed, not a persistent pipeline failure; no image-specific runtime errors were found. Do not claim real mobile QA until the producer completes it.

Player headers now show only Total score; earned points are unchanged. The closed landing always exposes the canonical reveal link, labeled Reveal coming soon while held and See the reveal once published. Organizer readiness refreshes after finalization/drawing review instead of retaining stale disabled controls. Browser tests verify both link states and preserved score totals. The post-import production RPC still rejects anonymous data/preview/media requests.

Generated names originate in defaultPlayerName in src/boo/journey.js and ensureProfile in src/boo/main.jsx: the approved photo-first onboarding deliberately deferred parent-name collection and stored non-phone public aliases. No actual finalist names were found in the game/account name fields. Safe follow-up is explicit self-entered display-name capture for returning eligible players, validated and audited without opening registration. That follow-up is a proposal only; no names were inferred or rewritten by these presentation changes. Existing Player profile remains available for voluntary self-updates.

## Contributor access correction, November 2

The organizer expanded reveal eligibility to verified non-staff participants who either submitted a student-game guess during the guessing window or earned positive, non-voided photo-contribution points before closing. Photo-only contributors are included in the same private total-score standings. Sign-in alone does not qualify. Both reveal data and childhood/current portrait access use this shared eligibility rule. No points, guesses, images, finalization or publication flags are changed by this correction.

Installed as migration 20261102134914. The contributor correction passed the local database suite, including photo-only reveal and both image kinds, voided/late contribution denial, staff/sign-in-only/anonymous rejection and score preservation. Build, 1,218 unit tests and synthetic mobile/desktop browser checks passed. The reveal route now uses the existing branded 1200 by 630 Little Boo card for OG and Twitter large-image previews.
