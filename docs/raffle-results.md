# Fall Raffle dashboard

URL: https://wearercap.org/events/2026/fall-raffle/results/

The page stays noindex and unlinked. On October 26, Mose approved the full student ranking with first names and last initials, and requested Ashley’s original dashboard structure in RCAP colors. This supersedes the initial aggregate-only boundary for abbreviated student rankings. Mose also approved publishing the October 25 winner, Sherinda Tolbert, her $75 Amazon gift card prize and the announcement video supplied in this chat. Future winners remain gated and manually entered; Mose confirmed the $20,000 goal on October 28.

The source is Ashley’s dashboard HTML attached to the October 25 email. Keep it outside the checkout. The public JSON contains only aggregates and approved abbreviated student records. Full names and source HTML must never enter the repository or build.

Mose also approved a video-frame newsletter image and recognition of the October 25 announcer, Ryleigh B. (Class of 2031), as the week's top seller with 1,217 tickets. Ashley's first-week figures are $1 per ticket and 3,226 entries for $3,226. The manually approved `winners[].announcer` record is a snapshot for that drawing, preserved by the update script so future totals do not change historical recognition. Do not calculate a historic weekly seller from the current cumulative leaderboard. The newsletter photo is a frame at 1.5 seconds from the supplied announcement video, cropped to 720 by 540 for email.

```
node scripts/raffle-results.mjs /absolute/path/outside/repo/RCA-Fall-Raffle-2026.html
```

An existing approved student ranking stays enabled on subsequent updates. Initial enablement requires `--release-students`; `--withhold-students` removes it. The separate legacy `--release-top-five` option is unnecessary for this layout. Winners are preserved from the public JSON, and must only be entered after approval. No automatic source refresh is configured.

Students with equal contributions share a competition rank. Filtering and sorting preserve overall ranks. Names without a supplied surname remain first-name-only. Class means graduating class, not grade. Search accepts the published abbreviated name, graduating year or house. Unknown-house contributions remain in the overall total; entries without a named student are excluded from the leaderboard.

The dashboard follows Ashley’s hierarchy: timestamp and summary, four headline figures, house and class comparisons with percentages, then a searchable/sortable full leaderboard. A compact goal bar retains the earlier requested milestones. House colors appear only inside data bars. The branded 1200 by 630 OG/Twitter card is rebuilt with `node scripts/create-raffle-results-og.mjs`.

Before release: run the full test suite and build, reconcile public totals/rankings against the private source, scan all build files for full student names, check published student fields and abbreviation patterns, and verify the live phone layout and share metadata. Full-name privacy checks remain required; approved first names are expected in the build.

## October 26 purpose and lookup revision

Mose superseded the full browseable leaderboard presentation: purpose now leads,
followed by Ryleigh's approved weekly spotlight, top five overall ticket-sale
ranks (including ties), and a first-name lookup. No student results appear in
lookup until at least two characters are entered. Only name prefixes match;
class/house browsing and sort controls are removed. Same-name results retain
class and last initial for disambiguation. Overall ranks never change with search.
The lookup is public and needs no password; this is a presentation choice, not
access control. Approved abbreviated records remain in the public data bundle.
The mission copy connects parents, school support, Teacher Appreciation Week,
and student opportunities without claiming specific allocations of proceeds.

Individual ticket counts are shown only in name-search results, per Mose’s later October 26 direction. The initial top five cards and weekly spotlight retain recognition and standing without counts. Aggregate fundraising totals remain visible.

Later October 26: house and class bars replaced by pie charts with name-only legends, no totals or percentages. House colors retained; class slices use RCAP navy/gold tones. Thermometer keeps proportional colored fill without numeric labels, milestones, tooltips or numeric accessibility text. Underlying aggregates remain unchanged. Individual ticket counts remain available through name lookup.

Latest October 26 direction supersedes pies: Moving Forward Together is the sole graph, a shared-goal stacked bar with native house/class radio toggle and matching name-only legend. Class slices use quiet blue tones. Both modes retain the same total progress, including unassigned contributions. No values or percentages shown.

## Dated weekly editions (October 26)

Weekly recognition is now the default, not cumulative standings. The first edition
is `src/events/raffle-weeks/2026-10-25.json`, opening week through October 24 at
11:59 p.m. Eastern. The opening date is not established by the supplied source;
use the explicit opening-week label until confirmed. Ashley's October 25 email
and Mose's reply establish the first-week totals and Sunday publication cadence.

Each approved edition is a frozen snapshot with period dates, its own weekly
rankings, winner/video and aggregates. `?week=2026-10-25` revisits that edition;
plain `/results/` selects the newest published snapshot. Prior-week navigation
appears when a second edition exists. No invented future results. Overall data
is accessible only via the secondary `?view=overall` link. Search and rank labels
follow the selected period; the goal bar shows that period's contribution.

