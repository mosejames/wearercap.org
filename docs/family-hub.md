# RCAP Family Hub

Public address: https://wearercap.org/app/

The hub is a simplified front door to existing family tools. It has no new
accounts or database. Existing tools keep their own sign-in and sharing flows.
The homepage navigation and footer link to the hub.

## Keep it current

`src/app/catalog.js` is the hub's public destination registry. Add or edit a
single record there to update category pages and search.
Use stable public destinations, not dated newsletter issues or individual
photo URLs. Published newsletters appear at `/newsletter`; visible RCAP albums
are managed in the existing Capsule. Updating those tools updates what parents
reach from the hub. A new tool still needs an entry in this registry and any
relevant full-website listing. Internal consoles and prototypes do not belong
in this public family directory.

The home grid is the nine primary destinations. Uniforms, Carpool, and the
Collective are everyday destinations; the Resources screen contains supporting
guides, forms, and ways to help. No second shortcuts section or repeated
newsletter promotion appears on Home. The newsletter feature lives on Updates.

Photos highlights only the school-wide RCAP Capsule. `src/app/albums.js` reads
public `vault_events` album metadata filtered to `house = 'rcap'` and
`hidden = false`, with another client-side visibility check. It refreshes every
minute and when returning to the page. Failed/offline reads remove the album
pullouts and retain the main Capsule link. House and class vaults are excluded
from both the registry and search. No gallery photos are fetched or cached.

`src/app/calendar.js` holds the upcoming school dates transcribed from RCA's
All School Calendar dated August 12, 2026, including the color-coded dates.
When RCA issues a revised calendar, reconcile these records with it. This is
not an automatic PDF import. The list removes a date after its final day in
America/New_York, updating every minute and on focus/visibility changes.
Ongoing ranges spanning months move into the current month. The original PDF
remains one tap away. Date-boundary and album-scope tests are in
`src/app/calendar.test.js`.

## Home-screen experience

The manifest and Apple metadata use the RCAP icon, standalone display, and
`/app/` scope. Open `/app/` in Safari and use Share, Add to Home Screen on an
iPhone. Chrome/Edge can offer installation when supported. Actual installation
on physical devices must be checked manually; browser automation verifies
manifest, icons, service worker, offline shell, and the guide.

The service worker caches only the public hub HTML, scripts, styles, and
selected brand images. It never caches API responses, gallery media, or account
pages. The hub shell can open offline after installation; destinations need a
connection. Navigating to other tools leaves the hub's service worker scope.

## Build and release

The Vite entry is `app/index.html`. `public/app/` supplies the manifest and
service worker. `scripts/create-app-assets.mjs` regenerates the optimized
community image, home-screen icons, and 1200 by 630 share image using the
existing official wordmark and website photograph. No AI imagery is used.

Run the repository build and tests, verify phone/desktop behavior, and verify
`/app/`, `/app/manifest.webmanifest`, `/app/sw.js`, and `/app-assets/share-v2.jpg`
after release. Keep initial HTML OG/Twitter metadata and image dimensions
intact. Hub links go to the Capsule and verified album pages; existing vault code handles exact
photo sharing and visibility checks.
