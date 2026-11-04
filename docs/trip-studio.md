# Trip Studio and the reusable vault engine

The private operator dashboard is `/trip-studio/`. Future family vaults use
`/trips/<slug>/`, powered by the same engine. Creating another trip needs
configuration, not copied source files, new environment variables or a migration.
London and NYC remain separate applications. This engine does not read or write
their media, moderation, identities, invitations or queues.

## Launch a future trip

1. Create a trip or open a saved draft. Set destination, cohort, dates, timezone
   and stable slug. Choose a logo, optional hero image, colors and features.
2. Review the mobile intake and branded 1200 by 630 share image. Set this trip's
   optional video collection and download folder links.
3. Save the private draft. Open **Launch & lifecycle**, review the required
   details and check the review box. Choose **Launch trip** when ready.
4. Share the displayed stable family link. The initial phase is Send-off when
   enabled, otherwise Active trip. Apply phase changes in Launch & lifecycle.
5. In **Media & downloads**, review photos, hide/restore them, correct groups and
   prepare full-trip download deliveries or private recipient invitation links.

Washington, DC starts as a private draft with blank dates, cohort and timezone.
Saving does not publish. Incomplete trip configurations are rejected on both the
server and database. No DC launch or test-trip publication accompanies deployment.

## Drafts and publication

Private drafts stay in the encrypted R2 registry at
`_private/trip-studio/v1/registry.enc`. The entire object, including branding
images, uses AES-256-GCM with a studio-specific derived key. Registry revisions
and R2 conditional writes prevent silent overwrites. The dashboard shell has
no saved data and uses verified-email administrator access. Indexing is disabled.

Publishing takes a normalized snapshot of a saved draft into
`trip_engine_private.trips`. Later draft edits do not change that public
snapshot until the operator publishes them. The live version protects against
concurrent phase/publication changes. Once issued, the trip slug is immutable,
including across private/relaunch transitions, so family links stay stable.

**Make the trip private** disables public gallery lookup, uploads, downloads and
fresh share previews without removing its stored media. Archive preserves viewing
and individual downloads but closes new uploads. Phase changes are deliberate;
there are no inferred dates, automatic schedules or time-based publication.

## Family experience

- One shared gallery and stable family link across send-off, active, wrap-up and
  archive. `/trips/<slug>/send-off` opens regular intake after send-off closes.
- Group A / Group AA / Mixed selection applies to one batch. Mixed photos are
  visible under either group. Chaperone name and group can be remembered per trip
  on the device. Regular intake has no scholar-name field.
- Shared image preparation, byte fingerprinting, duplicate protection, batches
  of up to 60 photos and individual upload failures with retry information.
- Verified email or phone required to upload. Viewing, reactions and comments
  remain lightweight. Reactions/comments are scoped to the requested visible
  photo and trip; contributors can remove their own comments.
- Discreet photo credit, destination-specific milestone labels and footer admin
  access. Admin-only moderation, bulk delivery and trip lifecycle controls.
- Individual downloads use fresh visibility checks and short-lived R2 attachment
  URLs. Exact-photo shares use that photo's existing web rendition and open it.
  Removed, hidden, wrong-trip and wrong-album requests fall back to a branded
  card rather than another photo.

Video collection remains a separate per-trip Dropbox request/folder integration.
The engine does not pretend those files are photo-gallery items. Integrated
video processing and playback are separate future work.

## Data and access boundaries

All new tables live in `trip_engine_private`. RLS is enabled with no direct
client grants. No-policy informational advisor notices are intentional here:
access is through the narrow `public.trip_engine` invoker wrapper and private
functions with explicit ownership, verified-account and membership checks.
Security-definer functions have a fixed empty search path and qualified names.

The verified owner is registered as an operator. Every launched trip has its own
membership rows, media IDs, duplicate constraints and immutable storage prefix:
`trip-engine/v1/<engine-trip-uuid>/<photo-uuid>/`. Every media row explicitly uses
`storage = 'r2'`. Existing vault tables, RPCs and storage prefixes are untouched.
No Supabase Storage buckets are created. No user-editable auth metadata grants
administrator rights.