Future publication from cumulative dashboards requires a private baseline from
exactly the previous period's cutoff and the new source at the new cutoff:

```
node scripts/raffle-results.mjs /private/path/new-dashboard.html --week=2026-11-01 --start=2026-10-25 --end=2026-10-31 --next=2026-11-08 --baseline=/private/path/october-24-dashboard.html
```

Confirm the dates match both files before running. The script subtracts private
full-name/class/house rows before abbreviation, recalculates ranks from weekly
contributions, and rejects decreased/missing prior totals or existing editions.
Reconcile source corrections with the chair instead of silently clamping values.
New editions start with no winner: manually add only an approved winner/announcer.
Do not carry forward Ryleigh or a previous prize as a new weekly winner. The first
snapshot was seeded from the approved opening-week totals, with no prior sales.
A run without `--week` refreshes only overall data, never the weekly archive.
No automatic Sunday publishing is enabled. Test, build, privacy-scan and deploy
the reviewed edition as usual. Sources and baselines stay outside the repo.

October 26 homepage promotion: Mose explicitly authorized linking results from the raffle page (superseding the earlier unlinked rule). Added a secondary homepage weekly-results callout in place of the Bingo Night card. Results remain noindex/nofollow. Homepage now leads with Trunk or Treat, with the November 1 second drawing directly below. New second-drawing image is shared by homepage, raffle page and raffle-page OG/Twitter. Page countdown uses October 31 at 11:59 p.m. Eastern; historical first-drawing countdown image retains its original deadline for old emails.

Artwork production: built-in image generation edited the existing first-drawing
raster. Final asset: `public/images/rcap-raffle-second-drawing.png` (1200 × 630).
Prompt: preserve navy/cream/gold style, leaves, $1 ticket and composition; replace
First drawing with Second drawing, October 25 with November 1, and the deadline
with Tickets $1 • Enter by Saturday, Oct 31 at 11:59 p.m.; retain This Sunday and
Supporting Teacher Appreciation Week. No exclamation marks.


## October 28 midweek update

Mose approved Ashley’s cumulative dashboard dated October 28 at 10 a.m.
Overall totals are $5,388, including $52 without student attribution, with 53
named student records published using approved abbreviations. The default
weekly page retains its October 25 snapshot and Ryleigh recognition; a dated
midweek callout links to the refreshed overall view. No new weekly edition or
weekly winner was created. The overall view explains pending attribution.
Future weekly ranking calculations must reconcile Ashley’s credit corrections
against original purchase dates rather than treating reassigned old sales as
new weekly sales. Source HTML and Excel remain outside the repository.

### Public results layout, October 28

The default results page leads with the latest cumulative progress bar and parent
lookup, explicitly labeled overall and dated. The recognition below stays tied to
the latest completed week, with the next week's celebration date. Explicit
`?week=` archive links retain that week's progress and lookup data. The secondary
`?view=overall` route retains cumulative top-five recognition, labeled overall.
The unassigned amount remains in the data and total but has no public accounting
explanation; the neutral chart segment is labeled Community support.


### Celebration dashboard, October 28

Mose explicitly approved visible top-five ticket counts and comparison bars,
medal-style rank badges, house/class totals and a prominent fundraising total.
The $20,000 goal is now confirmed. This supersedes earlier count-free chart and
recognition preferences. Actual published data drives the amounts, percentage and
remaining balance; the supplied mockup figures were illustrative only. Weekly
stars remain the default, with an explicit overall switch. No full student names
are published and the raw source dashboard stays outside the repository.


### Individual count visibility, October 28 correction

Mose clarified that individual ticket counts must not appear beside one another
in the public top-five list. Show rank/raffle-star labels and medal badges only,
with no individual comparison bars. Reveal ticket counts only in name-search
results. This supersedes the preceding celebration-dashboard approval for visible
individual counts. Applies to weekly and overall recognition. Aggregate progress
and house/class totals remain unchanged.

### Committee lookup, October 28

Public results no longer offer student search. A parent help card opens an email
to Ashley Carter at ashley.payton.carter@gmail.com, with a prompt for the child's
name and class. No message is sent by the website.

The existing search is preserved at
`/events/2026/fall-raffle/committee-lookup/`, with overall and completed-week
selection. It is unlinked from public navigation and marked noindex/nofollow,
with branded OG/Twitter metadata. It is NOT authenticated: anyone with the link
can use it. The search and abbreviated data remain reusable for committee support.
Share the link with Ashley manually; this change does not email her.
