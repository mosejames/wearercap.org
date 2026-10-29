export function phaseFixture(phase = "submissions", published = false) {
  const instants = {
    soon: "2026-10-28T12:00:00-04:00",
    submissions: "2026-10-29T12:00:00-04:00",
    waiting: "2026-10-30T08:00:00-04:00",
    guessing: "2026-10-30T13:00:00-04:00",
    closed: "2026-10-31T23:59:30-04:00",
    results: "2026-11-01T10:00:00-05:00",
  };
  return {
    phase,
    serverNow: instants[phase],
    timezone: "America/New_York",
    submissionsOpenAt: "2026-10-29T00:00:00-04:00",
    submissionsCloseAt: "2026-10-30T00:00:00-04:00",
    guessesOpenAt: "2026-10-30T12:00:00-04:00",
    guessesCloseAt: "2026-10-31T23:59:00-04:00",
    resultsOn: "2026-11-01",
    resultsAt: "2026-11-01T00:00:00-04:00",
    tieRule: "drawing",
    resultsPublished: published,
  };
}
