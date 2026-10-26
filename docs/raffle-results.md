# Fall Raffle dashboard

URL: https://wearercap.org/events/2026/fall-raffle/results/

The page stays noindex and unlinked. On October 26, Mose approved the full student ranking with first names and last initials, and requested Ashley’s original dashboard structure in RCAP colors. This supersedes the initial aggregate-only boundary for abbreviated student rankings. Mose also approved publishing the October 25 winner, Sherinda Tolbert, her $75 Amazon gift card prize and the announcement video supplied in this chat. Future winners remain gated and manually entered; the $20,000 goal remains provisional.

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
