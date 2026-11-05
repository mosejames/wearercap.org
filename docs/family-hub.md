# RCAP Family Hub

Public address: https://wearercap.org/app/

The hub is a simplified front door to existing family tools. It has no new
accounts or database. Existing tools keep their own sign-in and sharing flows.
The homepage navigation and footer link to the hub.

## Keep it current

`src/community/content.json` is the single public source for tool destinations,
calendar dates, and dated RCAP events. Both the main website and app consume it.
The build validates it and publishes `/community-content.json`; both browser
views refresh it every minute and on return/focus. A bad or offline response
keeps the last good content. The service worker never caches this feed.

Add a public family tool once in `tools`. By default it appears in the app's
category list and search. An optional `homepage` object controls its main-site
card, order, descriptive copy, and action. App-specific grid order is curated
in `src/app/main.jsx`; adding a tool does not automatically replace one of the
nine primary buttons. Use `app: false` for an explicitly excluded legacy main
website tool, never as a substitute for real access control. Internal consoles,
house vaults, and class vaults must not be added to the public family registry.

The grid is Calendar, RCAP Capsule, Newsletter; Serve at EXP, Resources,
Uniforms; Volunteer hours, Our community, Contact. Carpool is in Resources.
Next up and the main site's upcoming date cards use the same event selection.
EXP chips also derive from those dates. Expired dates leave both views after
the final day in Atlanta time. Add RCAP-specific dated announcements in
`events`; matching calendar date/title records merge so links can be added
without duplication. The source is edited once and deployed through the normal
website release, with no separate app publication or skill required.

Newsletters link to the published archive, so publishing an issue makes it
available without editing the hub. Site-specific design and promotional copy
are still site-specific; arbitrary HTML changes are not copied into the app.

Photos highlights only the school-wide RCAP Capsule. `src/app/albums.js` reads
public `vault_events` album metadata filtered to `house = 'rcap'` and
`hidden = false`, with another client-side visibility check. It refreshes every
minute and when returning to the page. Failed/offline reads remove the album
pullouts and retain the main Capsule link. House and class vaults are excluded
from both the registry and search. No gallery photos are fetched or cached.

The `calendar` section of the shared content file holds dates transcribed from RCA's
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

## Installation guide and icon

The home screen shows a prominent Add We Are RCAP to your Home Screen card.
The header provides a persistent help button. `src/app/InstallGuide.jsx` has
iPhone/iPad, Android, and computer instructions, an icon preview, official
Apple/Google help links, and the final step of opening the saved icon.
The home card is hidden when running standalone or after an install event.
Opening the guide, explicitly dismissing the card, or confirming “I’ve added
it” also persists dismissal in this browser. The header help button remains.
Storage-blocked browsers retain dismissal only for the current visit.

The app name and Apple title are We Are RCAP. `scripts/create-app-icons.mjs`
reuses the official vector outlines, spaces WE ARE across the RCAP width,
removes the small descriptor, and renders a blue square with white RCA and
gold P. It generates versioned Apple, standard, and maskable icons. The
maskable version leaves additional safe space. Run it directly or through
`create-app-assets.mjs`. Keep the manifest, HTML, guide, and service-worker
icon paths together when revising the artwork. Physical iPhone installation
must be checked on the phone; browser QA validates the guide and asset wiring.
