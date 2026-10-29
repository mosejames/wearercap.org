export function phaseAt(schedule, now) {
  if (!schedule || !Number.isFinite(now)) return null;
  const start = Date.parse(schedule.submissionsOpenAt),
    submitEnd = Date.parse(schedule.submissionsCloseAt),
    guessStart = Date.parse(schedule.guessesOpenAt),
    guessEnd = Date.parse(schedule.guessesCloseAt),
    results = Date.parse(schedule.resultsAt);
  if (![start, submitEnd, guessStart, guessEnd, results].every(Number.isFinite))
    return null;
  return now < start
    ? "soon"
    : now < submitEnd
      ? "submissions"
      : now < guessStart
        ? "waiting"
        : now < guessEnd
          ? "guessing"
          : now < results
            ? "closed"
            : "results";
}
export function easternTime(value, { day = true } = {}) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      ...(day ? { weekday: "long", month: "short", day: "numeric" } : {}),
      hour: "numeric",
      minute: "2-digit",
    })
      .format(date)
      .replace("12:00 PM", "noon") + " Eastern"
  );
}
export function countdown(target, now) {
  const seconds = Math.max(0, Math.ceil((Date.parse(target) - now) / 1000));
  if (!Number.isFinite(seconds)) return "";
  const days = Math.floor(seconds / 86400),
    hours = Math.floor((seconds % 86400) / 3600),
    minutes = Math.floor((seconds % 3600) / 60);
  return [
    days ? `${days}d` : null,
    `${hours}h`,
    `${minutes}m`,
    `${seconds % 60}s`,
  ]
    .filter(Boolean)
    .join(" ");
}
