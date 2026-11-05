# RCAP Family Hub

Public address: https://wearercap.org/app/

The hub is a simplified front door to existing family tools. It has no new
accounts or database. Existing tools keep their own sign-in and sharing flows.
The homepage navigation and footer link to the hub.

## Keep it current

`src/app/catalog.js` is the hub's public destination registry. Add or edit a
single record there to update category pages, search, and shortcut choices.
Use stable public destinations, not dated newsletter issues or individual
photo URLs. Published newsletters appear at `/newsletter`; visible RCAP albums
are managed in the existing Capsule. Updating those tools updates what parents
reach from the hub. A new tool still needs an entry in this registry and any
relevant full-website listing. Internal consoles and prototypes do not belong
in this public family directory.

Shortcuts are browser-local, use a versioned localStorage key, and are limited
to six. Storage failure leaves the hub usable for the current visit.

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
`/app/`, `/app/manifest.webmanifest`, `/app/sw.js`, and `/app-assets/share.jpg`
after release. Keep initial HTML OG/Twitter metadata and image dimensions
intact. Hub links go to vault landing pages; existing vault code handles exact
photo sharing and visibility checks.
