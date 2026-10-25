# Fall Raffle progress

Private launch URL: https://wearercap.org/events/2026/fall-raffle/results/

This page stays noindex and has no incoming site links. Only aggregate totals are published. Ashley Carter's dashboard HTML stays outside the checkout. Update with:

```
node scripts/raffle-results.mjs /absolute/path/outside/repo/RCA-Fall-Raffle-2026.html
```

The script preserves `goal` and manually entered approved `winners` in `src/events/raffle-results.json`. The goal is still a $20,000 placeholder pending Mose's decision. Do not infer approval from an existing command option.

`topFive` remains null. Only use `--release-top-five` after Mose approves publication. Released names use first name and last initial, with ties at fifth included. Weekly winners stay empty until approval and are entered by hand. The winner-sharing process remains undecided.

The progress bar scales to the greater of goal and total. House colors appear only in data bars. Rêveur retains its accent. The source date is shown rather than claiming automatic/live updates. Rebuild the branded 1200 by 630 share card with `node scripts/create-raffle-results-og.mjs`.

Privacy verification must include the aggregate JSON, built text assets and known source names. The committee dashboard was not supplied with the patch; do not claim a fresh reconciliation against that private source without receiving it. The initial aggregate figures are inherited from Claude's supplied patch.
