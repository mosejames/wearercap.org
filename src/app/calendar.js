// Transcribed from RCA's All School Calendar dated 08/12/2026.
// Dates without listed times stay all-day. Do not infer event times.
export const CALENDAR_SOURCE = '/rca-calendar-2026-2027.pdf';
export const CALENDAR_EDITION = 'RCA 2026–2027 calendar, issued August 12, 2026';
const event = (start, end, title, detail = '', kind = 'school') => ({start, end: end || start, title, detail, kind});
export const schoolDates = [
  event('2026-11-03', null, 'No school', 'School holiday.', 'break'),
  event('2026-11-04', null, 'End of Quarter 1'),
  event('2026-11-05', '2026-11-06', 'RCA EXP', 'Welcome visiting educators. Dress uniform dates.', 'exp'),
  event('2026-11-05', null, 'Open House', 'For donors.'),
  event('2026-11-08', '2026-11-10', '5th grade DC trip', '5th grade.'),
  event('2026-11-11', null, '5th grade: no school', '5th grade only.', 'break'),
  event('2026-11-12', '2026-11-13', 'Signature Series Conference'),
  event('2026-11-17', null, 'Monopoly Day'),
  event('2026-11-19', '2026-11-20', 'RCA EXP', 'Welcome visiting educators. Dress uniform dates.', 'exp'),
  event('2026-11-23', '2026-11-27', 'Thanksgiving holiday', 'No school.', 'break'),
  event('2026-11-30', '2026-12-04', '8th grade: no school', '8th grade only.', 'break'),
  event('2026-12-05', null, 'RCA Robotics Competition'),
  event('2026-12-10', '2026-12-11', 'RCA EXP', 'Welcome visiting educators. Dress uniform dates.', 'exp'),
  event('2026-12-10', null, 'Open House', 'For donors.'),
  event('2026-12-13', '2026-12-19', 'Homecoming week'),
  event('2026-12-18', null, 'Family Holiday Lunch'),
  event('2026-12-18', null, 'Homecoming / Alumni Event'),
  event('2026-12-19', null, '7th / 8th grade parent party'),
  event('2026-12-21', '2027-01-05', 'Holiday break', 'No school.', 'break'),
  event('2027-01-13', null, 'Bingo Night', '6 p.m. • For all RCA families.'),
  event('2027-01-18', null, 'Martin Luther King Jr. Day', 'No school.', 'break'),
  event('2027-01-19', null, 'Teacher work day', 'No school.', 'break'),
  event('2027-01-20', null, 'End of Quarter 2'),
  event('2027-01-21', '2027-01-22', 'RCA EXP', 'Dress uniform dates.', 'exp'),
  event('2027-01-21', null, 'Open House', 'For donors.'),
  event('2027-01-23', '2027-01-26', '7th grade Utah trip', '7th grade.'),
  event('2027-01-27', null, '7th grade: no school', '7th grade only.', 'break'),
  event('2027-01-28', '2027-01-29', 'House Mania', 'Dress uniform dates.'),
  event('2027-01-30', '2027-02-06', '8th grade trip', '8th grade.'),
  event('2027-02-03', null, 'Trivia Night'),
  event('2027-02-08', null, 'Teacher work day', 'No school.', 'break'),
  event('2027-02-09', null, 'The Amazing Shake'),
  event('2027-02-15', null, 'No school', 'School holiday.', 'break'),
  event('2027-02-16', '2027-02-17', 'Teacher work days', 'No school.', 'break'),
  event('2027-02-18', '2027-02-19', 'RCA EXP', 'Dress uniform dates.', 'exp'),
  event('2027-02-18', null, 'Open House', 'For donors.'),
  event('2027-02-25', '2027-02-26', 'Admin Conference'),
  event('2027-03-01', null, 'No school', 'School holiday.', 'break'),
  event('2027-03-05', null, 'RCA EXP', 'Dress uniform date.', 'exp'),
  event('2027-03-11', '2027-03-12', 'RCA EXP', 'Dress uniform dates.', 'exp'),
  event('2027-03-16', null, 'End of Quarter 3'),
  event('2027-03-17', null, 'Teacher work day', 'No school.', 'break'),
  event('2027-03-18', '2027-03-20', 'Global Amazing Shake'),
  event('2027-03-22', null, 'No school', 'School holiday.', 'break'),
  event('2027-03-27', '2027-04-11', 'Spring break', 'No school.', 'break'),
  event('2027-04-15', '2027-04-16', 'RCA EXP', 'Dress uniform dates.', 'exp'),
  event('2027-04-19', null, 'Talent show submissions due'),
  event('2027-04-20', null, 'Meet & Greet', '4–6 p.m.'),
  event('2027-04-22', '2027-04-23', 'House Mania', 'Dress uniform dates.'),
  event('2027-04-25', '2027-05-01', 'Teacher Appreciation Week'),
  event('2027-05-04', '2027-05-05', 'Standardized testing'),
  event('2027-05-07', null, 'No school', 'School holiday.', 'break'),
  event('2027-05-08', null, 'RCA Talent Show'),
  event('2027-05-10', null, 'No school', 'School holiday.', 'break'),
  event('2027-05-13', '2027-05-14', 'RCA EXP', 'Dress uniform dates.', 'exp'),
  event('2027-05-13', null, 'Open House', 'For donors.'),
  event('2027-05-15', null, 'Sports & Teams Banquet'),
  event('2027-05-18', '2027-05-19', 'EOG tests / class finals'),
  event('2027-05-20', '2027-05-21', 'House Mania', 'Dress uniform dates.'),
  event('2027-05-24', null, 'Spirit Day'),
  event('2027-05-25', null, 'Field Day'),
  event('2027-05-26', null, 'Awards Night'),
  event('2027-05-28', null, 'Graduation'),
  event('2027-05-31', null, 'No school', 'School holiday.', 'break'),
  event('2027-06-01', '2027-06-02', 'RCA EXP', 'All students. Dress uniform dates.', 'exp'),
  event('2027-06-04', '2027-06-05', 'House Mania', 'All students. Dress uniform dates.'),
  event('2027-06-07', '2027-06-11', 'Summer school', 'For required students only.'),
  event('2027-06-14', '2027-06-18', 'Summer school', 'For required students only.'),
  event('2027-06-21', '2027-06-25', 'Summer school', 'For required students only.'),
  event('2027-07-19', '2027-07-20', 'RCA EXP', 'All students. Dress uniform dates.', 'exp'),
  event('2027-07-22', '2027-07-23', 'RCA EXP', 'All students. Dress uniform dates.', 'exp'),
];
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
