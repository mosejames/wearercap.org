import content from './content.json';
export const schoolDates = content.calendar.dates;
export function easternToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export function upcomingMonths(today, dates = schoolDates) {
  const months = new Map();
  dates.filter(item => item.end >= today).slice().sort((a,b) => a.start.localeCompare(b.start)).forEach(item => {
    // An ongoing cross-month break belongs to the month families are in now.
    const month = (item.start < today ? today : item.start).slice(0,7);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(item);
  });
  return [...months].sort(([a],[b]) => a.localeCompare(b)).map(([month,items]) => ({month,items}));
}
const date = value => new Date(`${value}T12:00:00Z`);
export const monthLabel = month => date(`${month}-01`).toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
export function dateLabel(item) {
  const start = date(item.start), end = date(item.end);
  const fmt = (d, options) => d.toLocaleDateString('en-US',{...options,timeZone:'UTC'});
  if(item.start===item.end) return fmt(start,{weekday:'short',month:'short',day:'numeric'});
  const first=fmt(start,{month:'short',day:'numeric'});
  return `${first}–${fmt(end,item.start.slice(0,7)===item.end.slice(0,7)?{day:'numeric'}:{month:'short',day:'numeric'})}`;
}