Only published trips are returned by anonymous lookup. Public configuration
excludes recipient binding, invitation expiration and video download folder
settings. Private invitation/export state is encrypted in its own R2 namespace.

## Routing and share cards

`/api/trip-studio` and `/api/trip-engine` dispatch from the existing signing entry
point. `/trips/...` cards dispatch from the existing link entry point. Only new
engine selectors are added; legacy branches are unchanged. The shared family
shell builds from `trip-vault/index.html`, registered in `vite.config.js`.

Trip and photo card responses disable caching and validate current publication,
trip, album and photo visibility. Trip cards render absolute HTTPS OG and Twitter
large-image metadata. `/trips/<slug>/og.jpg` uses the same branding renderer as
the dashboard preview. The generic shell has its own branded fallback image.
Private trips never expose their draft branding through those endpoints.

## Background download delivery

A dedicated `trip-vault-exports` queue and `api/trip-export-worker.js` prepare
photo ZIPs across all groups. The new `trip-export-email` Edge Function reuses
the project's existing email provider configuration, with a separate header key.
It never invokes or changes NYC's worker, queue, email function or invitations.

An administrator can prepare and email downloads directly or create a private
invitation link for a recipient to request their own delivery. Binding is optional
and follows the last published preferences. Invitations expire in 1 to 30 days.
Tokens are random; lookup keys are hashed. Recipients and video folder URLs stay
in encrypted state, not public trip configuration.

The dashboard shows queued, preparing, ready, emailed, failed, expired and revoked
states with progress, refresh, retry/resend and expiration controls. Completed
ZIPs survive email failures. Repeated worker failures stop for administrator
attention. Queue cleanup removes expired archives; access checks enforce expiry
before cleanup occurs. Revoke invalidates the associated invitation immediately.

Delivery emails have separate photo ZIP and video buttons. Both go through fresh
receipt and trip checks; photo downloads also recheck manifest visibility. Video
buttons redirect to the configured per-trip folder. No email is sent merely by
saving or publishing settings. A send action requires an explicit operator or
recipient button click.

## Configuration

Existing Supabase publishable URL/key and shared R2 variables are reused.
Server-only values:

- `TRIP_STUDIO_ADMIN_EMAILS`: explicit dashboard administrator emails.
- `TRIP_STUDIO_KEY`: dedicated 32-byte hexadecimal registry encryption key.
  Existing fallback to `NYC_EXPORT_KEY` remains for compatibility; production has
  a dedicated studio key. Rotating a selected root key requires re-encryption.
- `TRIP_ENGINE_EMAIL_KEY`: separate key accepted by `trip-export-email`. Its hash
  is deployed with that function. Rotate the Vercel value and function together.

Do not expose private keys with `VITE_` prefixes. No additional secrets are
needed when launching a future trip. The existing owner can grant scoped trip
memberships through the engine's operator-only membership action.

## Local review and verification

`npm run dev -- --port 5184` serves the dashboard and engine APIs. For a local-only
configuration workspace, open `/trip-studio/?local=1`. That mode saves only in
this browser and cannot publish or send emails. Production builds remove the
local adapter; a query parameter cannot bypass sign-in.

Run:

- `npm run build` and `npm test` before a push.
- `supabase/tests/trip_engine.sql` as a rollback-only database integration check.
- `scripts/verify-trip-engine.mjs` for local browser fixtures: stable URL, mobile
  layout, groups, intake, photo viewer/downloads, conversations and DC launch gate.
- `scripts/verify-trip-studio.mjs` for local draft persistence and branding.
- `scripts/create-trip-engine-og.mjs` or `scripts/create-trip-studio-og.mjs` when
  rebuilding generic thumbnails.

The browser scripts accept `STUDIO_BROWSER_PATH` for an installed Chromium browser
and refuse non-local fixture targets. Integration fixtures never publish a real
trip or send a real email. After release, verify live anonymous protections and
existing vault endpoints. Keep DC private until its organizer completes setup and
explicitly launches it.

## Class of 2030 Washington, DC guide

