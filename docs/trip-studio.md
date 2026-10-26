# Trip Studio MVP

Trip Studio is the private configuration workspace at `/trip-studio/`. It saves
trip drafts, not live vaults. Washington, DC starts with blank cohort, departure,
return and timezone. London and NYC are read-only reference links. Their data,
media, permissions, routes and export services remain unchanged.

## Review locally

Run `npm run dev -- --port 5184`, then open
`http://127.0.0.1:5184/trip-studio/?local=1`.

Local workspace mode is enabled only by Vite development builds. It saves to
this browser's `rcap-trip-studio-local-v1` storage key. It does not call Supabase,
R2, email or existing vault APIs. It is a real editable workspace, not a live
family gallery. Clearing browser storage removes these local drafts.

The production build removes the local adapter. Adding `?local=1` in production
cannot bypass sign-in. Normal local sign-in uses `/trip-studio/` without that
parameter and exercises the real authenticated server API.

## What is functional

- Trip list, new drafts and versioned saves, including incomplete trip details.
- Destination, class year, dates, timezone, proposed stable slug and branding.
- Logo and hero file pickers, compression and safe raster normalization.
- Feature defaults, fixed Group A / Group AA / Mixed batch selection, editable
  milestone captions for 100 / 250 / 500+, and a mobile family preview.
- Phase previews and ready-to-copy family and chaperone messages. Phases never
  change the saved `draft` status. Link placeholders remain explicit.
- Trip-specific video collection/download URLs and staff invitation preferences.
- Generated, downloadable 1200 by 630 draft share image. The dashboard itself
  also has a branded static OG card and Twitter large-image metadata.
- Save failures, stale-write errors, unsaved-change protection and sign-out.

## Hosted administrator configuration

These values are server-only, never `VITE_` variables:

- `TRIP_STUDIO_ADMIN_EMAILS`: explicit comma-separated administrator emails.
  There is no default and family or NYC export access grants no dashboard access.
- `TRIP_STUDIO_KEY`: 64 hexadecimal characters representing a random 32-byte
  encryption secret. Set a dedicated key before first hosted use. For existing
  installations the server can derive a separate studio encryption key from
  `NYC_EXPORT_KEY` when no dedicated key is set. Changing the selected root key
  later requires decrypting/re-encrypting the registry first.
- Shared `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, with the existing `VITE_SUPABASE_*` pair
  available as the server's fallback.

The browser uses only the existing publishable Supabase URL/key. Add the hosted
`/trip-studio/` URL to the project's allowed auth redirect URLs before email-link
sign-in is used. Code verification is also supported when the email template
provides a code. No authentication settings are changed by this implementation.

Every draft API request verifies its bearer token through Supabase's user
endpoint, requires a verified email and checks the explicit studio allowlist.
No decisions use user-editable metadata. The application shell and its generic
share card contain no saved drafts. Indexing is disabled; privacy comes from
server authorization, not the robots tag.

## Storage and routing

`/api/trip-studio` dispatches through the existing `api/m3-sign.js` entry point
into the isolated `server/trip-studio/` modules. This avoids adding another
Vercel function. A dedicated development middleware serves this same handler.
All responses disable caching. Unsupported actions and publication attempts fail
closed; the API supports only GET and a POST `save` action.

The registry lives at `_private/trip-studio/v1/registry.enc` in shared R2. The
entire payload, including raster branding images, is encrypted with AES-256-GCM
and a studio-specific HKDF-derived key. This is important because the shared
bucket also serves public vault images. No plaintext draft or public branding
URL is written there. No existing vault path is read or written.

The registry revision detects stale clients and R2 ETag conditional writes
prevent concurrent saves from overwriting each other. Missing ETags disable
writes rather than silently falling back to unconditional replacement. The
MVP caps the registry at 50 drafts and 3 MB. Branding images have smaller
per-image limits. It does not create database tables or migrations.

## Deliberately unavailable until a trip is launched

No publish action, public DC route, real media intake, phase activation,
moderation, invitations, background exports or emails are connected. The
Media & downloads section saves preferences and shows a delivery layout only.
The existing NYC worker and recipient invitations are never called or copied.

Next integration work is a configuration-driven public trip engine with
trip-scoped media, admin memberships and queue jobs. Existing vaults should be
migrated separately after that engine is proven. Launch requires public HTTPS
OG/Twitter image URLs, final brand review, media permission checks and fresh
exact-photo visibility checks. Unavailable photos must use the trip/album card,
never another photo. Send-off aliases must resolve into regular trip intake
after send-off while preserving the shared gallery.

## Verification

- `npm run build`
- `npm test`
- `node scripts/create-trip-studio-og.mjs` to rebuild the dashboard thumbnail
- `STUDIO_BROWSER_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node scripts/verify-trip-studio.mjs`

The browser check uses an isolated browser context against localhost only. It
verifies blank DC fields, draft persistence, phase/message previews, group
selection, mobile layouts, anonymous API denial and share metadata/image.
It never logs into or modifies a live service.
