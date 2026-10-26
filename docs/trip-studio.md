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
