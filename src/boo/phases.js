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

export function openingDayLabel(target, now) {
  const dateKey = (value) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  if (!Number.isFinite(Date.parse(target)) || !Number.isFinite(now)) return "";
  const days =
    (Date.parse(dateKey(target)) - Date.parse(dateKey(now))) / 86400000;
  return days === 0
    ? "Today at noon"
    : days === 1
      ? "Tomorrow at noon"
      : easternTime(target);
}
