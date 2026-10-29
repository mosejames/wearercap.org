# RCAP: Who’s That Little Boo?

## Scope and run paths

A We Are RCAP Guess Who Game at `/little-boo/`. Adult bonus mode: Ghosts of Halloweens Past. Original game-show styling in midnight blue and gold, quiet translucent ghosts, optional celebration sound and reduced-motion support.

Run `npm install`, provide the existing publishable Supabase environment pair, then `npm run dev`. Open `http://127.0.0.1:5173/little-boo/`. Vite includes a local API adapter at `/api/little-boo`. Server uploads need the existing shared R2 environment. Production reuses the existing `api/m3-sign` dispatcher, with no additional serverless-function slot.

The production schema is `supabase/migrations/20261029045008_little_boo_game.sql`. Apply only this migration, not unrelated pending migrations. There are no seed children, photos, phone messages, raffle writes or invitation changes in the release.

## Authorized product handoff

Parents voluntarily submit one early Halloween photo of their own child, private full name, optional accepted nickname/spelling aliases, house and grade. Adults may submit their own childhood photo in the separate bonus mode. Photos post immediately. Consent is required, with report, uploader removal and existing-owner moderation controls. Portrait and landscape are retained without cropping; the first three Halloweens are a suggestion with earliest-available fallback.

Every player gets one committed guess per photo. The confirmation step precedes commitment. Choose free text or help first. Wrong locks that mystery for that player. Exact normalized full names and supplied aliases are checked in PostgreSQL. A little help unlocks after ten distinct active submitted children, with at least four actual participants in the selected mode. Four actual submitted names are chosen once and persisted per player/photo. Help permanently reduces the possible award to one point. First unaided correct is five points, later unaided correct three. Hinted correct does not consume the first unaided award. Correct answers produce personal checkmarks and are never revealed globally.

No guessing points on a submission you own or a child declared in your private profile. An accepted student upload earns its separate 3-point contribution bonus. Declare all your own children, including those submitted by another parent. The game cannot independently prove parenthood, school membership or all household relationships. It uses phone accounts, submitter declarations and organizer controls, not a school roster.

Individual, house and grade boards are mode-specific. Children’s individual prizes are 25, 15 and 10 raffle tickets for first, second and third. Student totals include a separately tracked 3-point contribution bonus for each student’s first accepted photo. The app generates an organizer report only. It does not issue tickets, charge money or alter Zeffy/raffle records.

## Fair defaults and unsettled choices

- One photo per normalized full name per mode for the round. Duplicate cleaned-image hashes are rejected. Removal does not allow re-entry during the same round. Use full names to avoid collisions; an organizer can address exceptional same-name cases in a future controlled correction flow.
- A family with multiple children chooses one scoring house and grade. These lock after the first positive score, including a contribution bonus. Own-child exclusions can only grow. Each photo corresponds to one child, so identified-photo progress is identified-child progress.
- Removed photos immediately leave the gallery and stop contributing to live points. Final score reports are frozen snapshots and are not silently rewritten after removal. An organizer can record the actual drawing outcome once for unresolved tied prize places, with an audit record.
- Adult individual/house/grade boards remain separate from children and their prizes.
- Confirmed phases use America/New_York. Submissions open Thursday, October 29 and close Friday, October 30 at 11:59 a.m. EDT, one minute before guessing opens. Guessing opens Friday, October 30 at noon EDT and closes Saturday, October 31 at 23:59 EDT. Results are Sunday, November 1 after organizer review. Tied prize places require an organizer drawing. No proposed 3/1 replacement for 5/3/1 was approved or implemented.
- No global name reveal, even after closing. Finalization requires the deadline to have passed. Tied podium places receive no assigned tickets until an owner records the actual organizer drawing. No random draw or ticket issuance runs automatically. Reviewed results can appear Sunday; unresolved drawings keep results provisional.
- Notifications are in-app only. Sign-in texts require the player to tap the explicit request button. No background SMS, invitations or mass texts are sent.

## Protection boundaries

Phone sign-in reuses the existing Supabase vault session and OTP functions. It verifies a phone number, not RCAP membership. The URL is noindex but can be forwarded. Signed-in people can copy photos or take screenshots.

All game tables live in non-exposed `boo_private`, with RLS enabled and no client table grants. A small public invoker RPC delegates to a private definer that checks `auth.uid()` against a non-anonymous phone-confirmed account. Only the existing vault `owner` staff role receives organizer tools. No account access is changed.

