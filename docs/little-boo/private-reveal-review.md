# Private Little Boo reveal preparation

This branch is local preparation only. Do not publish portraits or results until the organizer confirms reuse clearance and publication. No portrait files or student-name roster are included in this checkout.

The reveal uses the authenticated user's persisted student-game scores, including upload contributions, and that user's attempt status. It never accepts a client-selected player ID. Competition rank includes zero-point committed guessers and upload-only participants; excludes staff, anonymous/unverified/deleted/banned identities, sign-in-only and adult-only accounts. Practice data lives in the browser and is never eligible. No explicit production test/demo account marker exists in the game schema; do not exclude real people by guessing from their display names. If organizer-designated test identities exist, resolve them explicitly before publication.

`20261102031605_little_boo_confirmed_nickname_credit.sql` has already been applied and read back: four confirmed nickname corrections, +12 guessing points, no upload changes, no first-correct winner changes. Do not apply again manually. The 24 uncertain attempts (16 distinct target/guess pairs) remain unchanged in a separate private review artifact.

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

Private local review route after implementation deployment would be `/little-boo/?view=reveal&preview=organizer`; it requires server-confirmed owner access. No deployed preview is claimed by this branch.
