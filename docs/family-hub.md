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
available without editing the hub. Site-specific layout stays separately designed. Promotions and announcements
are also shared, as described below. Arbitrary HTML is not scraped into the app.

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

## Promotions and announcements

Create or update a record in `announcements` in the same shared source. Both
the homepage and app render it automatically. Do not hardcode a separate
promotion in `src/main.jsx`, `HomeRaffle.jsx`, or the app. The main site uses
featured and card layouts; the app shows active records in From RCAP on Home
and Updates. Existing survey, Capsule, and raffle-result cards were migrated.
The old second-drawing entry promotion has its actual entry cutoff and no
longer appears after that cutoff.

Each record has a unique id, `status` (draft, published, archived), placement
(card or featured), numeric priority (higher first), kicker, title, body,
href, CTA, optional image/alt text, and nullable startsAt/endsAt. Scheduling
requires ISO timestamps with an explicit UTC offset or Z. Start is inclusive;
end is exclusive. Use Eastern offsets for school deadlines, accounting for
daylight saving time. Leave dates null only for intentionally evergreen cards.
Use a new image filename when replacing artwork so already-open pages pick
up the new URL. Do not store private data or credentials in public content.

The build validates schedules and links, strips drafts and archived records
from both the emitted feed and bundled JSON, and both views use the same
active-record selector. The existing one-minute/focus refresh picks up edits,
publication, and archival. A local clock also activates and expires scheduled
cards while the page stays open. Republishing a record changes both views
through the normal single website release. Never represent a draft as published
to make it visible in a preview.

## Mobile homepage routing

`public/mobile-entry.js` runs early on the main homepage. Phone and tablet
visitors entering `/` without a section hash go to `/app/`. Desktop visitors
stay on the main site. Existing tool, newsletter, gallery, and explicit main
section links retain their destinations. Campaign query parameters survive.
The script is included only in the main HTML and never redirects the app.

The app header and footer link to `/?view=full`, which bypasses routing and
remembers a full-site preference in this browser. The full site shows mobile
visitors a Use the family hub link (`/?view=app`) that clears the preference
and opens the app. If storage is blocked, the explicit full-site URL still
works, but the preference cannot persist across future visits. This is
client routing, so share-preview HTML and desktop/JavaScript-disabled access
remain available. Tests execute the real entry script against both choices,
mobile/tablet/desktop inputs, deep links, and blocked storage.

The app Updates screen shows published newsletter issues only, read from the same published-only archive RPC as `/newsletter`. It refreshes every minute and on focus/online and links directly to each original issue. Shared announcement cards remain on Home.