Names, aliases, relationship declarations, phone numbers and answer maps are absent from public page assets and gallery responses. A hint intentionally exposes four candidate names only after eligibility and permanent hint use. Direct RPC calls cannot enumerate answer tables. Unexpected-spelling capsules are encrypted; server completion requires a per-photo proof that is never returned to clients.

Images are decoded, orientation-corrected, fitted inside 1800×1800 and freshly JPEG-encoded by Sharp with no metadata. Browser preparation fits inside 1600×1600. Original limit 25 MB, prepared payload limit 3 MB, decoded pixel limit 40 million. JPEG/PNG/WebP supported; HEIC is converted on the phone where supported. The server also attempts HEIF decoding if its build supports the codec. Real HEIC-device testing remains separate from format/error handling tests.

The shared R2 bucket has existing public distribution. To avoid treating random public URLs as privacy, this game stores authenticated AES-GCM encrypted bytes under its own `little-boo/v1` prefix. Authorized API photo reads decrypt on the server only after checking active visibility. No plaintext upload or original is stored in R2. A domain-separated encryption key is derived from the existing shared R2 secret. Rotating that secret requires re-encrypting this game’s objects first or retaining a migration key; do not rotate it casually. Removal hides/deauthorizes objects, rather than deleting the encrypted blob immediately.

Player advisory locks, photo row locks, a unique player/photo record and a global closing/finalization lock protect scoring. Twelve committed validation requests per minute and 120 per hour limit brute force. Provider checks are leased for 20 seconds to prevent concurrent repeated AI calls. Timed-out checks can resume the same immutable guess. Server-confirmed service failures release the reservation without consuming it.

## Optional OpenAI spelling review

The existing server-side `OPENAI_API_KEY` integration is reused. No key, account, paid plan or billing setting is created. Live external child-name calls are disabled unless the separately approved server flag `BOO_NAME_AI_APPROVED=true` exists. That approval has not been supplied in the delegated history. Do not enable it without confirming name-transfer permission with Mose.

Exact normalized names and provided aliases work without AI. Clearly different guesses become wrong without contacting a provider. Only conservative near spellings are eligible for the structured text-only fallback. Names and aliases for that one photo plus the submitted guess go to `https://api.openai.com/v1/responses`, with `store:false`, no photos, phone, house or grade. The default model is `gpt-4.1-mini`, configurable via `BOO_AI_MODEL`. Prompt strings are untrusted data, and output is a strict boolean schema. No identity recognition is performed.

With live AI disabled or unavailable, a near-spelling check returns an honest unavailable message and leaves the guess unconsumed. The player can use an explicitly supplied name or alias. This is a limitation, not a fake AI result. Synthetic mocked-provider tests exercise success, rejection, malformed output and service failure.

## Verification

- `npm run build` for the final bundle.
- `npm test` for the complete repository suite.
- `node scripts/test-boo-browser.mjs` against the running Vite server. Uses fictional browser fixtures, not a real SMS account or real uploads. Checks mobile/desktop overflow, sign-in form, persistent hint use, committed result, refresh, report, upload, leaderboard and organizer views. Screenshots go to `/tmp/boo-review`.
- `supabase/tests/little_boo.sql` inside a rollback transaction after the schema exists. Uses synthetic auth fixtures only and checks normalized aliases, 10 distinct children, 5/3/1, once-only scores, own-child restrictions, hint persistence, wrong lockout, failed-provider recovery, forged result rejection, answer secrecy, direct-role permissions, rate limiting, removal, affiliation locks and 25/15/10 reports. Do not commit synthetic fixtures into production.
- Local embedded PostgreSQL additionally verified the same SQL logic with isolated mock auth/staff schemas. No live users or external provider were used.
- True simultaneous multi-session race testing and real-device HEIC testing must be distinguished from sequential SQL awards and image-processing checks.
- A public diagnostics endpoint `GET /api/little-boo?action=status` returns configuration/reachability booleans only. It performs no SMS or OpenAI call and creates no R2 object.

## Release constraints

Keep this change isolated from `invitation-display-names`/`5daabab` and deferred raffle privacy/committee lookup work. Latest main was inspected before branching. Do not reset or overwrite someone else’s checkout. Publication/live deployment is authorized for this game only. Do not announce to families, send invitations, issue tickets, create credentials or change account access. Verify actual deployed HTML, OG image and API behavior before calling it live and working.

## Verified release checkpoint, October 29