The November 8–10, 2026 trip uses `washington-dc-2030`, Class of 2030,
Washington, DC, and America/New_York. Its compact, expandable family guide is
in `src/trip-engine/TripGuide.jsx`; the supplied 12 planned stops live in
`trip-guides.js`. Matching includes slug, cohort and dates so other DC trips
do not inherit this event's itinerary. No day-by-day stop schedule was supplied.
The guide does not publish the letter's contact numbers, hotel or flight details.

This source addition does not launch a trip or update the encrypted registry.
Save and launch the configured trip through the administrator workspace.
The engine's existing per-trip uploads, moderation, exact-photo sharing and
no-store share-card checks remain the production path.

The Class of 2030 DC trip uses one gallery without group filters, upload group
selection or group labels in the viewer. `src/trip-engine/groups.js` supplies
that trip's presentation policy. Its uploads use the existing neutral `Mixed`
value internally, including when an older device remembered Group A or Group AA.
Other trips retain their configured grouping. No media or identities are moved.

The DC family page follows the NYC reference: cream paper, navy and gold centered
headline, a softly washed Washington backdrop, compact milestone card above the
hero and the trip album immediately below. The generated decorative backdrop is
not a guest photo. Responsive WebP assets live in `public/dc/`; `dc-backdrop.js`
embeds the smaller JPEG for the identical studio/server share-card renderer.
`dates.js` keeps the hero and share-card dates readable. Specific photo cards
continue to use the requested photo's existing web rendition.

DC supports the same separate Dropbox video collection flow as NYC. When the
published trip has `features.videos` enabled and a `videoUploadUrl`, the hero
and photo dialog show Share trip videos. The link opens a separate tab with
noopener/noreferrer. Archive hides the contribution link. Photo intake remains
photo-only; video submission does not imply automatic gallery ingestion. Each
trip must use its own approved Dropbox file request and destination.

## DC and future vault upload release, November 4, 2026

The shared engine uses confirmed photo counts, compact six-photo selection with a separate full review, failed-only retry, and a graphical thank-you with gallery and share-more actions. Original-byte SHA-256 duplicate protection and canonical reservation IDs remain authoritative. A lost confirmation is checked before retrying. Keep the page open and the screen awake; background completion is not guaranteed. Selected files remain in memory through sign-in, not after a reload.

Prepare the whole journey includes optional Expectations content and a separately controlled contribution gate, closed by default. Existing live phases are preserved. The production migration adds the phase and recovery behavior without updating trip configurations or photo records. London and NYC keep their existing implementations.

Brand & sharing generates scenic artwork through the authenticated Trip Studio API using the existing server-side OpenAI key and fixed reference. No contributed photos are sent to OpenAI. Generation has a transactional database-backed per-administrator lease and 10-attempt daily limit. Results stay in the administrator's browser until selected and saved; publishing remains explicit. Existing live video collection links survive a publish from a legacy draft that omitted that link.

Verification includes the full test/build suite and an isolated database run covering reservation expiry, canonical identity, lost confirmation, hidden duplicates, cross-account isolation, anonymous denial, Expectations contribution gates and unchanged table grants. Physical-phone background behavior remains subject to browser and OS suspension.

### Shared Google and phone accounts

DC and future engine vaults use one persistent authentication storage key (`rcap-trip-studio-auth-v1`), with automatic token refresh and PKCE OAuth. Google sign-in runs in a separate window returning to the exact allowed `https://wearercap.org/trip-vault/?auth_callback=1` address. The upload page keeps its selected files. Blocked, cancelled or timed-out windows leave phone verification available. Use the same normal browser and canonical domain; private browsing and cleared storage can require another login.

Existing phone contributors should verify the original phone, then choose Connect Google to this account, or use Account options while signed in. This calls the authenticated identity-linking API and verifies that the returned user ID has not changed. No photo ownership rows are rewritten. Google users can verify a phone backup on that same account using phone-change verification. Conflicts with an already separate account are reported without moving photos or merging accounts based on a name or unverified contact. A Google login alone does not identify an unrelated phone-only account; the original phone remains the recovery path.

