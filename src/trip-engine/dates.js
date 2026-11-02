export function tripDateLabel(trip) {
  if (!trip.start || !trip.end) return 'Trip dates to come';
  const start = new Date(trip.start + 'T12:00:00Z'), end = new Date(trip.end + 'T12:00:00Z');
  if (!Number.isFinite(+start) || !Number.isFinite(+end)) return 'Trip dates to come';
  const format = date => new Intl.DateTimeFormat('en-US', {month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(date);
  if (trip.start.slice(0,7) !== trip.end.slice(0,7)) return `${format(start)} to ${format(end)}`;
  const month = new Intl.DateTimeFormat('en-US', {month:'long',timeZone:'UTC'}).format(start);
  return `${month} ${start.getUTCDate()}–${end.getUTCDate()}, ${end.getUTCFullYear()}`;
}