The first game revision `1c3e9fee9a56edc2e6706c007ab140536a592f61` was deployed to production through the authorized main-branch workflow. `https://wearercap.org/little-boo/` and its 1200×630 OG JPEG returned HTTP 200 through the connected Vercel fetch tool. The live status endpoint confirmed phone auth enabled/reachable and shared R2 reachable. Preview R2 was unavailable, consistent with production-only configuration. The database migration succeeded under version `20261029045008`; zero game players and photos remained, and direct authenticated answer-table access and anonymous game RPC access were false.

Final build and all 1,135 tests across 159 files passed. Browser fixtures at 390px and 1280px passed with no horizontal overflow. The actual hosted database rollback suite passed; the expanded local PostgreSQL suite also covered adult score separation, rate limits and 25/15/10 awards. Real SMS delivery, signed-in live upload, physical-device HEIC and simultaneous independent database-session races were not exercised. Do not describe those as verified. No separate AI name-transfer approval was received, so live spelling-provider calls remain disabled.

## Faster onboarding revision

The first screen now explains the game with “Add your kid. Guess a kid. Earn points. Win prizes.” and two direct entry buttons. The actual established We Are RCAP artwork is reused through `src/components/Brand.jsx`, serving `/brand/we-are-rcap-reversed.svg` at its original aspect ratio and colors. The artwork itself is untouched.

Photo-first path: choose one photo locally, see its prepared preview, sign in with the preview still visible, then supply the child's private full name, optional nickname aliases, house/class and consent. Authentication and consent are required before any server upload. A new player's house/class comes from that first child and a default non-phone leaderboard alias is assigned; no separate parent-profile screen or parent name is required. The existing scoring-affiliation lock still applies. Successful posting clears the draft, adds a server-confirmed contribution celebration for students and shows the Friday opening time. The guessing board unlocks Friday at noon.

Guess-first path: sign in, see the board, select a kid, then choose the house/class that should receive points. Private own-child declarations remain available to prevent self-scoring. Optional leaderboard-name editing lives in Player profile. One photo per student, one committed guess, 5/3/1 guessing awards and separate adult scores are retained. The confirmed phased release and separate +3 student contribution bonus now apply, as described below.

A selected File, compatible JPEG and all child/name/phone form input stay in React memory only. The same tab retains these through OTP back/cancel, error, resend, backgrounding and expired-session recovery. Session storage contains only validated navigation flags (mode, action, optional photo ID, had-photo boolean and timestamp), never image bytes or identity fields. Refresh or tab eviction requires reselecting the photo and re-entering unsent child details; a visible message explains this, and a before-unload prompt warns while a photo is selected. There is no IndexedDB, localStorage photo cache, service-worker draft cache, credential creation or test sign-in bypass. Submit and explicit sign-out clear the draft. Changing signed-in accounts clears it for privacy.

The styled single-file picker now uses `accept="image/*"` without `capture` or `multiple`; actual accepted formats/size and server byte decoding remain checked. Inline guidance suggests finding an older photo in the phone Photos app by Halloween/year/costume, optionally favoriting it, and returning to the picker. It explicitly says the phone controls available albums and the website cannot search the full library. No mandatory Recents duplication, PWA install, iOS share-target or invasive photo permission is introduced. Physical iPhone/iCloud/HEIC picker behavior remains unverified.

Additional verification: `node scripts/test-boo-onboarding.mjs` uses fictional auth and API fixtures for portrait EXIF orientation, landscape, canceled/replaced selection, local-only privacy, OTP back/cancel/error/retry/resend cooldown, background/resume, repeated taps, expired-session recovery, refresh/reselect disclosure, draft cleanup, actual brand asset and progressive guess-first setup at 390px/1280px. `src/boo/journey.test.js` verifies navigation storage excludes private data and tolerates blocked storage. Existing game browser tests remain in `scripts/test-boo-browser.mjs`.

