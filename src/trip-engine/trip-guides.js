// Event identity is explicit so later DC trips cannot inherit this itinerary.
const DC_2030 = Object.freeze({
  slug: 'washington-dc-2030', cohort: '2030', start: '2026-11-08', end: '2026-11-10',
  title: 'Three days. A capital full of stories.',
  stops: ['American History Museum', 'National History Museum', 'MLK Memorial', 'FDR Memorial',
    'Hard Rock Cafe', 'African-American History & Culture Museum', 'WWII Memorial',
    'Washington Monument', 'Lincoln Memorial', 'US Capitol', 'Spy Museum', 'Ford’s Theater'],
});
export function tripGuide(trip) {
  return trip?.slug === DC_2030.slug && trip.cohort === DC_2030.cohort && trip.start === DC_2030.start && trip.end === DC_2030.end ? DC_2030 : null;
}
