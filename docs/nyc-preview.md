# NYC private preview

Base: current main 1921119. Clean checkout: /private/tmp/rca-nyc-preview.
Preview: http://127.0.0.1:5186/nyc-vault/ . Start with npm run dev -- --port 5186.

Confirmed sixth-grade trip, October 21–23, 2026, America/New_York. No class year inferred. Reported stops are unassigned to dates. No imported London media or Instagram collectors.

## Reviewable now

Shared trip configuration, branded responsive page and 1200×630 share image, local photo preparation using the existing original/web/thumb pipeline, capture ordering using London's tested helper, New York day filters, optional place labels, compact recent strip, progressive 60-photo gallery, keyboard/touch viewer, positive engagement and duplicate-byte skips. Preview media, comments and reactions are memory-only and disappear on reload. No production APIs called. No route or database changes applied.

The reusable server/trip-link.js card renderer checks vault, event, photo, visibility and storage prefix and uses the exact requested photo web rendition. Fresh requests repeat visibility lookups and set no-store. It is deliberately not wired to a public route before approval. Static image metadata uses proposed absolute production URLs; those URLs will not exist until release. Live social preview verification is pending release.

## Backend approval boundary

Audit found London-specific account claim/profile/owner, thanks, categorization and conversation RPCs; London-specific signing, dedupe and analytics handlers; m3 photo policies and storage constraints. None can safely be reused merely by changing labels. Existing London remains untouched.

Before a real shared NYC launch, prepare and approve scoped migrations/functions and rollback-only isolation checks. Provision NYC-only m3_vaults/events, verified ownership and profile operations, R2-only path constraints, positive public conversation with existing rate/visibility checks, moderation, duplicate reservations and analytics state under nyc-2026. Review all generic m3 RPC/RLS paths. Do not reuse London's event IDs or London-specific RPCs. Keep all London behavior and rows unchanged.

Then wire existing API dispatchers to the shared trip configuration and approved NYC handlers (avoid extra function count), route clean event/photo paths, use shared R2 credentials, and configure NYC video contribution destination. Main photo flow remains photo-only. Video playback and native save should reuse the compatible H264/AAC London implementation after parameterizing download filenames. No NYC video saving has been implemented or tested yet.

Approval requested only after this concrete preview: database setup and public launch remain separate approvals. Missing inputs: NYC video upload destination and dated itinerary when available. Neither blocks the local preview.

## Future owner-only creator

Accept trip name/grade/slug/dates/timezone, brand card, places, contribution policy and video destination. Validate unique identifiers and storage/analytics namespaces. Generate preview first. Provision reviewed tenant-scoped database configuration after owner approval, verify cross-vault denial and exact-photo visibility, then require explicit publish. Do not generate copied London SQL for each trip.

## Verification completed October 20

Build passed. Full suite: 112 files, 860 tests passed. New tests cover NYC day boundaries, unknown date handling, data/storage isolation, exact-photo card selection, hidden/missing/wrong-vault fallback, fresh visibility checks, duplicate skipping and invalid photo inputs. Browser verified local image preparation, success state, recent/full galleries, one-photo viewer end bounds, anonymous positive reaction and suggested comment. Test image was the generated branded card, not a scholar photo; removed by reload after testing.

OG image verified as JPEG, 1200×630. Static metadata and renderer tested locally. Production URLs are intentionally not live yet. Responsive CSS is included; actual narrow-screen and iPhone interaction, touch gestures, multiple-photo keyboard navigation and native video saving are not device-verified. Existing site build reports its pre-existing large chunks. No source files in the London app or server handlers were modified.