Google requests only OpenID, email and profile. The RCA Workspace domain is an account-picker hint, not a new authorization policy. Existing verified-contributor and trip-specific administrator rules remain unchanged. Manual linking is enabled in Supabase; existing provider settings and session limits are retained. Shared login does not grant access to private vaults or administrator roles. London and NYC retain their applications.

Local Chrome verification uses the actual auth client with intercepted local auth and gallery responses: verified phone, same-ID Google linking, retained File selection, previous-photo ownership, a second vault, browser restart, and automatic refresh of an expired token with only one OTP request. No production accounts, messages or media are created by that test. Real Google consent and physical iPhone/Android behavior require a user account/device to finish their respective flows.

### Start a hero from an uploaded photo

Brand & sharing → Create a hero image accepts an optional JPEG, PNG or WebP (10 MB maximum). Selection prepares a compressed, metadata-free preview locally; it does not start generation or change the draft. Apply RCA style & fit explicitly sends only that photo, the fixed RCA style reference and scene fields to OpenAI. No other vault media is fetched. Fit choices ask the model to extend the scene to 16:9 or crop to fill, preserving the main subjects. AI can change details, so review both the wide output and phone crop before choosing Use this hero. Saving and publishing remain separate actions. Use a photo as-is retains the original non-AI upload path.

Server validation limits encoded input size and decoded pixels, checks raster format, normalizes orientation, removes metadata and attaches the source photo before the style reference. Existing authentication, daily generation allowance and concurrency lease apply to both paths. Source photos are not written to draft storage; only the chosen output is saved through the normal draft workflow. Hero generation now has a separate block action below the privacy text so the charge explanation cannot run into the button.


### Image request lock repair

The R2 conditional-write lease repeatedly rejected valid starts and mislabeled them as another running image. Generation now acquires an atomic PostgreSQL lease through a narrow authenticated RPC, guarded by the existing global Trip Studio operator check. One active job per operator, five-minute expiry, ten daily starts, same-job idempotence and matching-job release are checked in one transaction. Direct table access stays revoked with RLS enabled. Draft and photo storage are unchanged. The migration creates only the lease table and functions; existing photos, trip configurations and drafts are untouched. Switching to the new counter starts a fresh allowance on the repair day.

Isolated database tests cover anonymous/non-admin denial, active-job exclusion, release ownership, retry idempotence, expiry/daily reset and table grants. The old R2 lease namespace is no longer consulted; it contains only usage counters and job IDs, not photos.

### Desktop and mobile hero previews

Generated artwork includes Preview on desktop & mobile before Use this hero. Brand & sharing also offers Preview this draft on desktop & mobile for any selected or uploaded hero. The modal renders the shared vault App with in-memory draft settings inside a stylesheet-isolated frame at 1280 × 850 or 390 × 844 pixels; desktop scales down to fit the available workspace, while the actual inner viewport remains unchanged. Responsive media queries, logo, colors, headline and image positioning come from the real engine. Washington retains its scenic background treatment. Other engine vaults with selected hero artwork now use the same full-width scenic presentation with their own image, destination and draft colors.

This is an Active trip preview with an illustrative empty album. Its content is inert, authentication is skipped and gallery reads are replaced by in-memory draft data. It does not load production photos, submit files, save drafts or publish settings. Closing the preview preserves the pending generated artwork. Missing draft dates and logos use explicit placeholders. Browser checks cover inner viewport sizes, responsive CSS changes, phone workspace overflow and absence of gallery API calls.


### Shared full-width scenic heroes

A selected hero is now a viewport-wide background behind centered text rather than a small side image for DC and future engine vaults. The shared ScenicHero component supplies the real vault and creator previews, with the existing cream wash, responsive cover crop and readable foreground. Generic destinations use Big memories plus their destination name; Washington keeps Big history and its existing assets. Custom draft colors are preserved. No Washington-specific notes, downloads or landmark content are added to other trips. Vaults without a hero keep the text fallback. This is a presentation-only release; no photo records, saved drafts, trip phases or access rules change. London and NYC are unchanged.