Platform references: [MDN file input](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/file), [Apple Photos search](https://support.apple.com/guide/iphone/search-for-photos-and-videos-iph392d77d5f/ios). Native picker search and album presentation belong to the phone/browser; the site does not claim to control them.

Uploading is optional and is not a prerequisite to guessing. The phase-specific landing has one primary action: add a student during submissions, guess when the guessing window opens, or view standings/results after closing.


## Confirmed phases, contribution reward and opening-text preference

The new migration adds a private contribution ledger, photo/guess phase guards, a public schedule-only RPC and a bounded consent table. It does not reset any profiles, submissions or guesses. Pre-migration inspection found one player, one active accepted student photo, zero adult photos and zero guessing awards. Owner/profile consistency checks passed, so that one accepted photo is eligible for an idempotent +3 backfill using its original acceptance time and current selected scoring team.

The bonus is exactly 3 points per student's first authenticated, consented, accepted photo. Local selection earns nothing. Guess points remain 5/3/1 in their existing plays ledger. Total, guess and contribution points are returned separately on individual/house/grade boards and organizer reports. Siblings each qualify; no family cap or score normalization is added. As before, all a player's points support one selected house and grade. The first positive contribution locks that choice too; another child's house/class metadata does not move the family's existing scoring points.

A private receipt is unique by normalized student name and original cleaned-photo hash, with nullable photo/person references so it survives actual record deletion. Retries, second-parent duplicates, replacements, removal and record recreation cannot issue a second bonus for the same recorded student/photo identity. Removing the photo forfeits its active contribution points as well as its guess points; the consumed receipt remains, so removal/re-entry cannot farm points. Existing one-photo identity uses normalized full names, not an authoritative school roster. Same-full-name students still need organizer handling; supplying a changed name and changed image is not independently verifiable as the same child.

Accepted submissions are available to their uploader immediately, without premoderation. Other families' photos and media are gated until the Friday guessing opening. Existing photos/scores remain stored and visible to their owners; no data is deleted by the phase change. The server checks real clock time after locks and at photo/play writes, so a transaction started before a cutoff cannot add a late photo or fresh guess after it. A spelling adjudication for an already committed pre-close guess may finish within its bounded lease, and finalization waits for an active lease to finish. The live external AI flag remains disabled.

Tie handling is an organizer drawing among tied players for affected 25/15/10 places. The snapshot report leaves those ticket recommendations null until an owner explicitly confirms that the drawing was conducted and records eligible, distinct players for every affected place. The app never selects random winners, issues tickets, charges money or edits raffle records. Only manually reviewed, resolved reports become visible as Sunday results. Until review/drawing is complete, Sunday shows provisional standings and an honest pending message.

The optional opening-text checkbox is not preselected or required for upload. It records only the signed-in user's request for the fixed `little-boo-2026-opening` campaign, with consent/withdrawal timestamps. Repeated saves are idempotent; users can withdraw, and new opening requests stop when guessing opens. `delivery_state` stays `not_scheduled`. The UI explicitly says requests are saved but no opening texts are scheduled or sent. No automation, SMS campaign or background send is created. Campaign configuration and explicit sending authorization remain outstanding; sign-in OTP continues only on a user's explicit tap.

Verification: `node scripts/test-boo-phases.mjs` covers all public phases, a single phase-specific primary action, pre-open board protection, sibling bonus display, separate score sources, optional consent/withdrawal without SMS, a selected draft crossing submission close, automatic board refresh at opening, and manual drawing UI at phone/desktop widths. SQL rollback suites are `supabase/tests/little_boo_contributions.sql`, `supabase/tests/little_boo_phases.sql` and the updated legacy `little_boo.sql`. Contribution tests cover rejected/anonymous submissions, duplicates/retries, siblings, adult exclusion, affiliation locking, removal, replacement, physical deletion/recreation, same-image reuse and answer privacy. Phase tests cover exact Eastern timestamps, the Sunday DST boundary, stale transactions spanning cutoffs, direct late writes, private media, bounded consent, owner-only human drawing recording and no premature official results. Score suites use a temporary rollback-only clock fixture to exercise both exclusive phases. The isolated PostgreSQL harness also checks one legacy photo receives exactly one backfill.


## Held schedule correction, October 29 10:54 UTC

The user explicitly extended photo submissions to Friday, October 30, 2026 at 11:59 a.m. America/New_York. The held migration now uses `2026-10-30T11:59:00-04:00` (15:59 UTC), followed by the unchanged Friday-noon guessing opening at 16:00 UTC. The waiting phase is only that one minute. UI copy, exact SQL/client boundary tests and browser phase fixtures are updated. This correction does not itself authorize retrying the previously denied combined production migration; that full migration and publication remain on hold pending the parent's explicit approval question. Nothing in this held correction is live.

## Publication confirmation and reveal additions

The parent supplied new explicit publication approval after the prior denial. The approved combined migration is ready for a single retry after readback confirmed neither migration executed. Before opening, the public phase response includes only the distinct active student count alongside schedule data; no photo IDs, identities or media locations. The landing shows a countdown and running count, refreshed every minute and after successful upload. Authenticated families see only their own submissions before noon; organizer review remains available. Media authorization is enforced in the database before the server decrypts and streams an image; it never returns a presigned plaintext photo URL.

All grades stay eligible. Optional My grade, My house and All little boos filters use the player's selected scoring affiliation, change only the view and leave shared scoring and own-child exclusion intact. House/grade card metadata is only returned alongside already-authorized card data, never in the public aggregate endpoint.

## Production retry denied, October 29

The one retry with new publication evidence was rejected by automatic approval review: “This production migration makes broad, costly-to-reverse schema, trigger, scoring, privacy, and phase changes with backfill; the trusted user evidence approves the game behavior but does not clearly authorize this exact live database migration and publication.” Target: Supabase project `kcsrtwwpnekqdrfgcfys`, migration `little_boo_student_contributions` from `20261029095439_little_boo_student_contributions.sql`. No further retry, SQL workaround, push or deployment was attempted. A fresh readback confirmed contributions and phase functions remain absent, the existing photo count remains one, and production closing remains unset. To unblock, explicit approval must name applying this production migration with existing-photo +3 backfill and publishing the tested game-only code to wearercap.org.

The latest landing simplification is also prepared locally: the actual logo and marquee remain; the hero says “A guessing game with real raffle-ticket prizes.” One upload action says “Add your little boo.” The opening sentence changes from Tomorrow at noon to Today at noon at Eastern midnight. The count and countdown sit below the primary action; rules stay tucked away. Nothing in this section is live.

Final local verification: build passed; 1,158 Vitest tests across 161 files passed; all three PostgreSQL suites passed; final phase browser suite passed, including both filters and restored all-grade view. The revised 390px submission screenshot was visually inspected at `/tmp/boo-phase-review/submission-390.png`. Latest logs: `/tmp/boo-simple-build.log`, `/tmp/boo-simple-unit.log`, `/tmp/boo-simple-browser.log`, `/tmp/boo-reveal-database.log`. Production remains the previously deployed `44d0fe2`.

## Raffle copy clarification

User-directed copy now says “Play for bonus tickets in the RCAP raffle.” The podium explains that top players earn 25, 15 or 10 raffle tickets, meaning more chances in the separate RCAP raffle. Rules explain that raffle winners are selected separately. No values, odds or other raffle prize claims are introduced. This copy revision does not change the denied migration/publication status.

## Production migration completed, October 29 13:29 UTC

The user requested another normal connector attempt from macOS. This invocation succeeded. Production migration history confirms version `20261029132925`, name `little_boo_student_contributions`; the checked-in filename is aligned with that actual version. Readback verifies one preserved existing photo, one active backfill receipt totaling exactly 3 points, zero scored guesses and zero opening-text preferences. The public phase response contains only schedule data and `submittedStudents: 1`. Eastern instants match Friday 11:59 a.m. submission cutoff, Friday noon opening and Saturday 11:59 p.m. close. Earlier blockers above are historical. No migration rerun is needed. Game-only publication and live checks follow.

## Organizer-only guessing rehearsal

`/little-boo/?preview=guessing` uses the actual game board, filters, guess dialog, confirmation, results and leaderboard components with an isolated fictional adapter. The normal game URL and server-authoritative reveal schedule are unchanged. The server's new `preview-access` action checks the existing `admin` RPC owner gate and returns only `{allowed:true}`; private admin data is discarded. Signed-out visitors must use existing phone sign-in, and signed-in nonowners receive a denial. No new database function, role or migration is needed.

After authorization, twelve illustrated fictional cards load. Mystery 1 accepts Fable Finch (or Fable), demonstrating five unaided points; Mystery 2 accepts Milo Moon and demonstrates three later-unaided points. Help on another card demonstrates one point. Wrong answers lock the card, and the final own-child card excludes guessing points. Practice answers are listed in the rehearsal banner. Adult mode is empty. These are UI rehearsal scenarios, not live server scoring or AI adjudication.

All rehearsal actions stay in the tab's namespaced session storage, with fictional data only. Reset removes only this namespace. The real photo draft/navigation marker is neither read nor overwritten. Unknown operations, including upload, organizer settings/finalization, opening-text preferences and ticket actions, are rejected by the adapter. No rehearsal call falls back to the real API. The normal production API remains the default outside this route.

Checks: `src/boo/preview.test.js` covers isolated state, aliases, 5/3/1, wrong lock, hints across refresh, own-child exclusion, forbidden real-game actions and reset scope. `server/boo/game.test.js` verifies signed-out/member denial and owner permission without admin-data exposure. `node scripts/test-boo-rehearsal.mjs` exercises the shared UI at 390/1280px and asserts that only `preview-access` network calls occur, including after refresh, filters and reset. The existing phase browser suite also passes unchanged normal-game flows. Production verification does not impersonate an owner or send an actual OTP.
