const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// Availability is a conversation starter, never a promise of a workable route.
export function scheduleOverlap(a, b) {
  const days = DAYS.filter((day) => a?.weekdays?.includes(day) && b?.weekdays?.includes(day));
  const directions = ['am', 'pm'].filter((direction) =>
    [direction, 'both'].includes(a?.direction) && [direction, 'both'].includes(b?.direction));
  if (!days.length || !directions.length) return 'No shared ride times listed';
  const when = directions.length === 2 ? 'morning & afternoon' : directions[0] === 'am' ? 'morning' : 'afternoon';
  return `You both listed ${days.map((day) => LABELS[DAYS.indexOf(day)]).join(', ')} ${when} rides`;
}
